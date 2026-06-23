#!/usr/bin/env node
/**
 * fix_ingredients.mjs
 * FIX 4: Remove scraper artifacts from recipes with > 30 ingredients.
 * 4 recipes: مثلوثة (×2), كبسة حساوية, كفتة
 */

const SB_URL = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGV0cXFsYmtnZ29qanZ4aGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA2NDY4NiwiZXhwIjoyMDk1NjQwNjg2fQ.PxaU3CWgXSVOAWz1llgCnFBDAu1W3baB2XwqtcB8hPY'

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ── Fetch all recipes, then filter by prefix ──────────────────────────────
const TARGET_PREFIXES = ['43cf963e', 'd832d960', 'abd63d3e', '2b0be8db']

const { data: allRecipes, error } = await supabase
  .from('recipes')
  .select('id, name, ingredients')

if (error) { console.error('❌', error.message); process.exit(1) }

const allFetched = allRecipes.filter(r =>
  TARGET_PREFIXES.some(p => r.id.startsWith(p))
)

// ── Artifact patterns to remove ───────────────────────────────────────────
// These patterns identify scraper artifacts, not actual ingredients
const ARTIFACT_PATTERNS = [
  /^المقادير$/,           // "Ingredients" section header
  /^الحشو$/,             // "Filling" section header
  /^طبقة/,              // "Layer of..."
  /^للتقديم$/,           // "For serving"
  /^للتزيين$/,           // "For garnish"
  /^للطبخ$/,             // "For cooking"
  /^لعمل/,              // "For making..."
  /^مكونات/,            // "Components of..."
  /^خلطة/i,             // "Mixture" (when standalone header)
  /^الصوص$/,            // "The sauce" (section header)
  /^الوصفة:/,           // "The recipe:"
  /^\d+[\-\.]\s*$/,     // bare number like "1." "2-"
  /^[:-]$/,             // just punctuation
]

// Step-like content that crept into ingredients
const STEP_VERBS = ['يُضاف', 'تُخلط', 'تُطهى', 'يُحرك', 'تُقلى', 'يُطهى', 'تُضاف', 'يُقلى', 'تُسلق', 'يُسلق', 'اخلطي', 'اسلقي', 'اقلي']

function isArtifact(ing) {
  const s = (ing ?? '').trim()
  if (s.length < 3) return true                           // too short
  if (s.length > 150) return true                         // too long (merged step)
  if (ARTIFACT_PATTERNS.some(p => p.test(s))) return true
  if (STEP_VERBS.some(v => s.includes(v))) return true
  if (/https?:\/\/|www\./.test(s)) return true            // URL
  return false
}

function dedup(arr) {
  const seen = new Set()
  return arr.filter(s => {
    const k = s.trim().toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

console.log(`\n🔧  Cleaning ingredients for ${allFetched.length} recipes...\n`)

let totalFixed = 0

for (const r of allFetched) {
  const original = r.ingredients ?? []
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`📋  ${r.name}`)
  console.log(`    Before: ${original.length} ingredients`)
  console.log(`    Full list:`)
  original.forEach((ing, i) => {
    const flag = isArtifact(ing) ? ' ← REMOVE' : ''
    console.log(`      [${String(i+1).padStart(2)}] ${ing.slice(0, 80)}${flag}`)
  })

  const cleaned = dedup(original.filter(ing => !isArtifact(ing)))
  console.log(`\n    After: ${cleaned.length} ingredients (removed ${original.length - cleaned.length})`)

  if (cleaned.length === original.length) {
    console.log(`    ⚪ No changes needed`)
    continue
  }
  if (cleaned.length < 2) {
    console.log(`    ⚠️  Would reduce to ${cleaned.length} — skipping to avoid data loss`)
    continue
  }

  const { error: upErr } = await supabase
    .from('recipes')
    .update({ ingredients: cleaned })
    .eq('id', r.id)

  if (upErr) {
    console.log(`    ❌ Update failed: ${upErr.message}`)
  } else {
    console.log(`    ✅ Updated: ${original.length} → ${cleaned.length} ingredients`)
    totalFixed++
  }
}

console.log(`\n── Summary ────────────────`)
console.log(`   Recipes cleaned: ${totalFixed} / ${allFetched.length}`)
