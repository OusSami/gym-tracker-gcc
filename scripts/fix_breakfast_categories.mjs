#!/usr/bin/env node
/**
 * fix_breakfast_categories.mjs
 * Reassigns clearly-breakfast recipes to category = 'فطور'.
 * Excludes confirmed desserts: أم علي, فطيرة الفراولة.
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

// ── Step 1: Fetch candidates (mirrors the UPDATE WHERE clause) ─────────────
const keywords = [
  'مناقيش', 'تميس', 'فطير', 'توست', 'إفطار', 'مافن', 'وافل',
  'بان كيك', 'كريب', 'غرانولا', 'موسلي', 'بالقديد', 'لبنة',
  'بيض مقلي', 'بيض مخفوق', 'بيض بالطماطم', 'بيض بالجبن', 'بيض بالسجق',
  'أومليت', 'اومليت', 'شكشوكة',
]
const excluded = ['أم علي', 'فطيرة الفراولة']

const orFilter = keywords.map(kw => `name.ilike.*${kw}*`).join(',')

const { data: candidates, error: fetchErr } = await supabase
  .from('recipes')
  .select('id, name, category')
  .neq('category', 'فطور')
  .or(orFilter)
  .order('name')

if (fetchErr) { console.error('❌  Fetch error:', fetchErr.message); process.exit(1) }

const toUpdate = candidates.filter(r => !excluded.some(ex => r.name.includes(ex)))

console.log('\n══════════════════════════════════════════════════════════')
console.log('   fix_breakfast_categories.mjs')
console.log('══════════════════════════════════════════════════════════\n')
console.log(`📋  Candidates matched:  ${candidates.length}`)
console.log(`🚫  Excluded (desserts): ${candidates.length - toUpdate.length}`)
console.log(`✏️   Will update:         ${toUpdate.length}\n`)

toUpdate.forEach((r, i) => {
  console.log(`  ${String(i + 1).padStart(3)}. [${r.category.padEnd(20)}]  ${r.name}`)
})

// ── Step 2: Update in batches by ID ───────────────────────────────────────
const ids = toUpdate.map(r => r.id)

const { data: updated, error: updateErr } = await supabase
  .from('recipes')
  .update({ category: 'فطور' })
  .in('id', ids)
  .select('id')

if (updateErr) { console.error('\n❌  Update error:', updateErr.message); process.exit(1) }

console.log(`\n✅  Rows updated: ${updated?.length ?? ids.length}`)

// ── Step 3: Verify new فطور total ─────────────────────────────────────────
const { count, error: countErr } = await supabase
  .from('recipes')
  .select('*', { count: 'exact', head: true })
  .eq('category', 'فطور')

if (countErr) { console.error('❌  Count error:', countErr.message); process.exit(1) }

console.log(`📊  New total فطور recipes: ${count}`)
console.log()
