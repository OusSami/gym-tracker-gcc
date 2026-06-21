#!/usr/bin/env node
/**
 * patch_images.mjs
 * Downloads an image from a URL, converts to WebP, uploads to Supabase
 * Storage, and updates the recipes table row by ID.
 *
 * Usage: node scripts/patch_images.mjs <recipe_id> <image_url>
 */

import fs   from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import http  from 'node:http'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE  = path.join(__dirname, '..', '.env.local')
const BUCKET    = 'recipes'

// ── Args ─────────────────────────────────────────────────────────────────────
const [,, id, imageUrl] = process.argv

if (!id || !imageUrl) {
  console.error('\nUsage: node scripts/patch_images.mjs <recipe_id> <image_url>\n')
  console.error('  recipe_id  — UUID from the recipes table')
  console.error('  image_url  — publicly accessible image URL (http/https)\n')
  process.exit(1)
}

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
  console.error('❌  Missing Supabase credentials in .env.local')
  process.exit(1)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function download(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(download(res.headers.location))
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end',  () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

// ── Clients ───────────────────────────────────────────────────────────────────
let sharp
try { sharp = (await import('sharp')).default }
catch { console.error('❌  sharp not installed. Run: npm install sharp'); process.exit(1) }

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n📥  Downloading image…`)
let rawBuffer
try {
  rawBuffer = await download(imageUrl)
  console.log(`    ${(rawBuffer.length / 1024).toFixed(1)} KB received`)
} catch (err) {
  console.error(`❌  Download failed: ${err.message}`)
  process.exit(1)
}

console.log(`🔄  Converting to WebP…`)
let webpBuffer
try {
  webpBuffer = await sharp(rawBuffer).webp({ quality: 82, effort: 4 }).toBuffer()
  console.log(`    ${(rawBuffer.length / 1024).toFixed(1)} KB → ${(webpBuffer.length / 1024).toFixed(1)} KB`)
} catch (err) {
  console.error(`❌  Conversion failed: ${err.message}`)
  process.exit(1)
}

const storagePath = `manual-${id}.webp`
console.log(`☁️   Uploading as ${storagePath}…`)
const { error: upErr } = await supabase.storage
  .from(BUCKET)
  .upload(storagePath, webpBuffer, { contentType: 'image/webp', upsert: true })

if (upErr) {
  console.error(`❌  Upload failed: ${upErr.message}`)
  process.exit(1)
}

const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
const publicUrl = urlData.publicUrl

console.log(`🔗  Public URL: ${publicUrl}`)
console.log(`💾  Updating recipes table…`)

const { data: rows, error: dbErr } = await supabase
  .from('recipes')
  .update({ image_url: publicUrl })
  .eq('id', id)
  .select('name')

if (dbErr) {
  console.error(`❌  DB update failed: ${dbErr.message}`)
  process.exit(1)
}

if (!rows || rows.length === 0) {
  console.error(`❌  No recipe found with id = ${id}`)
  process.exit(1)
}

console.log(`\n✅  Updated: ${rows[0].name}\n`)
