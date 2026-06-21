#!/usr/bin/env node
/**
 * upload_new_images.mjs
 * Uploads only images that are NOT already in image_url_map.json.
 * Continues recipe-XXXX.webp numbering from the highest existing index.
 * Appends new entries to the map — does not overwrite existing ones.
 *
 * Usage: node upload_new_images.mjs
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const PROJECT    = path.join(__dirname, '..')
const ENV_FILE   = path.join(PROJECT, '.env.local')
const IMAGES_DIR = path.join(__dirname, 'data', 'images')
const MAP_FILE   = path.join(__dirname, 'data', 'image_url_map.json')
const BUCKET     = 'recipes'

// ── Read .env.local ──────────────────────────────────────────────────────────
function readEnv(filePath) {
  const env = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}
const env    = readEnv(ENV_FILE)
const SB_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SB_KEY = env['SUPABASE_SERVICE_ROLE_KEY']
if (!SB_URL || !SB_KEY) {
  console.error('❌  Missing Supabase credentials in .env.local'); process.exit(1)
}

// ── Clients ──────────────────────────────────────────────────────────────────
let sharp
try { sharp = (await import('sharp')).default }
catch { console.error('❌  sharp not installed. Run: npm install sharp'); process.exit(1) }

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ── Load existing map ────────────────────────────────────────────────────────
const urlMap = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))
const existingKeys = new Set(Object.keys(urlMap))

// Find the highest recipe-XXXX index already used
const maxExisting = Object.values(urlMap)
  .map(u => u.match(/recipe-(\d+)\.webp/)?.[1])
  .filter(Boolean)
  .map(Number)
  .reduce((a, b) => Math.max(a, b), 0)

console.log(`\n📋  Existing map: ${existingKeys.size} entries (highest index: recipe-${String(maxExisting).padStart(4,'0')}.webp)`)

// ── Find new files ────────────────────────────────────────────────────────────
const allFiles = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f))
const newFiles = allFiles.filter(f => !existingKeys.has(f))

console.log(`📂  Total images on disk: ${allFiles.length}`)
console.log(`🆕  New (not in map):     ${newFiles.length}\n`)

if (newFiles.length === 0) {
  console.log('Nothing to upload.')
  process.exit(0)
}

// ── Upload new images ─────────────────────────────────────────────────────────
let uploaded = 0
let failed   = 0
const errors = []
let nextIndex = maxExisting + 1

for (let i = 0; i < newFiles.length; i++) {
  const filename    = newFiles[i]
  const inputPath   = path.join(IMAGES_DIR, filename)
  const storagePath = `recipe-${String(nextIndex).padStart(4, '0')}.webp`

  try {
    const origBuffer = fs.readFileSync(inputPath)
    const webpBuffer = await sharp(origBuffer).webp({ quality: 82, effort: 4 }).toBuffer()

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, webpBuffer, { contentType: 'image/webp', upsert: false })
    if (upErr) throw new Error(upErr.message)

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    urlMap[filename] = urlData.publicUrl
    uploaded++
    nextIndex++

    if ((i + 1) % 10 === 0 || i + 1 === newFiles.length) {
      const origKB = (origBuffer.length / 1024).toFixed(1)
      const webpKB = (webpBuffer.length / 1024).toFixed(1)
      console.log(`  ✓  [${i + 1}/${newFiles.length}] ${filename}  (${origKB}KB → ${webpKB}KB)  → ${storagePath}`)
    }

  } catch (err) {
    console.error(`  ❌  [${i + 1}/${newFiles.length}] ${filename}: ${err.message}`)
    errors.push({ filename, error: err.message })
    failed++
  }
}

// ── Persist updated map ───────────────────────────────────────────────────────
fs.writeFileSync(MAP_FILE, JSON.stringify(urlMap, null, 2), 'utf8')
console.log(`\n📄  image_url_map.json updated (${Object.keys(urlMap).length} total entries)`)

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n── Summary ─────────────────────────────────────────')
console.log(`   New images found:    ${newFiles.length}`)
console.log(`   Uploaded:            ${uploaded}`)
console.log(`   Failed:              ${failed}`)
if (errors.length) errors.forEach(e => console.log(`     • ${e.filename}: ${e.error}`))
console.log()
