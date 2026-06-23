#!/usr/bin/env node
/**
 * fix_steps.mjs
 * FIX 5: Clean up step problems:
 *   A) Remove ultra-short stub steps (< 10 chars — scraper headers)
 *   B) Split merged single-step recipes into proper numbered steps
 */

const SB_URL = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGV0cXFsYmtnZ29qanZ4aGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA2NDY4NiwiZXhwIjoyMDk1NjQwNjg2fQ.PxaU3CWgXSVOAWz1llgCnFBDAu1W3baB2XwqtcB8hPY'

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ── Stub patterns to strip ────────────────────────────────────────────────
// Short scraper artifacts that aren't real steps
const STUB_PATTERNS = [
  /^المقادير$/,       // "Ingredients" header
  /^الخطوات?$/,      // "Steps" header
  /^الخطوة\s+\d+$/,  // "Step 1", "Step 2" etc.
  /^رز بخاري$/,      // bare dish name
  /^ثم بالبيض$/,     // fragment
  /^والملح$/,        // "and salt"
  /^والسمنة$/,       // "and butter"
  /^طريقة التحضير$/, // "Preparation method" header
]

function isStub(step) {
  const s = (step ?? '').trim()
  if (s.length < 10) return true
  return STUB_PATTERNS.some(p => p.test(s))
}

// ── Split a long merged string into individual steps ──────────────────────
function splitMergedSteps(text) {
  if (!text || text.trim().length < 20) return [text]

  // Try splitting on Arabic/Western numbered patterns first:
  //   "١." "٢." "٣." OR "1." "2." "3." OR "1-" "2-" etc.
  const numberedSplitAr = text.split(/(?=[١-٩]\.|[١-٩]\s*[\.\-])/)
  if (numberedSplitAr.length > 2) {
    return numberedSplitAr.map(s => s.trim()).filter(s => s.length >= 10)
  }

  const numberedSplitEn = text.split(/(?=\d+[\.\-]\s)/)
  if (numberedSplitEn.length > 2) {
    return numberedSplitEn.map(s => s.trim()).filter(s => s.length >= 10)
  }

  // Split on Arabic ordinals: أولاً، ثانياً، ثالثاً، رابعاً
  const ordinals = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً', 'عاشراً']
  const ordinalPattern = new RegExp(`(?=${ordinals.join('|')})`)
  const ordinalSplit = text.split(ordinalPattern)
  if (ordinalSplit.length > 2) {
    return ordinalSplit.map(s => s.trim()).filter(s => s.length >= 10)
  }

  // Split on sentence-ending punctuation followed by capital start patterns
  // In Arabic, sentences often end with . or ، and new steps start
  // Split on ". " or ".\n" or "، ثم" or "، بعد" where next word starts a new action
  const actionStarters = /(?<=[\.\n])\s+(?=[اتيسنقحفزعبكمهلوأإ][^\s]{2})/g
  const bySentence = text.split(/\.\s+(?=[اتيسنقحفزعبكمهلوأإ])/g)
  if (bySentence.length > 2) {
    return bySentence
      .map((s, i) => (i < bySentence.length - 1 ? s + '.' : s).trim())
      .filter(s => s.length >= 10)
  }

  // Final fallback: split on ". ثم " or "، ثم " boundaries
  const thenSplit = text.split(/(?<=\.\s|،\s)(?=ثم\s|بعد\s|أضيف|ضع|سخن|اخلط|اقل|اسلق|ابدأ)/)
  if (thenSplit.length > 1) {
    return thenSplit.map(s => s.trim()).filter(s => s.length >= 10)
  }

  return [text.trim()]
}

// ── Recipes with known stub steps (short artifacts to remove) ────────────
const STUB_RECIPE_PREFIXES = [
  'a30b2b58',  // الارز البخاري مع منال العالم — step "رز بخاري"
  'a8bd0e3d',  // دجاج بالفستق الحلبي — step "ثم بالبيض"
  'eb10a75b',  // رولات الخيار محشوة باللبنة — step "المقادير"
  'b6513ed2',  // مجدرة البرغل بالخطوات — steps "المقادير" "والملح"
  '5c2cacf3',  // مقلوبة الباذنجان المميزة — steps "المقادير" "والسمنة"
  'd9012326',  // حضّري شرائح اللحم مع الخضر — steps "الخطوة 1-4"
  '0e21c0f2',  // الفتة الحلبية — step "المقادير"
]

// ── Recipes where ALL steps merged into 1 long string ─────────────────────
const MERGED_RECIPE_PREFIXES = [
  '4e7105d3',  // خلطة بهارات الكبسة السعودية المنزلية
  'dea5c5db',  // مقلقل اللحم السعودي
  'ca83cf61',  // الفلافل والطرطور .. لسحور مثالي
  'bd0586a1',  // سمكة حرّة بالخضر
]

const allPrefixes = [...new Set([...STUB_RECIPE_PREFIXES, ...MERGED_RECIPE_PREFIXES])]

// Fetch all recipes, filter by prefix
const { data: allRecipes, error: fetchErr } = await supabase
  .from('recipes')
  .select('id, name, steps')

if (fetchErr) { console.error('❌', fetchErr.message); process.exit(1) }

const fetched = allRecipes.filter(r =>
  allPrefixes.some(p => r.id.startsWith(p))
)

console.log(`\n🔧  Fixing steps for ${fetched.length} recipes...\n`)

let totalFixed = 0

for (const r of fetched) {
  const original = r.steps ?? []
  const prefix = r.id.slice(0, 8)
  let cleaned = [...original]
  let action = ''

  if (MERGED_RECIPE_PREFIXES.includes(prefix) && original.length === 1) {
    // Try to split the merged single step
    const merged = original[0] ?? ''
    const split = splitMergedSteps(merged)

    if (split.length > 1) {
      cleaned = split
      action = `split 1 merged → ${split.length} steps`
    } else {
      // Can't split — leave as-is but log it
      console.log(`⚪  "${r.name.slice(0, 45)}" — could not split (kept as 1 step)`)
      continue
    }
  } else {
    // Remove stub steps
    cleaned = original.filter(s => !isStub(s))
    const removed = original.length - cleaned.length
    if (removed === 0) {
      console.log(`⚪  "${r.name.slice(0, 45)}" — no stubs found`)
      continue
    }
    action = `removed ${removed} stub(s): ${original.length} → ${cleaned.length} steps`
  }

  if (cleaned.length === 0) {
    console.log(`⚠️   "${r.name.slice(0, 45)}" — cleaning would leave 0 steps, skipping`)
    continue
  }

  const { error } = await supabase
    .from('recipes')
    .update({ steps: cleaned })
    .eq('id', r.id)

  if (error) {
    console.log(`❌  "${r.name.slice(0, 45)}" — ${error.message}`)
  } else {
    console.log(`✅  "${r.name.slice(0, 45)}"`)
    console.log(`    ${action}`)
    totalFixed++
  }
}

console.log(`\n── Summary ────────────────`)
console.log(`   Recipes fixed: ${totalFixed} / ${fetched.length}`)
