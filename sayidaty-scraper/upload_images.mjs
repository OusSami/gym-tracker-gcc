#!/usr/bin/env node
/**
 * upload_images.mjs
 * Converts all recipe images to WebP and uploads them to Supabase Storage.
 * Writes sayidaty-scraper/data/image_url_map.json  { original_filename → public_url }
 *
 * Usage:  node upload_images.mjs
 * Requires: npm install @supabase/supabase-js sharp
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const PROJECT    = path.join(__dirname, '..')
const ENV_FILE   = path.join(PROJECT, '.env.local')
const IMAGES_DIR = path.join(__dirname, 'data', 'images')
const MAP_OUT    = path.join(__dirname, 'data', 'image_url_map.json')
const BUCKET     = 'recipes'

// ── Read .env.local ──────────────────────────────────────────────────────────
function readEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`\n❌  ${filePath} not found.`)
    console.error('    Create it with:\n')
    console.error('    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co')
    console.error('    SUPABASE_SERVICE_ROLE_KEY=eyJ...\n')
    process.exit(1)
  }
  const env = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env     = readEnv(ENV_FILE)
const SB_URL  = env['NEXT_PUBLIC_SUPABASE_URL']
const SB_KEY  = env['SUPABASE_SERVICE_ROLE_KEY']

if (!SB_URL || !SB_KEY) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local')
  process.exit(1)
}

// ── Check sharp ──────────────────────────────────────────────────────────────
let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('\n❌  sharp is not installed.')
  console.error('    Run:  npm install sharp\n')
  process.exit(1)
}

// ── Supabase client ──────────────────────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ── Ensure bucket exists ─────────────────────────────────────────────────────
const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets()
if (bucketsErr) { console.error('❌  Cannot list buckets:', bucketsErr.message); process.exit(1) }

const bucketExists = buckets.some(b => b.name === BUCKET)
if (!bucketExists) {
  const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true })
  if (createErr) { console.error('❌  Cannot create bucket:', createErr.message); process.exit(1) }
  console.log(`✅  Created storage bucket: "${BUCKET}"`)
} else {
  console.log(`✓   Bucket "${BUCKET}" already exists`)
}

// ── Collect images ───────────────────────────────────────────────────────────
const allFiles = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpe?g)$/i.test(f))
console.log(`\n📂  Found ${allFiles.length} images in ${IMAGES_DIR}\n`)

const urlMap   = {}
const errors   = []
let totalOrigBytes  = 0
let totalWebpBytes  = 0
let converted  = 0
let uploaded   = 0

// ── Process each image ───────────────────────────────────────────────────────
for (let i = 0; i < allFiles.length; i++) {
  const filename  = allFiles[i]
  const inputPath = path.join(IMAGES_DIR, filename)
  const webpName    = filename.replace(/\.(jpe?g)$/i, '.webp')
  // Supabase Storage rejects non-ASCII keys, so use a zero-padded index instead
  const storagePath = `recipe-${String(i + 1).padStart(4, '0')}.webp`

  try {
    const origBuffer = fs.readFileSync(inputPath)
    totalOrigBytes += origBuffer.length

    // Convert to WebP
    const webpBuffer = await sharp(origBuffer)
      .webp({ quality: 82, effort: 4 })
      .toBuffer()
    totalWebpBytes += webpBuffer.length

    // Upload to Supabase Storage
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, webpBuffer, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (upErr) throw new Error(upErr.message)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath)

    urlMap[filename] = urlData.publicUrl
    converted++
    uploaded++

  } catch (err) {
    errors.push({ filename, error: err.message })
    console.error(`  ⚠️  [${i + 1}/${allFiles.length}] ${filename}: ${err.message}`)
    continue
  }

  if ((i + 1) % 10 === 0 || i + 1 === allFiles.length) {
    console.log(`  ✓  ${i + 1}/${allFiles.length} processed — ${filename}`)
  }
}

// ── Write URL map ─────────────────────────────────────────────────────────────
fs.writeFileSync(MAP_OUT, JSON.stringify(urlMap, null, 2), 'utf8')
console.log(`\n📄  URL map written to ${MAP_OUT}`)

// ── Summary ───────────────────────────────────────────────────────────────────
const avgOrig = allFiles.length ? (totalOrigBytes / allFiles.length / 1024).toFixed(1) : 0
const avgWebp = converted       ? (totalWebpBytes / converted        / 1024).toFixed(1) : 0
const savings = totalOrigBytes  ? (100 - (totalWebpBytes / totalOrigBytes * 100)).toFixed(1) : 0

console.log('\n── Summary ───────────────────────────────────────')
console.log(`   Total images found:    ${allFiles.length}`)
console.log(`   Converted to WebP:     ${converted}`)
console.log(`   Uploaded to Supabase:  ${uploaded}`)
console.log(`   Avg size before:       ${avgOrig} KB`)
console.log(`   Avg size after:        ${avgWebp} KB`)
console.log(`   Size savings:          ${savings}%`)
if (errors.length) {
  console.log(`   Errors:               ${errors.length}`)
  errors.forEach(e => console.log(`     • ${e.filename}: ${e.error}`))
} else {
  console.log(`   Errors:               0`)
}
console.log()
