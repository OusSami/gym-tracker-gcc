#!/usr/bin/env node
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE  = path.join(__dirname, '..', '.env.local')

function readEnv(f) {
  const env = {}
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}
const env    = readEnv(ENV_FILE)
const SB_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SB_KEY = env['SUPABASE_SERVICE_ROLE_KEY']

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ── PART 1 — nutrition columns probe ─────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════')
console.log('  PART 1 — nutrition column existence check')
console.log('══════════════════════════════════════════════════════════\n')

const { data: samples, error: samplesErr } = await supabase
  .from('recipes')
  .select('id, name, cook_time, servings, ingredients, calories, protein_g, carbs_g, fat_g')
  .limit(10)

if (samplesErr) {
  console.log('❌ Query error:', samplesErr.message)
  console.log('   Code:', samplesErr.code)
} else {
  console.log(`✅ Query succeeded — ${samples.length} rows`)
  if (samples.length > 0) {
    const row = samples[0]
    console.log('Keys in row:', Object.keys(row).join(', '))
    for (const f of ['calories', 'protein_g', 'carbs_g', 'fat_g']) {
      console.log(`  ${f}: ${ f in row ? `EXISTS → ${row[f] ?? 'NULL'}` : 'NOT RETURNED' }`)
    }
  }
}

// ── PART 2 — full schema via select * ────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════')
console.log('  PART 2 — all columns in recipes table')
console.log('══════════════════════════════════════════════════════════\n')

const { data: fullRows, error: fullErr } = await supabase
  .from('recipes')
  .select('*')
  .limit(1)

if (fullErr) {
  console.log('❌', fullErr.message)
} else if (fullRows?.length) {
  const row = fullRows[0]
  const cols = Object.keys(row)
  console.log(`Total columns: ${cols.length}\n`)
  cols.forEach((c, i) => {
    const val = row[c]
    let type
    if (val === null)                   type = 'NULL'
    else if (Array.isArray(val))        type = `array[${val.length}]`
    else if (typeof val === 'object')   type = 'object'
    else                                type = `${typeof val} → ${String(val).slice(0, 60)}`
    console.log(`  ${String(i + 1).padStart(2)}. ${c.padEnd(28)} ${type}`)
  })
}

// ── PART 3 — 3 full recipe samples ───────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════')
console.log('  PART 3 — 3 sample recipes (full data)')
console.log('══════════════════════════════════════════════════════════\n')

const { data: three, error: threeErr } = await supabase
  .from('recipes')
  .select('*')
  .limit(3)

if (threeErr) {
  console.log('❌', threeErr.message)
} else {
  three.forEach((r, i) => {
    console.log(`─── Recipe ${i + 1}: ${r.name} ───`)
    const allKeys = Object.keys(r)
    allKeys.forEach(k => {
      if (k === 'ingredients' || k === 'steps') return
      console.log(`  ${k.padEnd(20)} ${r[k] ?? 'NULL'}`)
    })
    const ings = Array.isArray(r.ingredients) ? r.ingredients : []
    console.log(`  ingredients (${ings.length} total):`)
    ings.slice(0, 5).forEach((ing, j) => console.log(`    ${j + 1}. ${ing}`))
    const steps = Array.isArray(r.steps) ? r.steps : []
    console.log(`  steps count: ${steps.length}`)
    console.log()
  })
}
