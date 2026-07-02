#!/usr/bin/env node
/**
 * audit_calorie_scaling.mjs  — READ ONLY, no DB writes.
 *
 * Pulls 8 representative recipes and prints their stored nutrition values
 * alongside the raw ingredients array, so we can verify whether calories
 * was written as per-serving or as a whole-dish total.
 *
 * Also reports how estimate_nutrition.mjs handles the servings ÷ division.
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readEnv(filePath) {
  const env = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}
const env    = readEnv(path.join(__dirname, '..', '.env.local'))
const SB_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SB_KEY = env['SUPABASE_SERVICE_ROLE_KEY']
if (!SB_URL || !SB_KEY) { console.error('❌  Missing Supabase credentials'); process.exit(1) }

const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(SB_URL, SB_KEY)

const FIELDS = 'id, name, category, servings, ingredients, calories, cal_per_100g, protein_g, carbs_g, fat_g, nutrition_estimated_at'

// Helper: parse numeric serving count the same way estimate_nutrition.mjs does
function parseServings(s) {
  if (!s) return null
  const n = parseInt(String(s).replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).match(/(\d+)/)?.[1] ?? '', 10)
  return (n >= 1 && n <= 30) ? n : null
}

// ── Step 1: Pull the two named anchors ────────────────────────────────────
const NAMED = ['لفائف الدجاج بالصوص الأبيض', 'مجبوس تندوري']

const { data: namedRows } = await sb.from('recipes').select(FIELDS)
  .in('name', NAMED)

// ── Step 2: Pull a large set for category spread + servings bucketing ──────
const { data: pool } = await sb.from('recipes').select(FIELDS)
  .not('ingredients', 'is', null)
  .not('calories', 'is', null)
  .order('category')
  .limit(500)

if (!pool) { console.error('❌  Could not fetch recipe pool'); process.exit(1) }

// Bucket by parsed servings
const namedIds  = new Set((namedRows || []).map(r => r.id))
const available = pool.filter(r => !namedIds.has(r.id) && (r.ingredients || []).length > 0)

const bucket1or2  = available.filter(r => { const s = parseServings(r.servings); return s === 1 || s === 2 })
const bucket4     = available.filter(r => parseServings(r.servings) === 4)
const bucket6plus = available.filter(r => { const s = parseServings(r.servings); return s !== null && s >= 6 })

// Pick spread across categories — take first of each category encountered
function pickSpread(list, n) {
  const seen = new Set()
  const picked = []
  for (const r of list) {
    if (picked.length >= n) break
    if (!seen.has(r.category)) { seen.add(r.category); picked.push(r); continue }
  }
  // Fill remaining slots if not enough unique categories
  for (const r of list) {
    if (picked.length >= n) break
    if (!picked.includes(r)) picked.push(r)
  }
  return picked.slice(0, n)
}

const selected1or2  = pickSpread(bucket1or2,  2)
const selected4     = pickSpread(bucket4,     3)
const selected6plus = pickSpread(bucket6plus, 3)

// Merge: named anchors first, then fill remaining slots from buckets
const targetTotal = 8
const allSelected = [
  ...(namedRows || []),
  ...selected1or2,
  ...selected4,
  ...selected6plus,
].slice(0, targetTotal)

// De-duplicate by id
const seen = new Set()
const final = []
for (const r of allSelected) {
  if (!seen.has(r.id)) { seen.add(r.id); final.push(r) }
}

// ── Print results ──────────────────────────────────────────────────────────
const line = '═'.repeat(70)
console.log(`\n${line}`)
console.log('   CALORIE SCALING AUDIT  —  read-only, no DB changes')
console.log(`${line}\n`)

console.log(`Bucket sizes found in DB:`)
console.log(`  servings 1-2 : ${bucket1or2.length} recipes`)
console.log(`  servings 4   : ${bucket4.length} recipes`)
console.log(`  servings 6+  : ${bucket6plus.length} recipes`)
console.log(`  named anchors: ${(namedRows || []).length}/${NAMED.length} found (${NAMED.join(' / ')})`)
console.log(`\nSelected ${final.length} recipes for audit:\n`)

for (let i = 0; i < final.length; i++) {
  const r = final[i]
  const srv = parseServings(r.servings)
  const bucket =
    NAMED.includes(r.name)     ? 'ANCHOR'
    : srv === 1 || srv === 2   ? 'servings 1-2'
    : srv === 4                ? 'servings 4'
    : srv !== null && srv >= 6 ? 'servings 6+'
    : 'unknown'

  console.log(`${'─'.repeat(70)}`)
  console.log(`[${i + 1}/${final.length}]  ${bucket}`)
  console.log(`Name          : ${r.name}`)
  console.log(`Category      : ${r.category}`)
  console.log(`servings (raw): ${r.servings ?? 'NULL'}`)
  console.log(`servings (int): ${srv ?? '→ default 4'}`)
  console.log(`calories      : ${r.calories ?? 'NULL'} kcal  ← "per serving" per DB schema`)
  console.log(`cal_per_100g  : ${r.cal_per_100g ?? 'NULL'}`)
  console.log(`protein_g     : ${r.protein_g ?? 'NULL'}`)
  console.log(`carbs_g       : ${r.carbs_g ?? 'NULL'}`)
  console.log(`fat_g         : ${r.fat_g ?? 'NULL'}`)
  console.log(`estimated_at  : ${r.nutrition_estimated_at ?? 'NULL'}`)
  console.log(`ingredients   : (${(r.ingredients || []).length} items)`)
  for (const ing of (r.ingredients || [])) {
    console.log(`    • ${ing}`)
  }
  console.log()
}

// ── Section 2: estimate_nutrition.mjs analysis ────────────────────────────
console.log(`${line}`)
console.log('   ANALYSIS OF scripts/estimate_nutrition.mjs')
console.log(`${line}\n`)

console.log(`Q1: Does it parse a servings/people count from the recipe?
    YES.
    Line 67-71 defines parseServings(s):
        function parseServings(s) {
          if (!s) return 4
          const n = parseInt(toWestern(s).match(/(\\d+)/)?.[1] ?? '4', 10)
          return n >= 1 && n <= 30 ? n : 4
        }
    Line 478 calls it:
        const srv = parseServings(recipe.servings)
    If the field is null or contains no digit, it defaults to 4.

Q2: Does it divide total estimated calories by that count before writing?
    YES — always, for ingredient-based estimates.
    Lines 357-363 inside calcFromProfile():
        const perSrv = {
          calories:  Math.round(tot.cal / srv),    // ← explicit ÷ srv
          protein_g: Math.round(tot.prot  / srv * 10) / 10,
          carbs_g:   Math.round(tot.carbs / srv * 10) / 10,
          fat_g:     Math.round(tot.fat   / srv * 10) / 10,
          fiber_g:   Math.round(tot.fiber / srv * 10) / 10,
        }
    The quantity "tot.cal" is the WHOLE-DISH calorie total. Dividing by srv
    gives per-serving calories, which is what gets written to the DB.

Q3: Or does it write the total-dish estimate directly to 'calories'?
    NO — the fallback path (Category defaults, lines 488-499) writes the
    CAT_FALLBACK[category].calories value WITHOUT any srv division:
        perSrv = {
          calories:  fb.calories,   // ← flat, not divided
          ...
        }
    Those fallback values are already authored as per-serving medians
    (e.g. 'أرز ومجبوس': 520 cal) — so they are also per-serving.
    The fallback is triggered only when ingredients yield < 30 cal total
    (i.e. missing/unparseable ingredients).

CONCLUSION:
    The 'calories' column in public.recipes is ALWAYS written as a
    PER-SERVING value, regardless of which path was taken.

    RISK: If recipe.servings is null or unparseable, parseServings()
    defaults to 4. A recipe that actually serves 8 but has null servings
    will have its total dish calories divided by 4, not 8 — resulting in
    a calories figure that is TWICE the true per-serving value.
    The audit data above can confirm whether this is happening.
`)

console.log(`${line}`)
console.log('   END OF AUDIT — no data was modified')
console.log(`${line}\n`)
