#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR   = path.join(__dirname, 'data')
const INPUT      = path.join(DATA_DIR, 'recipes.json')
const OUTPUT     = path.join(DATA_DIR, 'recipes_clean.json')
const IMAGES_DIR = path.join(DATA_DIR, 'images')

const raw = JSON.parse(fs.readFileSync(INPUT, 'utf8'))
const recipes = raw.recipes.map(r => ({ ...r }))   // shallow clone each record

let stats = {
  cookTimeNulled:    0,
  namesStripped:     0,   // trailing suffix removed
  imagePathFixed:    0,   // case-normalized (still exists)
  imageLocalNulled:  0,   // file not found on disk
  namesDeduped:      0,
}

// ── 1. Clean cook_time & servings ────────────────────────────────────────────
for (const r of recipes) {
  // cook_time
  const ct = (r.cook_time ?? '').split('\n')[1]?.trim() ?? ''
  if (!ct || ct === '0 دقيقة' || ct === '0') {
    r.cook_time = null
    stats.cookTimeNulled++
  } else {
    r.cook_time = ct
  }

  // servings
  const sv = (r.servings ?? '').split('\n')[1]?.trim() ?? ''
  r.servings = sv || null
}

// ── 2. Strip trailing suffixes from recipe names ─────────────────────────────
// Patterns added by the scraper that aren't part of the real dish name.
// Order matters: longest match first.
// بالفيديو is only stripped when it trails the name, not mid-name.
for (const r of recipes) {
  const before = r.name
  r.name = r.name
    .replace(/[\s-]*(خطوة بخطوة بالصور|خطوة بخطوة|بالصور)\s*$/g, '')
    .trim()
  r.name = r.name
    .replace(/[\s-]*بالفيديو\s*$/g, '')
    .trim()
  if (r.name !== before) stats.namesStripped++
}

// ── 3. Normalize image_local extension case + existence check ────────────────
for (const r of recipes) {
  if (!r.image_local) continue

  // Normalize extension to lowercase
  const normalized = r.image_local.replace(/\.(JPG|JPEG|PNG|WEBP)$/i, ext => ext.toLowerCase())
  const changed = normalized !== r.image_local

  // Resolve to absolute path
  const filename = path.basename(normalized)
  const absPath  = path.join(IMAGES_DIR, filename)

  if (fs.existsSync(absPath)) {
    if (changed) {
      r.image_local = normalized
      stats.imagePathFixed++
    }
  } else {
    // File missing — null out image_local, keep image_url as fallback
    r.image_local = null
    stats.imageLocalNulled++
  }
}

// ── 4. Deduplicate names ─────────────────────────────────────────────────────
// Runs after stripping so post-strip collisions are caught here.
const nameCounts = {}
for (const r of recipes) {
  const n = r.name
  if (nameCounts[n] === undefined) {
    nameCounts[n] = 0   // first occurrence index
  } else {
    nameCounts[n]++
    r.name = `${n} (${nameCounts[n] + 1})`
    stats.namesDeduped++
  }
}

// ── 5. Write output ──────────────────────────────────────────────────────────
const output = {
  ...raw,
  cleaned_at: new Date().toISOString(),
  total: recipes.length,
  recipes,
}
fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf8')

// ── 6. Summary ───────────────────────────────────────────────────────────────
console.log('\n✅ Cleaning complete')
console.log(`   Output:               ${OUTPUT}`)
console.log(`   Total recipes:        ${recipes.length}`)
console.log(`   cook_time nulled:     ${stats.cookTimeNulled}`)
console.log(`   names stripped:       ${stats.namesStripped}  (trailing suffix removed)`)
console.log(`   image_local fixed:    ${stats.imagePathFixed}  (case-normalized, file exists)`)
console.log(`   image_local nulled:   ${stats.imageLocalNulled}  (file missing on disk)`)
console.log(`   names deduplicated:   ${stats.namesDeduped}  (post-strip collisions)`)
console.log()
