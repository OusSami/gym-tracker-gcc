#!/usr/bin/env node
/**
 * clean_breakfast.mjs
 * Cleans new_batch_recipes.json (same logic as clean_recipes.mjs)
 * Input:  data/new_batch_recipes.json
 * Output: data/new_batch_clean.json
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR   = path.join(__dirname, 'data')
const INPUT      = path.join(DATA_DIR, 'new_batch_recipes.json')
const OUTPUT     = path.join(DATA_DIR, 'new_batch_clean.json')
const IMAGES_DIR = path.join(DATA_DIR, 'new_batch_images')

const raw     = JSON.parse(fs.readFileSync(INPUT, 'utf8'))
const recipes = raw.recipes.map(r => ({ ...r }))

let stats = { cookTimeNulled: 0, namesStripped: 0, imagePathFixed: 0, imageLocalNulled: 0, namesDeduped: 0 }

// 1. Clean cook_time & servings
for (const r of recipes) {
  const ct = (r.cook_time ?? '').split('\n')[1]?.trim() ?? ''
  if (!ct || ct === '0 دقيقة' || ct === '0') {
    r.cook_time = null
    stats.cookTimeNulled++
  } else {
    r.cook_time = ct
  }
  const sv = (r.servings ?? '').split('\n')[1]?.trim() ?? ''
  r.servings = sv || null
}

// 2. Strip trailing suffixes
for (const r of recipes) {
  const before = r.name
  r.name = r.name
    .replace(/[\s-]*(خطوة بخطوة بالصور|خطوة بخطوة|بالصور)\s*$/g, '')
    .trim()
    .replace(/[\s-]*بالفيديو\s*$/g, '')
    .trim()
  if (r.name !== before) stats.namesStripped++
}

// 3. Normalize image_local extension + existence check
for (const r of recipes) {
  if (!r.image_local) continue
  const normalized = r.image_local.replace(/\.(JPG|JPEG|PNG|WEBP)$/i, ext => ext.toLowerCase())
  const filename   = path.basename(normalized)
  const absPath    = path.join(IMAGES_DIR, filename)

  if (fs.existsSync(absPath)) {
    if (normalized !== r.image_local) { r.image_local = normalized; stats.imagePathFixed++ }
  } else {
    r.image_local = null
    stats.imageLocalNulled++
  }
}

// 4. Deduplicate names
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

const output = { ...raw, cleaned_at: new Date().toISOString(), total: recipes.length, recipes }
fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf8')

console.log('\n✅  Breakfast clean complete')
console.log(`   Output:               ${OUTPUT}`)
console.log(`   Total recipes:        ${recipes.length}`)
console.log(`   cook_time nulled:     ${stats.cookTimeNulled}`)
console.log(`   names stripped:       ${stats.namesStripped}`)
console.log(`   image_local fixed:    ${stats.imagePathFixed}`)
console.log(`   image_local nulled:   ${stats.imageLocalNulled}`)
console.log(`   names deduplicated:   ${stats.namesDeduped}`)
console.log()
