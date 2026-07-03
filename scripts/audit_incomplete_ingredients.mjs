/**
 * audit_incomplete_ingredients.mjs — Stage 4 diagnostic
 *
 * READ-ONLY. No DB writes. No data modifications.
 *
 * For each recipe, extracts ingredient types implied by the recipe NAME,
 * then checks whether the ingredients array actually contains matching items.
 * Flags recipes where the name promises an ingredient that's absent.
 *
 * Output: total scanned, flagged count, full list + source breakdown.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Supabase bootstrap ───────────────────────────────────────────────────────

function readEnvFile(f) {
  const env = {}
  if (!fs.existsSync(f)) return env
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const envLocal = readEnvFile(path.join(__dirname, '..', '.env.local'))
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || envLocal['NEXT_PUBLIC_SUPABASE_URL']
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envLocal['SUPABASE_SERVICE_ROLE_KEY']
const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(SB_URL, SB_KEY)

// ── Core type definitions ────────────────────────────────────────────────────
//
// Each entry has:
//   type     — canonical type name
//   nameKw   — keywords that, when found in the RECIPE NAME, imply this type is an ingredient
//   ingKw    — keywords that, when found in an INGREDIENT STRING, confirm this type is present
//
// Ordering matters for the name scan (first match wins, but we accumulate ALL matching types).

const CORE_TYPES = [
  {
    type: 'chicken',
    nameKw: ['دجاج', 'فراخ', 'فرخة', 'دجاجة'],
    ingKw:  ['دجاج', 'دجاجة', 'فراخ', 'فرخة', 'صدر دجاج', 'فيليه دجاج'],
  },
  {
    type: 'meat',
    nameKw: ['لحم', 'لحمة', 'كفتة', 'كفته', 'هبرة', 'كبدة', 'مفروم'],
    ingKw:  ['لحم', 'لحمة', 'لحوم', 'عجل', 'ضأن', 'خروف', 'ضلع', 'كبدة', 'هبرة', 'كفتة', 'كفته', 'مفروم'],
  },
  {
    type: 'fish',
    nameKw: ['سمك', 'هامور', 'سلمون', 'تونة', 'بلطي', 'ميرو', 'حبار', 'لقز', 'قبقب'],
    ingKw:  ['سمك', 'هامور', 'ميرو', 'بلطي', 'تونة', 'سردين', 'فيليه سمك', 'حبار', 'سلمون', 'لقز', 'قبقب'],
  },
  {
    type: 'shrimp',
    nameKw: ['جمبري', 'روبيان', 'ربيان', 'قريدس'],
    ingKw:  ['ربيان', 'روبيان', 'جمبري', 'قريدس', 'كروفيتاس'],
  },
  {
    type: 'egg',
    // 'بيض' is a substring of 'أبيض' (white, masc.) and 'بيضاء' (white, fem.).
    // Both are handled by nameHasType() exclusion below.
    nameKw: ['بيض', 'بيضة', 'بيضات', 'عجة', 'أومليت', 'أوملت'],
    ingKw:  ['بيض', 'بيضة', 'بيضات'],
  },
  {
    type: 'lentil',
    nameKw: ['عدس'],
    ingKw:  ['عدس'],
  },
  {
    type: 'chickpea',
    // 'حمص' is a substring of 'محمص' (roasted, adj.).
    // Handled by nameHasType() exclusion below.
    nameKw: ['حمص'],
    ingKw:  ['حمص'],
  },
  {
    type: 'rice',
    nameKw: ['أرز', 'رز'],
    ingKw:  ['أرز', 'رز'],
  },
  {
    type: 'pasta',
    nameKw: ['معكرونة', 'مكرونة', 'سباغيتي', 'باستا', 'لازانيا'],
    ingKw:  ['معكرونة', 'مكرونة', 'سباغيتي', 'باستا', 'لازانيا', 'فرموتشيني'],
  },
  {
    type: 'cheese',
    nameKw: ['جبنة', 'جبن', 'موزاريلا', 'شيدر'],
    ingKw:  ['جبنة', 'جبن', 'موزاريلا', 'شيدر', 'كريم تشيز'],
  },
  {
    type: 'shrimp_alt',  // Alternative spelling used mostly in GCC recipes
    nameKw: ['جمبري', 'كروفيتاس'],
    ingKw:  ['جمبري', 'كروفيتاس'],
  },
]

// ── False-positive exclusions ────────────────────────────────────────────────
//
// Some Arabic words are substrings of unrelated words in recipe names:
//   'بيض' ⊂ 'أبيض' (white, masc.)  — "أرز أبيض" = white rice, not an egg dish
//   'بيض' ⊂ 'بيضاء' (white, fem.)  — "صوص بيضاء" = white sauce
//   'حمص' ⊂ 'محمص' (roasted adj.)  — "فريكة محمصة" = roasted frikeh, not chickpea

/**
 * Returns the types implied by a recipe name, filtering out known false positives.
 * Accumulates ALL matching types (not first-match-wins).
 *
 * Known substring false positives handled here:
 *   'ربيان' (shrimp) ⊂ 'زربيان' (a rice dish) → exclude زربيان
 *   'لحم'   (meat)   ⊂ 'الحمص' (chickpea w/ article) → exclude حمص forms
 *   'بيض'   (egg)    ⊂ 'أبيض'/'بيضاء' (white colour) → strip colour words
 *   'حمص'   (chickpea) ⊂ 'محمص' (roasted adj.) → strip adj. forms
 *   'بدون X' — recipe explicitly says "without X" → skip that type
 */
