#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const SB_URL = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGV0cXFsYmtnZ29qanZ4aGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA2NDY4NiwiZXhwIjoyMDk1NjQwNjg2fQ.PxaU3CWgXSVOAWz1llgCnFBDAu1W3baB2XwqtcB8hPY'
const sb = createClient(SB_URL, SB_KEY)

async function main() {
  const { data: stuck, error } = await sb
    .from('recipes')
    .select('id, name')
    .or('name.ilike.%بالفيديو%,name.ilike.%بالصور%,name.ilike.%خطوة بخطوة%')
    .order('name')

  if (error) { console.error('Fetch error:', error.message); process.exit(1) }

  if (!stuck?.length) {
    console.log('No artifact-named recipes found — DB is clean.')
    return
  }

  console.log(`Found ${stuck.length} stuck duplicate(s):\n`)
  for (const r of stuck) {
    console.log(`  🗑️  "${r.name}" (id: ${r.id})`)
  }

  const ids = stuck.map(r => r.id)
  const { error: delErr } = await sb.from('recipes').delete().in('id', ids)
  if (delErr) { console.error('\nDelete error:', delErr.message); process.exit(1) }

  const { count } = await sb.from('recipes').select('id', { count: 'exact', head: true })

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total deleted:           ${stuck.length}
Total recipes remaining: ${count}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(e => { console.error(e); process.exit(1) })
