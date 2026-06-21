#!/usr/bin/env node
/**
 * patch_sayidaty_images.mjs
 * One-off script to upload 12 Sayidaty images that exist on disk but
 * were never linked in the DB (uppercase .JPG extensions caused lookup
 * misses during the original import).
 *
 * For each entry: convert to WebP → upload as "manual-<id>.webp" →
 * UPDATE public.recipes SET image_url WHERE id = <id>.
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT   = path.join(__dirname, '..')
const ENV_FILE  = path.join(PROJECT, '.env.local')
const IMG_BASE  = path.join(PROJECT, 'sayidaty-scraper', 'data', 'images')
const BUCKET    = 'recipes'

// ── Hardcoded mappings (DB id → image filename on disk) ──────────────────────
// Entry 4 filename corrected: disk has مقرمش before على, not at end.
const TO_FIX = [
  {
    id:   '6e1a8186-49a5-4d07-9441-2ab036552f42',
    file: 'سلطة-الدقوس-بالثوم-الحارة.JPG',
  },
  {
    id:   '5eddb7d6-9d6c-4214-a36d-02050e280731',
    file: 'الدقوس-البارد.JPG',
  },
  {
    id:   'a5e6f88b-de48-40c8-bc85-4dbc7aad0354',
    file: 'السمك-المشوي-على-الطريقة-الخليجية.JPG',
  },
  {
    id:   '46802e74-febb-413f-96d0-c37219e69f10',
    file: 'السمك-المقلي-المقرمش-على-الطريقة-الخليجية.JPG',  // corrected word order
  },
  {
    id:   '54670be8-fe8f-42d5-9a67-f13133dd7222',
    file: 'مكبوس-الأرز-مع-سمك-الشعري.JPG',
  },
  {
    id:   '0cfd98b7-4a2c-4ad6-958a-0da5a1d1ec62',
    file: 'كباب-الميرو-على-الطريقة-السعودية-مع-رز-الزعفران.JPG',
  },
  {
    id:   'fe560203-6902-4f3d-a7e8-c084b0a0a06a',
    file: 'القبولي-العُماني.JPG',
  },
  {
    id:   '7e17e0ac-b12b-4152-81ae-335a1385efe5',
    file: 'الحنيذ-على-الطريقة-الأصلية-بالفيديو.JPG',
  },
  {
    id:   '9a66df3e-5f8b-48a7-a253-690f4699c267',
    file: 'فيديو-أسهل-كبسة-بالجزر.JPG',
  },
  {
    id:   '75196834-d548-43ed-9efb-b686bc2021f7',
    file: 'زربيان-اللحم..-من-المطبخ-السعودي.JPG',
  },
  {
    id:   '371cbfc3-f55a-4c64-bf7f-2342bf800f0d',
    file: 'المندي-الوصفة-الأصلية.JPG',
  },
  {
    id:   '43cf963e-0764-4f44-a9f5-fcdadb51cab3',
    file: 'بالفيديو-المثلوثة-السعودية.JPG',
  },
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

// ── Case-insensitive file resolver ───────────────────────────────────────────
const dirEntries = fs.readdirSync(IMG_BASE)
function resolveFile(filename) {
  const exact = path.join(IMG_BASE, filename)
  if (fs.existsSync(exact)) return exact
  // Case-insensitive scan
  const lower = filename.toLowerCase()
  const match = dirEntries.find(e => e.toLowerCase() === lower)
  return match ? path.join(IMG_BASE, match) : null
}

// ── Clients ──────────────────────────────────────────────────────────────────
let sharp
try { sharp = (await import('sharp')).default }
catch { console.error('❌  sharp not installed. Run: npm install sharp'); process.exit(1) }

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ── Process ──────────────────────────────────────────────────────────────────
console.log(`\n🔧  Patching ${TO_FIX.length} Sayidaty recipes\n`)

let fixed = 0, failed = 0, skipped = 0

for (let i = 0; i < TO_FIX.length; i++) {
  const { id, file } = TO_FIX[i]
  const storagePath  = `manual-${id}.webp`

  process.stdout.write(`  [${i + 1}/${TO_FIX.length}] ${file}\n`)

  const absPath = resolveFile(file)
  if (!absPath) {
    console.error(`        ❌  Not found on disk — skipping\n`)
    skipped++
    continue
  }
  if (absPath !== path.join(IMG_BASE, file)) {
    process.stdout.write(`        (case-insensitive match: ${path.basename(absPath)})\n`)
  }

  try {
    const origBuf = fs.readFileSync(absPath)
    const webpBuf = await sharp(origBuf).webp({ quality: 82, effort: 4 }).toBuffer()
    process.stdout.write(`        ${(origBuf.length / 1024).toFixed(1)} KB → ${(webpBuf.length / 1024).toFixed(1)} KB\n`)

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, webpBuf, { contentType: 'image/webp', upsert: true })
    if (upErr) throw new Error(`Upload: ${upErr.message}`)

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    const publicUrl = urlData.publicUrl

    const { data: rows, error: dbErr } = await supabase
      .from('recipes')
      .update({ image_url: publicUrl })
      .eq('id', id)
      .select('name')
    if (dbErr) throw new Error(`DB: ${dbErr.message}`)
    if (!rows?.length) throw new Error(`No row found for id ${id}`)

    console.log(`        ✅  ${rows[0].name}\n`)
    fixed++

  } catch (err) {
    console.error(`        ❌  ${err.message}\n`)
    failed++
  }
}

console.log('── Summary ────────────────────────────────────────')
console.log(`   Fixed:   ${fixed}`)
console.log(`   Skipped: ${skipped}  (file not on disk)`)
console.log(`   Failed:  ${failed}`)
console.log()
