#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const SB_URL = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGV0cXFsYmtnZ29qanZ4aGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA2NDY4NiwiZXhwIjoyMDk1NjQwNjg2fQ.PxaU3CWgXSVOAWz1llgCnFBDAu1W3baB2XwqtcB8hPY'
const sb = createClient(SB_URL, SB_KEY)

const MEAL_CATEGORIES = {
  'الفطور':      ['فطور'],
  'الغداء':      ['أرز ومجبوس', 'دجاج', 'لحم', 'سمك ومأكولات بحرية', 'أطباق خليجية'],
  'وجبة خفيفة': ['حلويات', 'مقبلات', 'سلطة'],
  'العشاء':      ['دجاج', 'لحم', 'سمك ومأكولات بحرية', 'شوربة', 'سلطة', 'أرز ومجبوس', 'أطباق خليجية'],
}

async function main() {
  const { data: recipes, error } = await sb
    .from('recipes')
    .select('id, name, category, calories')
    .order('category')

  if (error) { console.error('Fetch error:', error.message); process.exit(1) }
  console.log(`\n📦 Total recipes fetched: ${recipes.length}\n`)

  // ── Category distribution ────────────────────────────────────────────────
  const catCount = {}
  for (const r of recipes) {
    const cat = r.category || '(no category)'
    catCount[cat] = (catCount[cat] || 0) + 1
  }
  const sortedCats = Object.entries(catCount).sort((a, b) => b[1] - a[1])

  console.log('══════════════════════════════════════════════════════')
  console.log('  CATEGORY DISTRIBUTION (all recipes)')
  console.log('══════════════════════════════════════════════════════')
  const needsMore = []
  for (const [cat, count] of sortedCats) {
    const pct   = ((count / recipes.length) * 100).toFixed(1)
    const flag  = count < 10 ? ' ⚠️  NEEDS MORE' : ''
    console.log(`  ${cat.padEnd(28)} ${String(count).padStart(3)} recipes  (${pct}%)${flag}`)
    if (count < 10) needsMore.push({ cat, count })
  }

  // ── Per meal type breakdown ───────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════')
  console.log('  MEAL TYPE COVERAGE')
  console.log('══════════════════════════════════════════════════════')

  for (const [mealTime, cats] of Object.entries(MEAL_CATEGORIES)) {
    const suitable = recipes.filter(r => cats.includes(r.category))
    const bySubCat = {}
    for (const r of suitable) {
      bySubCat[r.category] = (bySubCat[r.category] || 0) + 1
    }

    const statusIcon = suitable.length < 15 ? '⚠️ ' : suitable.length < 30 ? '🟡' : '✅'
    console.log(`\n${statusIcon}  ${mealTime}  (${suitable.length} recipes available)`)
    console.log(`   Categories: ${cats.join(' · ')}`)
    console.log('   Breakdown:')
    for (const cat of cats) {
      const n = bySubCat[cat] || 0
      const bar = '█'.repeat(Math.min(20, Math.round(n / 2))) || '·'
      console.log(`     ${cat.padEnd(26)} ${String(n).padStart(3)}  ${bar}`)
    }
    console.log('   Sample recipes:')
    suitable.slice(0, 5).forEach((r, i) =>
      console.log(`     ${i + 1}. ${r.name}${r.calories ? ' (' + r.calories + ' kcal)' : ''}`)
    )
  }

  // ── Recommendations ───────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════')
  console.log('  RECOMMENDATIONS')
  console.log('══════════════════════════════════════════════════════')

  if (needsMore.length === 0) {
    console.log('  ✅ All categories have ≥ 10 recipes — good coverage.')
  } else {
    console.log('  Categories with < 10 recipes (add more content):')
    for (const { cat, count } of needsMore.sort((a, b) => a.count - b.count)) {
      console.log(`    ▸ "${cat}" — only ${count} recipe(s)`)
    }
  }

  // Which meal type has weakest coverage?
  let weakest = null
  for (const [mealTime, cats] of Object.entries(MEAL_CATEGORIES)) {
    const n = recipes.filter(r => cats.includes(r.category)).length
    if (!weakest || n < weakest.n) weakest = { mealTime, n }
  }
  console.log(`\n  Weakest meal slot: "${weakest.mealTime}" (${weakest.n} suitable recipes)`)
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
