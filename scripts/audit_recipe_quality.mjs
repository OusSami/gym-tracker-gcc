#!/usr/bin/env node
/**
 * audit_recipe_quality.mjs
 * Read-only comprehensive quality check on all recipes.
 * Output saved to scripts/quality_audit_results.txt
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SB_URL = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGV0cXFsYmtnZ29qanZ4aGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA2NDY4NiwiZXhwIjoyMDk1NjQwNjg2fQ.PxaU3CWgXSVOAWz1llgCnFBDAu1W3baB2XwqtcB8hPY'

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ── Fetch ──────────────────────────────────────────────────────────────────
console.log('📥  Fetching all recipes…')
const { data: recipes, error } = await supabase
  .from('recipes')
  .select('id, name, source, category, cook_time, servings, ingredients, steps, calories, protein_g, carbs_g, fat_g, fiber_g, cal_per_100g, image_url')
  .order('created_at')

if (error) { console.error('❌', error.message); process.exit(1) }
console.log(`    ${recipes.length} recipes fetched\n`)

// ── Helpers ────────────────────────────────────────────────────────────────
const lines = []
function out(s = '') { console.log(s); lines.push(s) }

function recipeLabel(r) {
  return `"${(r.name ?? '').slice(0, 40)}" (id: ${r.id.slice(0, 8)})`
}

function extractFirstNumber(str) {
  if (!str) return null
  const m = String(str).match(/(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

// ── CHECK 1 — Missing / empty fields ──────────────────────────────────────
out('═══════════════════════════════════════════════════════════════')
out('CHECK 1 — Missing or empty fields')
out('═══════════════════════════════════════════════════════════════')

const c1Issues = []
for (const r of recipes) {
  const flags = []
  if (!r.name)                                          flags.push('name missing')
  if (!r.ingredients || r.ingredients.length < 2)      flags.push(`ingredients < 2 (${r.ingredients?.length ?? 0})`)
  if (!r.steps        || r.steps.length < 1)           flags.push(`steps < 1 (${r.steps?.length ?? 0})`)
  if (!r.image_url)                                    flags.push('image_url missing')
  if (!r.cook_time)                                    flags.push('cook_time missing')
  if (!r.servings)                                     flags.push('servings missing')
  if (!r.category)                                     flags.push('category missing')
  if (!r.calories || r.calories === 0)                 flags.push('calories null/0')
  if (r.protein_g == null)                             flags.push('protein_g null')
  if (r.carbs_g   == null)                             flags.push('carbs_g null')
  if (r.fat_g     == null)                             flags.push('fat_g null')
  if (flags.length) c1Issues.push({ r, flags })
}

if (c1Issues.length === 0) {
  out(`✅  Check 1 passed — ${recipes.length} recipes clean`)
} else {
  out(`⚠️   Check 1 — ${c1Issues.length} issues found:`)
  for (const { r, flags } of c1Issues) {
    out(`    ${recipeLabel(r)} — ${flags.join(' | ')}`)
  }
}

// ── CHECK 2 — Nutrition sanity ─────────────────────────────────────────────
out('')
out('═══════════════════════════════════════════════════════════════')
out('CHECK 2 — Nutrition sanity')
out('═══════════════════════════════════════════════════════════════')

const MEAT_CATS = ['أرز ومجبوس', 'دجاج', 'لحم', 'أطباق خليجية']
const c2Issues = []
for (const r of recipes) {
  if (r.calories == null) continue  // already caught in C1
  const flags = []
  const cal = r.calories, prot = r.protein_g ?? 0, carbs = r.carbs_g ?? 0, fat = r.fat_g ?? 0

  if (cal < 50)                                        flags.push(`calories too low: ${cal}`)
  if (cal > 1200)                                      flags.push(`calories too high: ${cal}`)
  if (prot > cal / 4)                                  flags.push(`protein_g (${prot}) > cal/4 (${(cal/4).toFixed(0)}) — impossible`)
  if (carbs > cal / 4)                                 flags.push(`carbs_g (${carbs}) > cal/4 (${(cal/4).toFixed(0)}) — impossible`)
  if (fat  > cal / 9)                                  flags.push(`fat_g (${fat}) > cal/9 (${(cal/9).toFixed(0)}) — impossible`)
  if (prot + carbs + fat > cal / 3)                   flags.push(`macro total (${(prot+carbs+fat).toFixed(0)}g) > cal/3 (${(cal/3).toFixed(0)}) — inflated`)
  if (r.cal_per_100g != null && r.cal_per_100g > 600) flags.push(`cal_per_100g too high: ${r.cal_per_100g}`)
  if (r.cal_per_100g != null && r.cal_per_100g < 20)  flags.push(`cal_per_100g suspiciously low: ${r.cal_per_100g}`)
  if (cal < 100 && MEAT_CATS.includes(r.category))    flags.push(`cal ${cal} too low for category ${r.category}`)

  if (flags.length) c2Issues.push({ r, flags })
}

if (c2Issues.length === 0) {
  out(`✅  Check 2 passed — all nutrition values sane`)
} else {
  out(`⚠️   Check 2 — ${c2Issues.length} issues found:`)
  for (const { r, flags } of c2Issues) {
    out(`    ${recipeLabel(r)} — ${flags.join(' | ')}`)
  }
}

// ── CHECK 3 — Cook time sanity ─────────────────────────────────────────────
out('')
out('═══════════════════════════════════════════════════════════════')
out('CHECK 3 — Cook time sanity')
out('═══════════════════════════════════════════════════════════════')

const c3Issues = []
for (const r of recipes) {
  if (!r.cook_time) continue
  const ct = String(r.cook_time)
  const flags = []
  const num = extractFirstNumber(ct)
  if (num != null && num > 480)                        flags.push(`cook_time number > 480: "${ct}"`)
  if (/^0\s*(دقيقة)?$/.test(ct.trim()))               flags.push(`cook_time is zero: "${ct}"`)
  if (ct.length > 30)                                  flags.push(`cook_time too long (${ct.length} chars): "${ct.slice(0, 50)}"`)
  if (flags.length) c3Issues.push({ r, flags })
}

if (c3Issues.length === 0) {
  out(`✅  Check 3 passed — all cook times look reasonable`)
} else {
  out(`⚠️   Check 3 — ${c3Issues.length} issues found:`)
  for (const { r, flags } of c3Issues) {
    out(`    ${recipeLabel(r)} — ${flags.join(' | ')}`)
  }
}

// ── CHECK 4 — Ingredient quality ───────────────────────────────────────────
out('')
out('═══════════════════════════════════════════════════════════════')
out('CHECK 4 — Ingredient quality')
out('═══════════════════════════════════════════════════════════════')

const STEP_WORDS = ['يُضاف', 'تُخلط', 'تُطهى', 'يُحرك', 'تُقلى', 'يُطهى', 'تُضاف', 'يُقلى', 'تُسلق', 'يُسلق']
const c4Issues = []
for (const r of recipes) {
  if (!r.ingredients || r.ingredients.length === 0) continue
  const flags = []

  if (r.ingredients.length > 30)                      flags.push(`too many ingredients: ${r.ingredients.length}`)

  for (const ing of r.ingredients) {
    const s = String(ing ?? '')
    if (s.length > 200)                               flags.push(`ingredient too long (${s.length}): "${s.slice(0, 60)}…"`)
    if (s.trim().length < 3)                          flags.push(`ingredient too short: "${s}"`)
    if (/https?:\/\/|www\./.test(s))                  flags.push(`URL in ingredient: "${s.slice(0, 60)}"`)
    if (STEP_WORDS.some(w => s.includes(w)))          flags.push(`step-like ingredient: "${s.slice(0, 60)}"`)
  }
  if (flags.length) c4Issues.push({ r, flags: [...new Set(flags)] })
}

if (c4Issues.length === 0) {
  out(`✅  Check 4 passed — all ingredients look clean`)
} else {
  out(`⚠️   Check 4 — ${c4Issues.length} recipes with ingredient problems:`)
  for (const { r, flags } of c4Issues) {
    out(`    ${recipeLabel(r)} — ${flags.join(' | ')}`)
  }
}

// ── CHECK 5 — Steps quality ────────────────────────────────────────────────
out('')
out('═══════════════════════════════════════════════════════════════')
out('CHECK 5 — Steps quality')
out('═══════════════════════════════════════════════════════════════')

const QTY_IN_STEP = /\d+\s*(كوب|غ|ملعقة|كيلو|غرام|مل)/
const c5Issues = []
for (const r of recipes) {
  if (!r.steps || r.steps.length === 0) continue
  const flags = []

  if (r.steps.length === 1)                           flags.push('only 1 step — likely all steps merged')
  if (r.steps.length > 20)                            flags.push(`too many steps: ${r.steps.length}`)

  for (const step of r.steps) {
    const s = String(step ?? '')
    if (s.length > 500)                               flags.push(`step too long (${s.length} chars) — likely merged: "${s.slice(0, 60)}…"`)
    if (s.trim().length < 10)                         flags.push(`step too short: "${s}"`)
    if (QTY_IN_STEP.test(s))                          flags.push(`ingredient quantities in step: "${s.slice(0, 60)}"`)
  }
  if (flags.length) c5Issues.push({ r, flags: [...new Set(flags)] })
}

if (c5Issues.length === 0) {
  out(`✅  Check 5 passed — all steps look clean`)
} else {
  out(`⚠️   Check 5 — ${c5Issues.length} recipes with step problems:`)
  for (const { r, flags } of c5Issues) {
    out(`    ${recipeLabel(r)} — ${flags.join(' | ')}`)
  }
}

// ── CHECK 6 — Category check ───────────────────────────────────────────────
out('')
out('═══════════════════════════════════════════════════════════════')
out('CHECK 6 — Category check')
out('═══════════════════════════════════════════════════════════════')

const CAT_KEYWORDS = [
  { words: ['شوربة', 'مرق', 'حساء'],   expected: 'شوربة' },
  { words: ['حلوى', 'حلويات', 'كيك', 'بسكويت', 'مافن', 'كحك', 'بودينج', 'تشيز كيك', 'براونيز', 'كرواسون'],  expected: 'حلويات' },
  { words: ['سلطة'],                     expected: 'سلطة' },
  { words: ['عصير', 'مشروب', 'لاتيه', 'قهوة', 'شاي', 'سموذي'],  expected: 'مشروبات' },
]

const c6Issues = []
for (const r of recipes) {
  const flags = []
  if (r.category === 'أخرى')            flags.push('category is catch-all "أخرى"')

  const name = r.name ?? ''
  for (const { words, expected } of CAT_KEYWORDS) {
    if (words.some(w => name.includes(w)) && r.category !== expected) {
      flags.push(`name suggests "${expected}" but category is "${r.category}"`)
    }
  }
  if (flags.length) c6Issues.push({ r, flags })
}

if (c6Issues.length === 0) {
  out(`✅  Check 6 passed — all categories look correct`)
} else {
  out(`⚠️   Check 6 — ${c6Issues.length} issues found:`)
  for (const { r, flags } of c6Issues) {
    out(`    ${recipeLabel(r)} — ${flags.join(' | ')}`)
  }
}

// ── SUMMARY TABLE ──────────────────────────────────────────────────────────
out('')
out('═══════════════════════════════════════════════════════════════')
out('SUMMARY')
out('═══════════════════════════════════════════════════════════════')
out(`Total recipes audited: ${recipes.length}`)
out('')

const rows = [
  ['Missing fields',         c1Issues.length, 'Manual fix or re-scrape'],
  ['Nutrition errors',       c2Issues.length, 'Re-estimate'],
  ['Cook time issues',       c3Issues.length, 'Clean or null'],
  ['Ingredient problems',    c4Issues.length, 'Review'],
  ['Step problems',          c5Issues.length, 'Review'],
  ['Category mismatches',    c6Issues.length, 'Re-assign'],
]

const col1W = 26, col2W = 7, col3W = 30
const hr = `├${'─'.repeat(col1W)}┼${'─'.repeat(col2W)}┼${'─'.repeat(col3W)}┤`
out(`┌${'─'.repeat(col1W)}┬${'─'.repeat(col2W)}┬${'─'.repeat(col3W)}┐`)
out(`│ ${'Check'.padEnd(col1W - 1)}│ ${'Count'.padEnd(col2W - 1)}│ ${'Action needed'.padEnd(col3W - 1)}│`)
out(hr)
for (const [check, count, action] of rows) {
  const countStr = count === 0 ? '✅  0' : `⚠️  ${count}`
  out(`│ ${check.padEnd(col1W - 1)}│ ${countStr.padEnd(col2W + 1)}│ ${action.padEnd(col3W - 1)}│`)
}
out(`└${'─'.repeat(col1W)}┴${'─'.repeat(col2W)}┴${'─'.repeat(col3W)}┘`)

const totalIssues = rows.reduce((s, r) => s + r[1], 0)
out('')
out(`Total issues: ${totalIssues} across ${recipes.length} recipes`)

// ── Save to file ───────────────────────────────────────────────────────────
const outPath = path.join(__dirname, 'quality_audit_results.txt')
fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8')
console.log(`\n💾  Full output saved to scripts/quality_audit_results.txt`)
