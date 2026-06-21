#!/usr/bin/env node
/**
 * clean_recipes.mjs
 * Cleans the raw Layalina recipe dump and writes recipes_clean.json.
 *
 * Key differences from Sayidaty:
 *  - cook_time is already a clean string (no \n split needed)
 *  - servings has double spaces ("4  اشخاص") → normalize
 *  - image_local uses "data/images/" prefix → strip with path.basename()
 *  - Extra "calories" field (string) → dropped from output
 *  - Adds source: 'layalina' to every recipe
 *  - Cross-checks names against sayidaty recipes_clean.json to avoid collisions
 *
 * Usage:  node clean_recipes.mjs
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR   = path.join(__dirname, 'data')
const INPUT      = path.join(DATA_DIR, 'recipes.json')
const OUTPUT     = path.join(DATA_DIR, 'recipes_clean.json')
const IMAGES_DIR = path.join(DATA_DIR, 'images')

// Path to sayidaty clean output for cross-dataset dedup check
const SAYIDATY_CLEAN = path.join(__dirname, '..', 'sayidaty-scraper', 'data', 'recipes_clean.json')

// ── Load Sayidaty names for cross-dataset collision check ────────────────────
let sayidatyNames = new Set()
if (fs.existsSync(SAYIDATY_CLEAN)) {
  try {
    const say = JSON.parse(fs.readFileSync(SAYIDATY_CLEAN, 'utf8'))
    sayidatyNames = new Set((say.recipes ?? []).map(r => r.name))
    console.log(`ℹ️  Loaded ${sayidatyNames.size} Sayidaty names for cross-dataset dedup`)
  } catch {
    console.warn('⚠️  Could not load sayidaty recipes_clean.json — skipping cross-dataset check')
  }
} else {
  console.warn('⚠️  sayidaty-scraper/data/recipes_clean.json not found — skipping cross-dataset check')
}

// ── Load raw Layalina data ────────────────────────────────────────────────────
const raw     = JSON.parse(fs.readFileSync(INPUT, 'utf8'))
const recipes = (raw.recipes ?? raw).map(r => ({ ...r }))  // shallow clone

let stats = {
  cookTimeNulled:       0,
  servingsNormalized:   0,
  imagePathFixed:       0,   // uppercase extension → lowercase, file exists
  imageLocalNulled:     0,   // file not found on disk
  namesDeduped:         0,
  crossDatasetRenamed:  0,
  caloriesdDropped:     0,
}

// ── 1. Clean cook_time ────────────────────────────────────────────────────────
// Layalina cook_time is already a plain string (no \n prefix unlike Sayidaty).
for (const r of recipes) {
  const ct = (r.cook_time ?? '').trim()
  if (!ct || ct === '0 دقيقة' || ct === '0') {
    r.cook_time = null
    stats.cookTimeNulled++
  } else {
    r.cook_time = ct
  }
}

// ── 2. Clean servings ─────────────────────────────────────────────────────────
// Values arrive as "4  اشخاص" (double space) — collapse whitespace.
for (const r of recipes) {
  const sv = (r.servings ?? '').replace(/\s+/g, ' ').trim()
  if (!sv) {
    r.servings = null
  } else {
    if (r.servings !== sv) stats.servingsNormalized++
    r.servings = sv
  }
}

// ── 3. Normalize image_local ──────────────────────────────────────────────────
// image_local arrives as "data/images/filename.jpg" → extract basename,
// normalize extension to lowercase, check existence on disk.
for (const r of recipes) {
  if (!r.image_local) continue

  // Strip the leading path prefix (scraper stored relative path)
  const basename   = path.basename(r.image_local)
  const normalized = basename.replace(/\.(JPG|JPEG|PNG|WEBP)$/i, ext => ext.toLowerCase())
  const absPath    = path.join(IMAGES_DIR, normalized)
  const changed    = normalized !== basename

  if (fs.existsSync(absPath)) {
    r.image_local = normalized   // store just the filename
    if (changed) stats.imagePathFixed++
  } else {
    // Try original case as fallback
    const absFallback = path.join(IMAGES_DIR, basename)
    if (fs.existsSync(absFallback)) {
      r.image_local = basename
    } else {
      r.image_local = null
      stats.imageLocalNulled++
    }
  }
}

// ── 4. Drop non-DB fields ─────────────────────────────────────────────────────
// "calories" is a string like "420 سعرة حرارية" — recipes table has no such column.
// "url" is the source page URL — not stored in DB.
for (const r of recipes) {
  if ('calories' in r) {
    delete r.calories
    stats.caloriesdDropped++
  }
  delete r.url
  delete r.image_url  // Supabase Storage URL comes from upload step, not scraper CDN
}

// ── 5. Add source ─────────────────────────────────────────────────────────────
for (const r of recipes) {
  r.source = 'layalina'
}

// ── 6. Cross-dataset dedup against Sayidaty names ─────────────────────────────
// If a Layalina recipe name exactly matches a Sayidaty recipe, append (ليالينا)
// so both can coexist in the DB without a unique constraint collision.
for (const r of recipes) {
  if (sayidatyNames.has(r.name)) {
    r.name = `${r.name} (ليالينا)`
    stats.crossDatasetRenamed++
    console.log(`  ↔  Cross-dataset rename: ${r.name}`)
  }
}

// ── 7. Intra-dataset dedup ────────────────────────────────────────────────────
const nameCounts = {}
for (const r of recipes) {
  const n = r.name
  if (nameCounts[n] === undefined) {
    nameCounts[n] = 0
  } else {
    nameCounts[n]++
    r.name = `${n} (${nameCounts[n] + 1})`
    stats.namesDeduped++
  }
}

// ── 8. Write output ───────────────────────────────────────────────────────────
const output = {
  scraped_at:  raw.scraped_at ?? null,
  source:      'layalina',
  cleaned_at:  new Date().toISOString(),
  total:       recipes.length,
  recipes,
}
fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf8')

// ── 9. Summary ────────────────────────────────────────────────────────────────
console.log('\n✅ Layalina cleaning complete')
console.log(`   Output:                   ${OUTPUT}`)
console.log(`   Total recipes:            ${recipes.length}`)
console.log(`   cook_time nulled:         ${stats.cookTimeNulled}`)
console.log(`   servings normalized:      ${stats.servingsNormalized}`)
console.log(`   image_local case-fixed:   ${stats.imagePathFixed}  (file exists, ext lowercased)`)
console.log(`   image_local nulled:       ${stats.imageLocalNulled}  (file missing on disk)`)
console.log(`   calories field dropped:   ${stats.caloriesdDropped}`)
console.log(`   names deduped (intra):    ${stats.namesDeduped}`)
console.log(`   cross-dataset renamed:    ${stats.crossDatasetRenamed}  (Sayidaty collision)`)
console.log()
