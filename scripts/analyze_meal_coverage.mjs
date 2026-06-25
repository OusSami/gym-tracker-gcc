#!/usr/bin/env node
/**
 * analyze_meal_coverage.mjs
 * Check how many recipes in public.recipes cover each Arabic meal type.
 * Run from gymapp/ directory:
 *   node scripts/analyze_meal_coverage.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SB_URL = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGV0cXFsYmtnZ29qanZ4aGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA2NDY4NiwiZXhwIjoyMDk1NjQwNjg2fQ.PxaU3CWgXSVOAWz1llgCnFBDAu1W3baB2XwqtcB8hPY'
const supabase = createClient(SB_URL, SB_KEY)

const MEAL_KEYWORDS = {
  'فطور (BREAKFAST)': ['بيض','فول','فلافل','فطور','تمر','خبز','لبن','جبن','جبنة','شاي','قهوة','عسل','زيتون','حمص','لبنة','شكشوكة','أومليت','عجة','كورن فليكس','شوفان','أوتس'],
  'غداء (LUNCH)':    ['كبسة','مجبوس','مندي','دجاج','لحم','أرز','رز','سمك','قوزي','مطازيز','هنيني','برياني','بخاري','زربيان','مقلوبة','قبولي','جريش','هريسة','باستا','معكرونة','مكرونة','مرق','ربيان','جمبري','هامور'],
  'وجبة خفيفة (SNACK)': ['تمر','مكسرات','فاكهة','موز','تفاح','لوز','حلوى','حلا','كيك','لقيمات','بسبوسة','كنافة','مهلبية','بقلاوة','سحلب','كوكيز','براونيز','تشيز','وافل','دونات','سموذي','عصير','يوغرت'],
  'عشاء (DINNER)':   ['شوربة','حساء','سلطة','تبولة','فتوش','خضار','تونة','دجاج','سمك','بيض','جبنة','لبن','خبز أسمر','متبل','بابا غنوج','حمص'],
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════')
  console.log('  تحليل تغطية الوصفات لكل نوع وجبة')
  console.log('══════════════════════════════════════════════════════\n')

  // Fetch all recipes
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, name, category, calories, ingredients')
    .order('name', { ascending: true })

  if (error) {
    console.error('❌ Failed to fetch recipes:', error.message)
    process.exit(1)
  }

  console.log(`📦 Total recipes in DB: ${recipes.length}\n`)

  const results = {}

  for (const [mealType, keywords] of Object.entries(MEAL_KEYWORDS)) {
    const matched = recipes.filter(r => {
      const name = r.name || ''
      const category = r.category || ''
      const ingredients = Array.isArray(r.ingredients)
        ? r.ingredients.join(' ')
        : (typeof r.ingredients === 'string' ? r.ingredients : '')
      const haystack = `${name} ${category} ${ingredients}`
      return keywords.some(kw => haystack.includes(kw))
    })

    results[mealType] = matched
  }

  // Print per-meal analysis
  for (const [mealType, matched] of Object.entries(results)) {
    const pct = ((matched.length / recipes.length) * 100).toFixed(1)
    console.log(`────────────────────────────────────────────────────`)
    console.log(`🍽️  ${mealType}`)
    console.log(`   Count:   ${matched.length} recipes  (${pct}% of total)`)

    if (matched.length === 0) {
      console.log(`   ⚠️  GAP: No recipes matched — meal type has NO coverage!`)
    } else if (matched.length < 5) {
      console.log(`   ⚠️  GAP: Very low coverage (< 5 recipes). Needs more data.`)
    } else if (matched.length < 15) {
      console.log(`   ⚠️  THIN: Low variety (${matched.length} recipes). Consider adding more.`)
    } else {
      console.log(`   ✅  Good coverage`)
    }

    console.log(`\n   First 10 matches:`)
    matched.slice(0, 10).forEach((r, i) => {
      const cal = r.calories ? ` (${r.calories} kcal)` : ''
      const cat = r.category ? ` [${r.category}]` : ''
      console.log(`     ${i + 1}. ${r.name}${cal}${cat}`)
    })
    console.log()
  }

  // Summary
  console.log('══════════════════════════════════════════════════════')
  console.log('  ملخص التغطية')
  console.log('══════════════════════════════════════════════════════')
  for (const [mealType, matched] of Object.entries(results)) {
    const status = matched.length === 0 ? '❌ GAP' : matched.length < 5 ? '⚠️  LOW' : matched.length < 15 ? '🟡 THIN' : '✅ OK'
    console.log(`  ${status}  ${mealType.padEnd(30)} → ${matched.length} recipes`)
  }

  // Total unique coverage
  const allMatched = new Set()
  Object.values(results).forEach(arr => arr.forEach(r => allMatched.add(r.id)))
  const uncovered = recipes.filter(r => !allMatched.has(r.id))

  console.log(`\n  Total matched (union): ${allMatched.size} / ${recipes.length}`)
  console.log(`  Uncategorized recipes: ${uncovered.length}`)
  if (uncovered.length > 0) {
    console.log('\n  Sample uncategorized:')
    uncovered.slice(0, 10).forEach((r, i) => {
      console.log(`    ${i + 1}. ${r.name} [${r.category || '—'}]`)
    })
  }
  console.log()
}

main().catch(err => { console.error(err); process.exit(1) })