function typesFromName(name) {
  const found = []
  for (const ct of CORE_TYPES) {
    if (ct.type === 'shrimp_alt') continue  // merged into shrimp

    let effectiveName = name

    // 'ربيان' (shrimp) is a suffix of 'زربيان' (Gulf rice dish) and 'زرابيان'.
    if (ct.type === 'shrimp') {
      effectiveName = effectiveName.replace(/زربيان|زرابيان/g, '████')
    }

    // 'لحم' (meat) appears inside 'الحمص'/'بالحمص'/'الحمصة' due to ال+حمص.
    if (ct.type === 'meat') {
      effectiveName = effectiveName.replace(/[اب]?ل?حمص[ة]?/g, '████')
    }

    // 'بيض' exclusion: strip colour adjectives before checking
    if (ct.type === 'egg') {
      effectiveName = effectiveName.replace(/أبيض|بيضاء/g, '████')
    }

    // 'حمص' exclusion: strip 'محمص/محمصة' (roasted adj.) before checking
    if (ct.type === 'chickpea') {
      effectiveName = effectiveName.replace(/محمص[ة]?/g, '████')
    }

    // 'بدون X' — name explicitly says "without X"; skip this type
    const matchedKw = ct.nameKw.find(kw => effectiveName.includes(kw))
    if (!matchedKw) continue
    if (name.includes(`بدون ${matchedKw}`) || name.includes(`بدون ال${matchedKw}`)) continue

    found.push(ct.type)
  }
  return found
}

/**
 * Returns true if the ingredient array contains at least one item matching
 * the expected type (using ingKw of that type, plus shrimp_alt for shrimp).
 */
function ingHasType(type, ingredients) {
  const ct = CORE_TYPES.find(c => c.type === type)
  if (!ct) return false
  const kwList = ct.ingKw.slice()
  // Merge GCC-alternate shrimp keywords
  if (type === 'shrimp') {
    const alt = CORE_TYPES.find(c => c.type === 'shrimp_alt')
    if (alt) kwList.push(...alt.ingKw)
  }
  return ingredients.some(ing => kwList.some(kw => ing.includes(kw)))
}

// ── Fetch all recipes ────────────────────────────────────────────────────────

const PAGE = 500
let allRecipes = []
let from = 0
while (true) {
  const { data, error } = await sb
    .from('recipes')
    .select('id, name, ingredients, source')
    .range(from, from + PAGE - 1)

  if (error) { console.error('Fetch error:', error.message); process.exit(1) }
  if (!data?.length) break
  allRecipes.push(...data)
  if (data.length < PAGE) break
  from += PAGE
}

