#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const SB_URL = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGV0cXFsYmtnZ29qanZ4aGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA2NDY4NiwiZXhwIjoyMDk1NjQwNjg2fQ.PxaU3CWgXSVOAWz1llgCnFBDAu1W3baB2XwqtcB8hPY'
const sb = createClient(SB_URL, SB_KEY)

function cleanName(name) {
  return (name || '')
    .replace(/[\s,،-]*(بالفيديو|بالصور|خطوة بخطوة)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanIngredients(ingredients) {
  return (ingredients || [])
    .filter(ing => {
      if (!ing) return false
      const lower = ing.toLowerCase()
      return !lower.includes('فيديو') &&
        !lower.includes('شاهد') &&
        !lower.includes('اضغط') &&
        !lower.includes('للمشاهدة') &&
        !lower.includes('يوتيوب') &&
        !lower.includes('youtube') &&
        !lower.includes('http') &&
        !lower.includes('www') &&
        !lower.includes('.com')
    })
    .map(ing => ing.replace(/بالفيديو/g, '').trim())
    .filter(ing => ing.length > 2)
}

function cleanSteps(steps) {
  return (steps || [])
    .filter(step => {
      if (!step) return false
      const lower = step.toLowerCase()
      return !lower.includes('شاهد الفيديو') &&
        !lower.includes('اضغط هنا') &&
        !lower.includes('اضغطي هنا') &&
        !lower.includes('للمشاهدة') &&
        !lower.includes('يوتيوب') &&
        !lower.includes('youtube') &&
        !lower.includes('http') &&
        !lower.includes('www')
    })
    .map(step => step
      .replace(/بالفيديو/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    )
    .filter(step => step.length > 5)
}

async function main() {
  // Fetch all recipes — paginate if needed (Supabase default limit 1000)
  const { data: recipes, error } = await sb
    .from('recipes')
    .select('id, name, ingredients, steps')
    .order('id')
    .limit(2000)

  if (error) { console.error('Fetch error:', error.message); process.exit(1) }
  console.log(`Fetched ${recipes.length} recipes\n`)

  let totalUpdated = 0
  let totalIngredientsRemoved = 0
  let totalStepsRemoved = 0

  for (const recipe of recipes) {
    const newName        = cleanName(recipe.name)
    const newIngredients = cleanIngredients(recipe.ingredients)
    const newSteps       = cleanSteps(recipe.steps)

    const nameChanged        = newName !== recipe.name
    const ingredientsChanged = JSON.stringify(newIngredients) !== JSON.stringify(recipe.ingredients || [])
    const stepsChanged       = JSON.stringify(newSteps)       !== JSON.stringify(recipe.steps       || [])

    if (!nameChanged && !ingredientsChanged && !stepsChanged) continue

    const ingRemoved  = (recipe.ingredients?.length || 0) - newIngredients.length
    const stepRemoved = (recipe.steps?.length       || 0) - newSteps.length

    // Build update payload — only changed fields
    const update = {}
    if (nameChanged)        update.name        = newName
    if (ingredientsChanged) update.ingredients = newIngredients
    if (stepsChanged)       update.steps       = newSteps

    const { error: upErr } = await sb.from('recipes').update(update).eq('id', recipe.id)

    if (upErr) {
      console.error(`  ✗ [${recipe.id}] "${recipe.name}" — ${upErr.message}`)
      continue
    }

    totalUpdated++
    totalIngredientsRemoved += ingRemoved
    totalStepsRemoved       += stepRemoved

    const label = nameChanged ? `"${recipe.name}" → "${newName}"` : `"${recipe.name}"`
    console.log(`✅ ${label}`)
    if (ingRemoved  > 0) console.log(`   ingredients: removed ${ingRemoved} video ref(s)`)
    if (stepRemoved > 0) console.log(`   steps:       removed ${stepRemoved} video ref(s)`)
    if (!nameChanged && ingRemoved === 0 && stepRemoved === 0) {
      // whitespace-only normalisation
      console.log(`   (whitespace / artifact normalisation)`)
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total recipes checked:            ${recipes.length}
Total recipes updated:            ${totalUpdated}
Total ingredient lines removed:   ${totalIngredientsRemoved}
Total step lines removed:         ${totalStepsRemoved}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(e => { console.error(e); process.exit(1) })
