#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const SB_URL = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGV0cXFsYmtnZ29qanZ4aGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA2NDY4NiwiZXhwIjoyMDk1NjQwNjg2fQ.PxaU3CWgXSVOAWz1llgCnFBDAu1W3baB2XwqtcB8hPY'
const sb = createClient(SB_URL, SB_KEY)

function cleanName(name) {
  return name
    .replace(/[\s-]*بالفيديو[\s-]*/g, ' ')
    .replace(/[\s-]*بالصور[\s-]*/g, ' ')
    .replace(/[\s-]*خطوة بخطوة[\s-]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  // Fetch all recipes with scraper artifacts in the name
  const { data: recipes, error } = await sb
    .from('recipes')
    .select('id, name')
    .or('name.ilike.%بالفيديو%,name.ilike.%بالصور%,name.ilike.%خطوة بخطوة%')

  if (error) { console.error('Fetch error:', error.message); process.exit(1) }
  if (!recipes?.length) { console.log('No recipes to clean.'); return }

  console.log(`Found ${recipes.length} recipes with scraper artifacts\n`)

  let cleaned = 0
  for (const recipe of recipes) {
    const newName = cleanName(recipe.name)
    if (newName === recipe.name) continue

    const { error: upErr } = await sb
      .from('recipes')
      .update({ name: newName })
      .eq('id', recipe.id)

    if (upErr) {
      console.error(`  ✗ [${recipe.id}] ${upErr.message}`)
    } else {
      console.log(`  ${recipe.name}\n  → ${newName}\n`)
      cleaned++
    }
  }

  console.log(`\n✅ Done — ${cleaned} recipe name(s) cleaned.`)
}

main().catch(e => { console.error(e); process.exit(1) })