// ── Audit ────────────────────────────────────────────────────────────────────

const flagged = []

for (const recipe of allRecipes) {
  const name = recipe.name ?? ''
  const ings = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
  const source = recipe.source ?? 'unknown'

  const expectedTypes = typesFromName(name)
  if (expectedTypes.length === 0) continue

  const missingTypes = expectedTypes.filter(type => !ingHasType(type, ings))
  if (missingTypes.length === 0) continue

  flagged.push({
    id: recipe.id,
    name,
    source,
    missingTypes,
    expectedTypes,
    ingCount: ings.length,
    ings: ings.slice(0, 8),  // preview first 8
  })
}

// ── Output ───────────────────────────────────────────────────────────────────

const TYPE_LABEL = {
  chicken:  'دجاج (chicken)',
  meat:     'لحم (meat/beef)',
  fish:     'سمك (fish)',
  shrimp:   'جمبري/روبيان (shrimp)',
  egg:      'بيض (egg)',
  lentil:   'عدس (lentil)',
  chickpea: 'حمص (chickpea)',
  rice:     'أرز (rice)',
  pasta:    'معكرونة (pasta)',
  cheese:   'جبن (cheese)',
}

// Group by source
const bySource = {}
for (const f of flagged) {
  bySource[f.source] = (bySource[f.source] ?? [])
  bySource[f.source].push(f)
}

// Group by missing type (for breakdown)
const byType = {}
for (const f of flagged) {
  for (const t of f.missingTypes) {
    byType[t] = (byType[t] ?? 0) + 1
  }
}

console.log('═'.repeat(72))
console.log('  Audit: Incomplete Ingredient Arrays vs Recipe Names')
console.log('═'.repeat(72))
console.log()
console.log(`  Total recipes scanned : ${allRecipes.length}`)
console.log(`  Recipes with name hints: ${allRecipes.filter(r => typesFromName(r.name ?? '').length > 0).length}`)
console.log(`  Flagged (missing type) : ${flagged.length}`)
console.log()

// Source breakdown
console.log('  Breakdown by source:')
const sourceOrder = ['layalina', 'sayidaty', 'manual', 'unknown']
for (const src of [...sourceOrder, ...Object.keys(bySource).filter(s => !sourceOrder.includes(s))]) {
  if (bySource[src]) {
    console.log(`    ${src.padEnd(12)} — ${bySource[src].length} flagged`)
  }
}
console.log()

// Breakdown by missing type
console.log('  Breakdown by missing ingredient type:')
const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1])
for (const [type, count] of typeEntries) {
  console.log(`    ${(TYPE_LABEL[type] ?? type).padEnd(28)} — ${count}`)
}
console.log()

// Full flagged list, sorted by source then name
const sorted = flagged.slice().sort((a, b) =>
  a.source.localeCompare(b.source) || a.name.localeCompare(b.name)
)

console.log('─'.repeat(72))
console.log('  Flagged recipes (full list)')
console.log('─'.repeat(72))
console.log()

let prevSource = null
let idx = 1
for (const f of sorted) {
  if (f.source !== prevSource) {
    console.log(`  ── ${f.source} ─────────────────────────────────────────`)
    prevSource = f.source
  }
  const missing = f.missingTypes.map(t => TYPE_LABEL[t] ?? t).join(', ')
  console.log()
  console.log(`  [${String(idx).padStart(3)}] ${f.name}`)
  console.log(`        Missing  : ${missing}`)
  console.log(`        Ing count: ${f.ingCount}  (id: ${f.id})`)
  if (f.ings.length) {
    console.log(`        Ings[0-${Math.min(7, f.ings.length - 1)}]:`)
    for (const ing of f.ings) {
      console.log(`          • ${ing}`)
    }
  }
  idx++
}

console.log()
console.log('═'.repeat(72))
console.log('  READ-ONLY — no data was modified.')
console.log('═'.repeat(72))
