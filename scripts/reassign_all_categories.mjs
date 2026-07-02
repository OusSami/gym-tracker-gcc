#!/usr/bin/env node
/**
 * reassign_all_categories.mjs
 * Re-categorises every recipe using name + first 8 ingredients.
 * Only writes rows where the category actually changes.
 */

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
if (!SB_URL || !SB_KEY) { console.error('❌  Missing credentials'); process.exit(1) }

// ── Category assignment — name + ingredients, priority order ─────────────────
function assignCategory(name, ingredients) {
  const n   = name || ''
  const ing = (ingredients || []).slice(0, 8).join(' ')

  // ── 1. DRINKS ─────────────────────────────────────────────────────────────
  // Triggered only by drink-specific name keywords, not incidental ingredients
  if (
    n.includes('عصير')   || n.includes('سموذي')    || n.includes('مشروب')  ||
    n.includes('كوكتيل') || n.includes('شاي')       || n.includes('قهوة')   ||
    n.includes('لاتيه')  || n.includes('موهيتو')    || n.includes('ليموناضة') ||
    n.includes('شربات')  || n.includes('دلجونا')    || n.includes('شيك')    ||
    (n.includes('شوكولا') && n.includes('ساخن'))
  ) return 'مشروبات'

  // ── 2. BREAKFAST-SPECIFIC OVERRIDES (before desserts catch shared words) ──
  // Egg muffins, savoury waffles, protein/tuna pancakes → breakfast not dessert
  if (
    n.includes('مافن بيض')   || n.includes('مافن البيض')  ||
    n.includes('وافل بطاطس') || n.includes('وافل الخضار') ||
    n.includes('وافل البطاطس') ||
    (n.includes('بان كيك') && (n.includes('تونة') || n.includes('بروتين') || n.includes('سبانخ')))
  ) return 'فطور'

  // ── 3. DESSERTS ───────────────────────────────────────────────────────────
  if (
    n.includes('حلوى')    || n.includes('حلا')       || n.includes('كيك')      ||
    n.includes('تشيز')    || n.includes('بسبوسة')    || n.includes('كنافة')    ||
    n.includes('مهلبية')  || n.includes('بقلاوة')    || n.includes('لقيمات')   ||
    n.includes('عصيدة')   || n.includes('سحلب')      || n.includes('بودينج')   ||
    n.includes('موس ')    || n.includes('براونيز')   || n.includes('كوكيز')    ||
    n.includes('بسكويت')  || n.includes('تارت')      || n.includes('فلان')     ||
    n.includes('كريم برولية') || n.includes('دونات') || n.includes('وافل حلو') ||
    n.includes('كاتو')    || n.includes('مافن')      || n.includes('كليجا')    ||
    n.includes('قرص عقيلي')   || n.includes('حلاوة') || n.includes('مصابيب')   ||
    n.includes('خبيصة')   || n.includes('عوامة')     || n.includes('زلابية')   ||
    n.includes('قطايف')   || n.includes('أم علي')    || n.includes('بسيمة')    ||
    n.includes('رز بالحليب')  || n.includes('أرز بالحليب') ||
    (n.includes('تمر') && (n.includes('حلو') || n.includes('حشو') || n.includes('معمول'))) ||
    n.includes('كوكيز')   || n.includes('ليزي كيك')  || n.includes('كب كيك')   ||
    n.includes('بان كيك') || n.includes('وافل')
  ) return 'حلويات'

  // ── 4. BREAKFAST ──────────────────────────────────────────────────────────
  if (
    n.includes('فطور')          || n.includes('إفطار')         || n.includes('صباح')         ||
    n.includes('تميس')          || n.includes('مناقيش')        || n.includes('شكشوكة')       ||
    n.includes('أومليت')        || n.includes('اومليت')        || n.includes('فطيرة خبز')    ||
    n.includes('غرانولا')       || n.includes('موسلي')         || n.includes('كريب')         ||
    n.includes('لبنة')          || n.includes('فول مدمس')      || n.includes('فلافل')        ||
    n.includes('حمص للفطور')    || n.includes('بليلة')         || n.includes('بلاليط')       ||
    n.includes('هريس الإفطار')  || n.includes('جريش الإفطار') || n.includes('ثريد الإفطار') ||
    // عجة (egg frittata) and toast/oatmeal — unambiguous breakfast words
    n.includes('عجة')           || n.includes('توست')          || n.includes('شوفان')        ||
    // egg compound patterns — use البيض+ال/بال to avoid matching بيضاء (white)
    n.includes('البيض ال')      || n.includes('البيض بال')     || n.includes('البيض م')      ||
    n.includes('البيض في')      || n.includes('البيض ب')       ||
    n.includes('بيض مقلي')     || n.includes('بيض مخفوق')    || n.includes('بيض بالطماطم') ||
    n.includes('بيض بالجبن')   || n.includes('بيض بالسجق')   || n.includes('بيض بالقديد')  ||
    n.includes('بيض مسلوق')    || n.includes('بوريتو البيض')  || n.includes('بيض في')       ||
    n.includes('بيض بال')      || n.includes('بيض بب')        || n.includes('بيض مع')       ||
    n.includes('بيض ع')
  ) return 'فطور'

  // ── 5. SOUPS ──────────────────────────────────────────────────────────────
  if (
    n.includes('شوربة') || n.includes('حساء') || n.includes('مرق') || n.includes('يخنة') ||
    (n.includes('هريسة') && n.includes('شوربة'))
  ) return 'شوربة'

  // ── 6. SALADS ─────────────────────────────────────────────────────────────
  if (
    n.includes('سلطة') || n.includes('تبولة') || n.includes('فتوش') || n.includes('كول سلو')
  ) return 'سلطة'

  // ── 7. APPETIZERS ─────────────────────────────────────────────────────────
  if (
    n.includes('مقبلات') || n.includes('دقوس')      || n.includes('بابا غنوج') ||
    n.includes('حمص')    || n.includes('متبل')       || n.includes('محمرة')     ||
    n.includes('سمبوسة') || n.includes('بوراك')      || n.includes('صوص')       ||
    n.includes('غموس')
  ) return 'مقبلات'

  // ── 8. FISH & SEAFOOD ─────────────────────────────────────────────────────
  if (
    n.includes('سمك')    || n.includes('ربيان')     || n.includes('جمبري')     ||
    n.includes('قريدس')  || n.includes('حبار')       || n.includes('هامور')     ||
    n.includes('ميرو')   || n.includes('فيليه سمك') || n.includes('تونة')      ||
    n.includes('سردين')  || n.includes('كابوريا')   || n.includes('بلطي')      ||
    n.includes('سلمون')  || n.includes('قاروص')     || n.includes('نقروف')     ||
    n.includes('شعري')
  ) return 'سمك ومأكولات بحرية'

  // ── 9. CHICKEN ────────────────────────────────────────────────────────────
  if (
    n.includes('دجاج') || n.includes('دجاجة') || n.includes('فراخ') ||
    n.includes('فرخة') || n.includes('تشيكن') || n.includes('كوردون')
  ) return 'دجاج'

  // ── 10. MEAT ──────────────────────────────────────────────────────────────
  if (
    n.includes('لحم')    || n.includes('لحمة')      || n.includes('كباب')      ||
    n.includes('كفتة')   || n.includes('شيش')        || n.includes('ضلع')       ||
    n.includes('هبرة')   || n.includes('ستيك')       || n.includes('برغر')      ||
    n.includes('نقانق')  || n.includes('سجق')        || n.includes('مرتديلا')   ||
    n.includes('كفتاه')  || n.includes('ريش')        || n.includes('لحم مفروم') ||
    n.includes('قوزي')   || n.includes('خروف')       || n.includes('غنم')       ||
    n.includes('عجل')    || n.includes('كبدة')        || n.includes('قلوب')      ||
    n.includes('كوارع')
  ) return 'لحم'

  // ── 11. RICE & MAINS ──────────────────────────────────────────────────────
  if (
    n.includes('أرز')      || n.includes('رز')         || n.includes('مجبوس')    ||
    n.includes('كبسة')     || n.includes('برياني')     || n.includes('مندي')     ||
    n.includes('بخاري')    || n.includes('مقلوبة')     || n.includes('زربيان')   ||
    n.includes('قبولي')    || n.includes('هريسة')      || n.includes('جريش')     ||
    n.includes('مضبي')     || n.includes('حنيذ')        || n.includes('مراصيع')   ||
    n.includes('عصيد')     || n.includes('سليق')        || n.includes('مكبوس')    ||
    n.includes('صالونة')   || n.includes('ملوخية')     || n.includes('فتة')      ||
    n.includes('ثريد')     || n.includes('مدغوس')      || n.includes('مطازيز')   ||
    n.includes('معكرونة')  || n.includes('باستا')      || n.includes('مكرونة')   ||
    n.includes('سباغيتي')  || n.includes('لازانيا')
  ) return 'أرز ومجبوس'

  // ── 12. GULF DISHES ───────────────────────────────────────────────────────
  if (
    n.includes('غيمش')   || n.includes('بليلة')    || n.includes('هنيني')   ||
    n.includes('لقيمات') || n.includes('بيض بالدبس')
  ) return 'أطباق خليجية'

  // ── 13. BREADS & PASTRIES ────────────────────────────────────────────────
  if (
    n.includes('خبز')    || n.includes('معجنات') || n.includes('عجين') ||
    n.includes('فطير')   || n.includes('بروشيتا') || n.includes('رقاق')
  ) return 'خبز ومعجنات'

  // ── 14. DEFAULT ───────────────────────────────────────────────────────────
  return 'أخرى'
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ── STEP 1: Fetch all recipes ─────────────────────────────────────────────────
console.log('\n📥  Fetching all recipes…')
const { data, error } = await supabase
  .from('recipes')
  .select('id, name, ingredients, category')
  .order('id')
if (error) { console.error('❌', error.message); process.exit(1) }
console.log(`    ${data.length} recipes loaded\n`)

// ── STEP 2: Compute new categories, collect changes ───────────────────────────
const beforeDist = {}
const afterDist  = {}
const changes    = []  // { id, name, from, to }
const flowMap    = {}  // "from→to" : count

for (const r of data) {
  const oldCat = r.category || 'أخرى'
  const newCat = assignCategory(r.name, r.ingredients)
  beforeDist[oldCat] = (beforeDist[oldCat] || 0) + 1
  afterDist[newCat]  = (afterDist[newCat]  || 0) + 1
  if (newCat !== oldCat) {
    changes.push({ id: r.id, name: r.name, from: oldCat, to: newCat })
    const key = `${oldCat} → ${newCat}`
    flowMap[key] = (flowMap[key] || 0) + 1
  }
}

console.log(`✏️   Categories to change: ${changes.length} / ${data.length}\n`)

// ── STEP 3: Update only changed rows (batches of 50 via Promise.all) ──────────
const BATCH = 50
let updated = 0
let failed  = 0

if (changes.length > 0) {
  console.log('💾  Writing changes to DB…')
  for (let i = 0; i < changes.length; i += BATCH) {
    const batch = changes.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(r =>
        supabase.from('recipes').update({ category: r.to }).eq('id', r.id)
      )
    )
    const batchFailed = results.filter(r => r.error).length
    updated += batch.length - batchFailed
    failed  += batchFailed
    console.log(`  ✓  Batch ${Math.floor(i / BATCH) + 1}: ${batch.length - batchFailed} updated`)
  }
  console.log()
}

