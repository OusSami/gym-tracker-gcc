#!/usr/bin/env node
/**
 * import_new_recipes.mjs
 * Inserts only NEW Sayidaty recipes — skips any name already in the DB.
 * Uses upsert with ignoreDuplicates: true so existing rows are untouched.
 *
 * Usage: node import_new_recipes.mjs
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

// ── Load data ─────────────────────────────────────────────────────────────────
const { recipes } = JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf8'))
const urlMap      = JSON.parse(fs.readFileSync(URL_MAP_FILE, 'utf8'))

console.log(`\n📦  ${recipes.length} recipes in recipes_clean.json`)
console.log(`🗺   ${Object.keys(urlMap).length} entries in image_url_map.json\n`)

// ── Supabase client ──────────────────────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ── Build rows ────────────────────────────────────────────────────────────────
function resolveImageUrl(r) {
  if (r.image_local) {
    const basename = r.image_local.replace(/^.*[\\/]/, '')
    if (urlMap[basename]) return urlMap[basename]
  }
  return r.image_url ?? null
}

const rows = recipes.map(r => ({
  name:        r.name,
  image_url:   resolveImageUrl(r),
  cook_time:   r.cook_time  ?? null,
  servings:    r.servings   ?? null,
  ingredients: r.ingredients ?? [],
  steps:       r.steps      ?? [],
  source:      'sayidaty',
}))

// ── Upsert in batches of 50 (ignoreDuplicates skips existing names) ───────────
const BATCH    = 50
let inserted   = 0
let skipped    = 0
const errors   = []

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH)
  const batchNum = Math.floor(i / BATCH) + 1

  const { data, error } = await supabase
    .from('recipes')
    .upsert(batch, { onConflict: 'name', ignoreDuplicates: true })
    .select('id')

  if (error) {
    // No unique index on name — fall back to checking each row individually
    if (error.message.includes('unique') || error.message.includes('constraint') || error.message.includes('onConflict')) {
      console.warn(`  ⚠️  Batch ${batchNum}: no unique index on name — inserting row-by-row`)
      for (const row of batch) {
        const { data: existing } = await supabase
          .from('recipes')
          .select('id')
          .eq('name', row.name)
          .maybeSingle()
        if (existing) {
          skipped++
        } else {
          const { error: insErr } = await supabase.from('recipes').insert(row)
          if (insErr) {
            errors.push({ name: row.name, error: insErr.message })
          } else {
            inserted++
          }
        }
      }
    } else {
      console.error(`  ❌  Batch ${batchNum}: ${error.message}`)
      errors.push({ name: `batch-${batchNum}`, error: error.message })
    }
  } else {
    // data contains only the rows that were actually inserted (not skipped)
    const insertedCount = data?.length ?? 0
    const skippedCount  = batch.length - insertedCount
    inserted += insertedCount
    skipped  += skippedCount
    console.log(`  ✓  Batch ${batchNum}: inserted ${insertedCount}, skipped ${skippedCount} (already existed)`)
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
const withImage    = rows.filter(r => r.image_url).length
const withoutImage = rows.filter(r => !r.image_url).length

console.log('\n── Summary ─────────────────────────────────────────')
console.log(`   Total in clean file:   ${recipes.length}`)
console.log(`   Inserted (new):        ${inserted}`)
console.log(`   Skipped (existed):     ${skipped}`)
console.log(`   Errors:                ${errors.length}`)
console.log(`   With image:            ${withImage}`)
console.log(`   Without image:         ${withoutImage}`)
if (errors.length) errors.forEach(e => console.log(`     • ${e.name}: ${e.error}`))
console.log()
