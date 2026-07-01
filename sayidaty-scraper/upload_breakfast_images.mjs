#!/usr/bin/env node
/**
 * upload_breakfast_images.mjs
 * Converts breakfast batch images to WebP and uploads to Supabase Storage.
 * Continues recipe-XXXX numbering from the highest index in image_url_map.json.
 * Writes a separate data/breakfast_image_map.json (does NOT touch image_url_map.json).
 *
 * Usage: node upload_breakfast_images.mjs
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const PROJECT    = path.join(__dirname, '..')
const ENV_FILE   = path.join(PROJECT, '.env.local')
const IMAGES_DIR = path.join(__dirname, 'data', 'new_batch_images')
const MAIN_MAP   = path.join(__dirname, 'data', 'image_url_map.json')
const OUT_MAP    = path.join(__dirname, 'data', 'breakfast_image_map.json')
const BUCKET     = 'recipes'

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
if (!SB_URL || !SB_KEY) { console.error('❌  Missing Supabase credentials'); process.exit(1) }

const sharp        = (await import('sharp')).default
const { createClient } = await import('@supabase/supabase-js')
const supabase     = createClient(SB_URL, SB_KEY)

// Find highest index from the main map (to continue numbering)
const mainMap  = JSON.parse(fs.readFileSync(MAIN_MAP, 'utf8'))
const maxMain  = Object.values(mainMap)
  .map(u => u.match(/recipe-(\d+)\.webp/)?.[1])
  .filter(Boolean)
  .map(Number)
  .reduce((a, b) => Math.max(a, b), 0)

// Load or initialise the breakfast-specific map
let bfMap = {}
if (fs.existsSync(OUT_MAP)) {
  try { bfMap = JSON.parse(fs.readFileSync(OUT_MAP, 'utf8')) } catch {}
}
const alreadyUploaded = new Set(Object.keys(bfMap))

// Find the highest index already used in THIS map too
const maxBf = Object.values(bfMap)
  .map(u => u.match(/recipe-(\d+)\.webp/)?.[1])
  .filter(Boolean)
  .map(Number)
  .reduce((a, b) => Math.max(a, b), 0)

let nextIndex = Math.max(maxMain, maxBf) + 1
console.log(`\n📋  Main map:           ${Object.keys(mainMap).length} entries (highest: recipe-${String(maxMain).padStart(4,'0')}.webp)`)
console.log(`📋  Breakfast map:      ${Object.keys(bfMap).length} entries already uploaded`)
console.log(`🔢  Next storage index: recipe-${String(nextIndex).padStart(4,'0')}.webp\n`)

// Collect images
const allFiles = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f))
const newFiles = allFiles.filter(f => !alreadyUploaded.has(f))
console.log(`📂  Total images on disk: ${allFiles.length}`)
console.log(`🆕  New (not uploaded):   ${newFiles.length}\n`)

if (newFiles.length === 0) {
  console.log('✅  Nothing new to upload.')
  process.exit(0)
}

let uploaded = 0, failed = 0
const errors = []

for (let i = 0; i < newFiles.length; i++) {
  const filename    = newFiles[i]
  const inputPath   = path.join(IMAGES_DIR, filename)
  const storagePath = `recipe-${String(nextIndex).padStart(4, '0')}.webp`

  try {
    const origBuf = fs.readFileSync(inputPath)
    const webpBuf = await sharp(origBuf).webp({ quality: 82, effort: 4 }).toBuffer()

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, webpBuf, { contentType: 'image/webp', upsert: false })
    if (upErr) throw new Error(upErr.message)

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    bfMap[filename] = urlData.publicUrl
    fs.writeFileSync(OUT_MAP, JSON.stringify(bfMap, null, 2), 'utf8')

    uploaded++
    nextIndex++

    if ((i + 1) % 10 === 0 || i + 1 === newFiles.length) {
      const origKB = (origBuf.length / 1024).toFixed(1)
      const webpKB = (webpBuf.length / 1024).toFixed(1)
      console.log(`  ✓  [${i+1}/${newFiles.length}] ${filename.substring(0,40)} (${origKB}KB → ${webpKB}KB) → ${storagePath}`)
    }
  } catch (err) {
    console.error(`  ❌  [${i+1}/${newFiles.length}] ${filename}: ${err.message}`)
    errors.push({ filename, error: err.message })
    failed++
  }
}

console.log(`\n📄  breakfast_image_map.json: ${Object.keys(bfMap).length} entries`)
console.log('\n── Summary ─────────────────────────────────────────')
console.log(`   New images uploaded: ${uploaded}`)
console.log(`   Failed:              ${failed}`)
if (errors.length) errors.forEach(e => console.log(`     • ${e.filename}: ${e.error}`))
console.log()