// ── STEP 4: Summary ───────────────────────────────────────────────────────────
console.log('══════════════════════════════════════════════════════════')
console.log('   REASSIGNMENT FLOWS (from → to)')
console.log('══════════════════════════════════════════════════════════\n')
const sortedFlows = Object.entries(flowMap).sort((a, b) => b[1] - a[1])
for (const [flow, count] of sortedFlows) {
  console.log(`  ${String(count).padStart(3)}×  ${flow}`)
}

console.log('\n── Before distribution ──────────────────────────────────')
const allCats = new Set([...Object.keys(beforeDist), ...Object.keys(afterDist)])
for (const cat of [...allCats].sort((a, b) => (beforeDist[b] || 0) - (beforeDist[a] || 0))) {
  const b = beforeDist[cat] || 0
  const a = afterDist[cat]  || 0
  const diff = a - b
  const diffStr = diff === 0 ? '   =' : diff > 0 ? `  +${diff}` : `  ${diff}`
  console.log(`  ${cat.padEnd(22)}  ${String(b).padStart(3)} →  ${String(a).padStart(3)}  ${diffStr}`)
}

// ── STEP 5: Live DB distribution ──────────────────────────────────────────────
console.log('\n── Live DB category distribution (after update) ────────')
const { data: dist, error: distErr } = await supabase
  .from('recipes')
  .select('category')
const liveTally = {}
for (const r of (dist || [])) liveTally[r.category] = (liveTally[r.category] || 0) + 1
const sortedLive = Object.entries(liveTally).sort((a, b) => b[1] - a[1])
for (const [cat, count] of sortedLive) {
  const bar = '█'.repeat(Math.round(count / 3))
  console.log(`  ${cat.padEnd(22)}  ${String(count).padStart(3)}  ${bar}`)
}

console.log('\n── Summary ──────────────────────────────────────────────')
console.log(`   Total recipes checked:   ${data.length}`)
console.log(`   Categories changed:      ${changes.length}`)
console.log(`   DB rows updated:         ${updated}`)
console.log(`   Failed:                  ${failed}`)
console.log(`   Remaining in أخرى:       ${liveTally['أخرى'] || 0}`)
console.log()
