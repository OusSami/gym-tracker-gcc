#!/usr/bin/env node
/**
 * find_empty_recipes.mjs
 * FIX 6 (read-only): List all recipes with missing ingredients OR steps.
 * Does NOT modify anything.
 */

const SB_URL = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGV0cXFsYmtnZ29qanZ4aGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA2NDY4NiwiZXhwIjoyMDk1NjQwNjg2fQ.PxaU3CWgXSVOAWz1llgCnFBDAu1W3baB2XwqtcB8hPY'

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

const { data: recipes, error } = await supabase
  .from('recipes')
  .select('id, name, source, category, ingredients, steps, servings, cook_time')
  .order('category')

if (error) { console.error('❌', error.message); process.exit(1) }

const empty = recipes.filter(r => {
  const noIng   = !r.ingredients || r.ingredients.length === 0
  const noSteps = !r.steps || r.steps.length === 0
  return noIng || noSteps
})

console.log(`\n📋  Empty recipes: ${empty.length} / ${recipes.length} total\n`)

const byStatus = {
  both:       empty.filter(r => (!r.ingredients || r.ingredients.length === 0) && (!r.steps || r.steps.length === 0)),
  ingOnly:    empty.filter(r => (!r.ingredients || r.ingredients.length === 0) && (r.steps && r.steps.length > 0)),
  stepsOnly:  empty.filter(r => (r.ingredients && r.ingredients.length > 0) && (!r.steps || r.steps.length === 0)),
}

if (byStatus.both.length) {
  console.log(`\n❌  COMPLETELY EMPTY (no ingredients AND no steps) — ${byStatus.both.length} recipes:`)
  console.log(`${'─'.repeat(80)}`)
  for (const r of byStatus.both) {
    console.log(`  id:       ${r.id}`)
    console.log(`  name:     ${r.name}`)
    console.log(`  source:   ${r.source ?? 'unknown'}`)
    console.log(`  category: ${r.category}`)
    console.log(`  servings: ${r.servings ?? 'null'}  cook_time: ${r.cook_time ?? 'null'}`)
    console.log()
  }
}

if (byStatus.stepsOnly.length) {
  console.log(`\n⚠️   MISSING STEPS ONLY — ${byStatus.stepsOnly.length} recipes:`)
  console.log(`${'─'.repeat(80)}`)
  for (const r of byStatus.stepsOnly) {
    console.log(`  id: ${r.id}  |  "${r.name}"  |  source: ${r.source ?? 'unknown'}`)
  }
}

if (byStatus.ingOnly.length) {
  console.log(`\n⚠️   MISSING INGREDIENTS ONLY — ${byStatus.ingOnly.length} recipes:`)
  console.log(`${'─'.repeat(80)}`)
  for (const r of byStatus.ingOnly) {
    console.log(`  id: ${r.id}  |  "${r.name}"  |  source: ${r.source ?? 'unknown'}`)
  }
}

console.log(`\n── Summary ───────────────────────────────────────────────────`)
console.log(`  Completely empty (no ing + no steps): ${byStatus.both.length}`)
console.log(`  Missing steps only:                   ${byStatus.stepsOnly.length}`)
console.log(`  Missing ingredients only:             ${byStatus.ingOnly.length}`)
console.log(`  Total needing attention:              ${empty.length}`)
console.log(`\n  Action: Delete or re-scrape from source URL`)
console.log(`  ⚠️  No changes made — read-only report`)
