#!/usr/bin/env node
/**
 * analyze_breakfast_coverage.mjs
 * Read-only audit: فطور category coverage and miscategorization check.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE  = path.join(__dirname, '..', '.env.local')

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
if (!SB_URL || !SB_KEY) { console.error('❌  Missing Supabase credentials'); process.exit(1) }

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ── 1. Fetch all فطور recipes ──────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════')
console.log('   BREAKFAST COVERAGE AUDIT')
console.log('══════════════════════════════════════════════════════════\n')

const { data: breakfastRecipes, error: err1 } = await supabase
  .from('recipes')
  .select('id, name, category, calories')
  .eq('category', 'فطور')
  .order('name')

if (err1) { console.error('❌', err1.message); process.exit(1) }

// ── 2. Print full list ─────────────────────────────────────────────────────
console.log(`📋  SECTION 1 — All فطور recipes (${breakfastRecipes.length} total)\n`)
breakfastRecipes.forEach((r, i) => {
  const cal = r.calories != null ? `${r.calories} cal` : 'no cal'
  console.log(`  ${String(i + 1).padStart(3, ' ')}. ${r.name.padEnd(50, ' ')}  [${cal}]`)
})

// ── 3. Miscategorized recipes that SHOULD be فطور ─────────────────────────
const { data: allRecipes, error: err2 } = await supabase
  .from('recipes')
  .select('id, name, category')
  .neq('category', 'فطور')
  .order('name')

if (err2) { console.error('❌', err2.message); process.exit(1) }

const breakfastKeywords = [
  'فطور', 'بيض', 'شوفان', 'تميس', 'مناقيش', 'فطيرة',
  'توست', 'صباح', 'إفطار', 'مافن', 'وافل', 'بان كيك',
  'كريب', 'غرانولا', 'موسلي',
]

const shouldBeBreakfast = allRecipes.filter(r =>
  breakfastKeywords.some(kw => r.name.includes(kw))
)

console.log(`\n══════════════════════════════════════════════════════════`)
console.log(`   SECTION 2 — Miscategorized (should be فطور)`)
console.log(`══════════════════════════════════════════════════════════\n`)

if (shouldBeBreakfast.length === 0) {
  console.log('  ✅  No miscategorized breakfast recipes found.')
} else {
  console.log(`  Found ${shouldBeBreakfast.length} recipe(s) that should probably be فطور:\n`)
  shouldBeBreakfast.forEach((r, i) => {
    const matched = breakfastKeywords.filter(kw => r.name.includes(kw)).join(', ')
    console.log(`  ${String(i + 1).padStart(3, ' ')}. [${r.category.padEnd(20)}]  ${r.name}`)
    console.log(`        matched keyword(s): ${matched}`)
  })
}

// ── 5. فطور recipes that look like they don't belong ─────────────────────
const wrongInBreakfast = [
  'كبسة', 'مجبوس', 'برياني', 'مندي', 'لحم', 'دجاج',
  'كيك حلو', 'تشيز كيك', 'بقلاوة',
]

const misplacedInBreakfast = breakfastRecipes.filter(r =>
  wrongInBreakfast.some(kw => r.name.includes(kw))
)

console.log(`\n══════════════════════════════════════════════════════════`)
console.log(`   SECTION 3 — Possibly misplaced IN فطور`)
console.log(`══════════════════════════════════════════════════════════\n`)

if (misplacedInBreakfast.length === 0) {
  console.log('  ✅  No obvious non-breakfast recipes found in فطور.\n')
} else {
  console.log(`  Found ${misplacedInBreakfast.length} recipe(s) that may not belong in فطور:\n`)
  misplacedInBreakfast.forEach((r, i) => {
    const matched = wrongInBreakfast.filter(kw => r.name.includes(kw)).join(', ')
    console.log(`  ${String(i + 1).padStart(3, ' ')}. ${r.name}`)
    console.log(`        suspicious keyword(s): ${matched}`)
  })
  console.log()
}

// ── 4. Summary ─────────────────────────────────────────────────────────────
console.log(`══════════════════════════════════════════════════════════`)
console.log(`   SUMMARY`)
console.log(`══════════════════════════════════════════════════════════\n`)
console.log(`  Total فطور recipes:                   ${breakfastRecipes.length}`)
console.log(`  Miscategorized (should be فطور):      ${shouldBeBreakfast.length}`)
console.log(`  Possibly misplaced IN فطور:           ${misplacedInBreakfast.length}`)

if (shouldBeBreakfast.length > 0) {
  console.log(`\n  💡 Recommendation: re-assign the ${shouldBeBreakfast.length} miscategorized`)
  console.log(`     recipe(s) above to category = 'فطور'.`)
  console.log(`     IDs: ${shouldBeBreakfast.map(r => r.id).join(', ')}`)
}
if (misplacedInBreakfast.length > 0) {
  console.log(`\n  ⚠️  Review the ${misplacedInBreakfast.length} recipe(s) flagged in SECTION 3`)
  console.log(`     and consider re-assigning them to a more appropriate category.`)
  console.log(`     IDs: ${misplacedInBreakfast.map(r => r.id).join(', ')}`)
}
console.log()
