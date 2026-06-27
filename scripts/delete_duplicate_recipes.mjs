#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const SB_URL = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGV0cXFsYmtnZ29qanZ4aGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA2NDY4NiwiZXhwIjoyMDk1NjQwNjg2fQ.PxaU3CWgXSVOAWz1llgCnFBDAu1W3baB2XwqtcB8hPY'
const sb = createClient(SB_URL, SB_KEY)

async function main() {
  // Fetch all recipes ordered by name then created_at asc
  const { data: recipes, error } = await sb
    .from('recipes')
    .select('id, name, created_at')
    .order('name', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) { console.error('Fetch error:', error.message); process.exit(1) }
  console.log(`Fetched ${recipes.length} total recipes\n`)

  // Group by name — first entry per name is the keeper (oldest)
  const seen = new Map()
  const toDelete = []

  for (const recipe of recipes) {
    if (!seen.has(recipe.name)) {
      seen.set(recipe.name, recipe)
    } else {
      toDelete.push({ name: recipe.name, id: recipe.id, keepId: seen.get(recipe.name).id })
    }
  }

  if (!toDelete.length) {
    console.log('No duplicates found.')
    return
  }

  // Group deletes by name for readable output
  const byName = {}
  for (const entry of toDelete) {
    if (!byName[entry.name]) byName[entry.name] = { keepId: entry.keepId, deleteIds: [] }
    byName[entry.name].deleteIds.push(entry.id)
  }

  console.log(`Found ${toDelete.length} duplicate(s) across ${Object.keys(byName).length} name(s):\n`)
  for (const [name, info] of Object.entries(byName)) {
    console.log(`  "${name}"`)
    console.log(`    keep   → ${info.keepId}`)
    console.log(`    delete → ${info.deleteIds.join(', ')}`)
  }

  // Delete in batches of 50
  const deleteIds = toDelete.map(e => e.id)
  const BATCH = 50
  let deleted = 0
  for (let i = 0; i < deleteIds.length; i += BATCH) {
    const batch = deleteIds.slice(i, i + BATCH)
    const { error: delErr } = await sb.from('recipes').delete().in('id', batch)
    if (delErr) { console.error(`\nDelete error (batch ${i}):`, delErr.message) }
    else deleted += batch.length
  }

  // Count remaining
  const { count } = await sb.from('recipes').select('id', { count: 'exact', head: true })

  console.log(`\n✅ Done — ${deleted} duplicate(s) deleted. ${count} recipes remaining.`)
}

main().catch(e => { console.error(e); process.exit(1) })
