#!/usr/bin/env node
/**
 * fix_layalina_images.mjs
 * One-off script to upload the 4 Layalina images that were skipped
 * during the main upload due to uppercase .JPG extensions.
 *
 * Hardcoded mapping: DB recipe name → actual filename on disk.
 * "مدفون الدجاج بالفيديو" is skipped — its .webp source file is
 * genuinely missing from disk and cannot be recovered here.
 *
 * Storage paths: layalina-0142.webp … layalina-0145.webp
 * (indices 142+ to avoid colliding with the 141 already uploaded)
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname   = path.dirname(fileURLToPath(import.meta.url))
const PROJECT     = path.join(__dirname, '..')
const ENV_FILE    = path.join(PROJECT, '.env.local')
const IMAGES_DIR  = path.join(PROJECT, 'layalina-scraper', 'data', 'images')
const BUCKET      = 'recipes'
const START_INDEX = 142   // layalina-0001..0141 already used

// ── Hardcoded map: DB name → filename on disk ────────────────────────────────
// Image filenames don't match recipe names directly (scraped titles differ).
const FIXES = [
  {
    name:     'سلطة الشمندر والزبادي',
    filename: 'سلطة-الشمندر-والزبادي.JPG',
  },
  {
    name:     'الحلاوة البحرينية في المنزل بخطوات سهلة',
    filename: 'جربي-طريقة-تحضير-الحلاوة-البحرينية-في-المنزل-بخطوات-سهلة.JPG',
  },
  {
    name:     'الجريشة باللبن',
    filename: 'طريقة-الجريشة-باللبن.JPG',
  },
  {
    name:     'مرقوق اللحم بالمطبخ السعودي - الطريقة الأصلية',
    filename: 'هل-جرّبتِ-مرقوق-اللحم-بالمطبخ-السعودي؟-إليكِ-الطريقة-الأصلية.JPG',
  },
  // "مدفون الدجاج بالفيديو" — .webp source file not on disk, cannot fix
]

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

// ── Process each fix ──────────────────────────────────────────────────────────
console.log(`\n🔧  Fixing ${FIXES.length} Layalina recipes with missing images\n`)

let fixed = 0
let failed = 0

for (let i = 0; i < FIXES.length; i++) {
  const { name, filename } = FIXES[i]
  const absPath     = path.join(IMAGES_DIR, filename)
  const storagePath = `layalina-${String(START_INDEX + i).padStart(4, '0')}.webp`

  process.stdout.write(`  [${i + 1}/${FIXES.length}] ${name}\n`)
  process.stdout.write(`        file: ${filename}\n`)

  // Verify file exists
  if (!fs.existsSync(absPath)) {
    console.error(`        ❌  File not found: ${absPath}`)
    failed++
    continue
  }

  try {
    // Convert to WebP
    const origBuffer = fs.readFileSync(absPath)
    const webpBuffer = await sharp(origBuffer)
      .webp({ quality: 82, effort: 4 })
      .toBuffer()

    const origKB = (origBuffer.length / 1024).toFixed(1)
    const webpKB = (webpBuffer.length / 1024).toFixed(1)
    process.stdout.write(`        converted: ${origKB}KB → ${webpKB}KB\n`)

    // Upload to Supabase Storage
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, webpBuffer, { contentType: 'image/webp', upsert: true })

    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`)

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    const publicUrl = urlData.publicUrl
    process.stdout.write(`        uploaded: ${storagePath}\n`)

    // Update recipes table
    const { error: dbErr } = await supabase
      .from('recipes')
      .update({ image_url: publicUrl })
      .eq('name', name)
      .eq('source', 'layalina')

    if (dbErr) throw new Error(`DB update failed: ${dbErr.message}`)

    console.log(`        ✅  Updated DB → ${publicUrl.slice(0, 80)}…\n`)
    fixed++

  } catch (err) {
    console.error(`        ❌  ${err.message}\n`)
    failed++
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('── Summary ────────────────────────────────────────')
console.log(`   Fixed:   ${fixed}`)
console.log(`   Failed:  ${failed}`)
console.log(`   Skipped: 1  (مدفون الدجاج بالفيديو — source file missing on disk)`)
console.log()
