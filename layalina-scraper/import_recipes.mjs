#!/usr/bin/env node
/**
 * import_recipes.mjs
 * Upserts cleaned Layalina recipes into public.recipes in Supabase.
 *
 * Run AFTER:
 *   1. add_source_column.sql has been executed in the Supabase dashboard
 *   2. clean_recipes.mjs has produced data/recipes_clean.json
 *   3. upload_images.mjs has produced data/image_url_map.json
 *
 * Upserts on conflict of (name) — requires a unique index on recipes.name.
 * If none exists, run this in the SQL editor first:
 *   CREATE UNIQUE INDEX IF NOT EXISTS recipes_name_unique ON public.recipes (name);
 *
 * Usage:  node import_recipes.mjs
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname    = path.dirname(fileURLToPath(import.meta.url))
const PROJECT      = path.join(__dirname, '..')
const ENV_FILE     = path.join(PROJECT, '.env.local')
const RECIPES_FILE = path.join(__dirname, 'data', 'recipes_clean.json')
const URL_MAP_FILE = path.join(__dirname, 'data', 'image_url_map.json')

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

const env    = readEnv(ENV_FILE)
const SB_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SB_KEY = env['SUPABASE_SERVICE_ROLE_KEY']

if (!SB_URL || !SB_KEY) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local')
  process.exit(1)
}

// ── Load data files ──────────────────────────────────────────────────────────
if (!fs.existsSync(RECIPES_FILE)) {
  console.error(`❌  ${RECIPES_FILE} not found. Run clean_recipes.mjs first.`)
  process.exit(1)
}
if (!fs.existsSync(URL_MAP_FILE)) {
  console.error(`❌  ${URL_MAP_FILE} not found. Run upload_images.mjs first.`)
  process.exit(1)
}

const { recipes } = JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf8'))
const urlMap      = JSON.parse(fs.readFileSync(URL_MAP_FILE, 'utf8'))

console.log(`\n📦  Loaded ${recipes.length} recipes from recipes_clean.json`)
console.log(`🗺   Loaded ${Object.keys(urlMap).length} image URLs from image_url_map.json\n`)

// ── Supabase client ──────────────────────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ── Resolve image_url from the upload map ─────────────────────────────────────
// image_local is the bare filename (e.g. "سلطة-التونة-بالأرز.jpg") after cleaning.
// urlMap keys are the original filenames as found on disk.
function resolveImageUrl(recipe) {
  if (!recipe.image_local) return null
  // Direct match by filename
  return urlMap[recipe.image_local] ?? null
}

// ── Build DB rows — no url, no image_local, no external references ────────────
const rows = recipes.map(r => ({
  name:        r.name,
  image_url:   resolveImageUrl(r),
  cook_time:   r.cook_time  ?? null,
  servings:    r.servings   ?? null,
  ingredients: r.ingredients ?? [],
  steps:       r.steps      ?? [],
  source:      r.source,            // 'layalina'
}))

// ── Upsert in batches of 50 ───────────────────────────────────────────────────
// onConflict: 'name' — requires a unique index on public.recipes(name).
// If you haven't created it yet, run in SQL editor:
//   CREATE UNIQUE INDEX IF NOT EXISTS recipes_name_unique ON public.recipes (name);
const BATCH = 50
let inserted = 0
let skipped  = 0
const errors = []

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH)

  const { data, error } = await supabase
    .from('recipes')
    .upsert(batch, { onConflict: 'name', ignoreDuplicates: false })
    .select('id')

  if (error) {
    // If upsert fails due to missing unique index, fall back to plain insert
    if (error.message.includes('unique') || error.message.includes('constraint')) {
      console.warn(`  ⚠️  Batch ${Math.floor(i / BATCH) + 1}: upsert constraint missing — trying plain insert`)
      const { data: d2, error: e2 } = await supabase
        .from('recipes')
        .insert(batch)
        .select('id')
      if (e2) {
        console.error(`  ⚠️  Batch ${Math.floor(i / BATCH) + 1} insert error: ${e2.message}`)
        errors.push({ batch: Math.floor(i / BATCH) + 1, error: e2.message })
        skipped += batch.length
      } else {
        inserted += d2?.length ?? batch.length
        console.log(`  ✓  Batch ${Math.floor(i / BATCH) + 1}: inserted ${d2?.length ?? batch.length} rows (plain insert)`)
      }
    } else {
      console.error(`  ⚠️  Batch ${Math.floor(i / BATCH) + 1} error: ${error.message}`)
      errors.push({ batch: Math.floor(i / BATCH) + 1, error: error.message })
      skipped += batch.length
    }
  } else {
    inserted += data?.length ?? batch.length
    console.log(`  ✓  Batch ${Math.floor(i / BATCH) + 1}: upserted ${data?.length ?? batch.length} rows`)
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
const withImage    = rows.filter(r => r.image_url).length
const withoutImage = rows.filter(r => !r.image_url).length

console.log('\n── Summary ─────────────────────────────────────────')
console.log(`   Total recipes:        ${recipes.length}`)
console.log(`   Inserted / upserted:  ${inserted}`)
console.log(`   Skipped (errors):     ${skipped}`)
console.log(`   With image URL:       ${withImage}`)
console.log(`   Without image URL:    ${withoutImage}`)
console.log(`   Source tag:           layalina`)
if (errors.length) {
  console.log(`   Errors:`)
  errors.forEach(e => console.log(`     • Batch ${e.batch}: ${e.error}`))
} else {
  console.log(`   Errors:               0`)
}
console.log()
