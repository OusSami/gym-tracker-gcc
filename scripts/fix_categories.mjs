#!/usr/bin/env node
/**
 * fix_categories.mjs
 * FIX 1: Re-assign 55 "أخرى" recipes to correct categories
 * FIX 2: Fix 3 سلطة recipes misclassified as مشروبات
 */

const SB_URL = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGV0cXFsYmtnZ29qanZ4aGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA2NDY4NiwiZXhwIjoyMDk1NjQwNjg2fQ.PxaU3CWgXSVOAWz1llgCnFBDAu1W3baB2XwqtcB8hPY'

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ── Hardcoded category assignments based on Arabic/Gulf food knowledge ─────
// Key: first 8 chars of UUID (matches audit output)
const CATEGORY_MAP = {
  // أطباق خليجية — Gulf speciality dishes
  '8ad2d348': 'أطباق خليجية',  // مطبق زبيدي لسفرة رمضان
  '54bfbbd8': 'أطباق خليجية',  // بلاليط بالهيل والزعفران (Emirati sweet vermicelli)
  '49d076a0': 'أطباق خليجية',  // البلاليط على الطريقة الخليجية
  'e1450f9b': 'أطباق خليجية',  // معبوج الباذنجان (Emirati eggplant dish)
  'cb569589': 'أطباق خليجية',  // مضروبة خضار
  'd33010d8': 'أطباق خليجية',  // مطبق زبيدي
  '781578eb': 'أطباق خليجية',  // الغوزي الإماراتي (whole roasted lamb)
  '10efae54': 'أطباق خليجية',  // بالفيديو المطبق السعودي
  'c179a5b1': 'أطباق خليجية',  // المطبق السعودي
  '7b2c7dbe': 'حلويات',        // مموش كويتي (Kuwaiti date+sesame sweet)
  '8a7ca8e6': 'حلويات',        // حلى تراميسو بخطوات سهلة
  '96d01c75': 'مقبلات',        // صوص دايت بخطوات سهلة
  '5e6fe2ef': 'مقبلات',        // صوص الشاورما السهل
  '479dad1c': 'مقبلات',        // بيستو صوص خطوة بخطوة
  'a2511df2': 'مقبلات',        // صوص الفريدو سهل
  'aac7a8f9': 'مقبلات',        // صوص البافلو بطريقة سهلة
  '1dcfa008': 'سمك ومأكولات بحرية', // السوشي في المنزل
  '3f3aee2c': 'سمك ومأكولات بحرية', // السوشي بشكل صحي
  '91df978d': 'فطور',          // شوفان مع الكينوا
  '3b02ba4c': 'مقبلات',        // صوص الرانش للبيتزا سهل
  '90ff8723': 'مقبلات',        // ماش بطاطا بخطوات سهلة
  '0b9a1fdd': 'مقبلات',        // صوص السوشي الأخضر
  '19b1eaaa': 'مقبلات',        // فلفل محشي كينوا وخضروات
  '10d04662': 'مقبلات',        // صوص الثومية بطريقة سهلة (toum/garlic sauce)
  '8220d0f1': 'فطور',          // الشوفان مع الحليب بالخطوات
  'bc531f18': 'حلويات',        // كريم كراميل بخطوات سهلة
  'facd01a2': 'أطباق خليجية',  // حمسة النخي الاماراتي (Emirati date sauce)
  '01050ad9': 'أطباق خليجية',  // القشد الملكي (clotted cream - Gulf specialty)
  '0e311e97': 'أطباق خليجية',  // المعدس الكويتي (Kuwaiti lentil dish)
  '663bcf9e': 'حلويات',        // الحنيني السعودي (date+sesame+butter dessert)
  '775189eb': 'حلويات',        // الحنيني
  'e8a1ccfa': 'أطباق خليجية',  // اليغمش (Gulf flatbread/pancake)
  '2d53865a': 'أطباق خليجية',  // القشد الملكي السعودي
  'd778f6c2': 'حلويات',        // الدبيازة السعودية (date dessert)
  'e6c3923e': 'أطباق خليجية',  // البكيلة (Gulf spinach/fenugreek stew)
  'f217fda5': 'حلويات',        // العريكة السعودية (wheat+date+butter dessert)
  'aadc0534': 'أطباق خليجية',  // مطبق الزبيدي الكويتي
  '4b11f460': 'سمك ومأكولات بحرية', // صيادية الروبيان الطريقة السعودية
  'dc0458e2': 'أطباق خليجية',  // غوزي إماراتي
  'ef326eb5': 'مقبلات',        // سمبوسة الماش والكراث
  '19e0bfa4': 'لحم',           // دولمة عراقية (dolma - stuffed with meat)
  '66012b7d': 'خبز ومعجنات',  // حواوشي جدة (bread stuffed with meat)
  'bcb2adaf': 'أطباق خليجية',  // اليغمش السعودي
  '1aea6622': 'مقبلات',        // بروشكيتا بالأفوكادو والطماطم
  '44de5dc5': 'مقبلات',        // بطاطس مشوية بالزعتر المجفف
  '6fe6eba2': 'حلويات',        // فستقية (pistachio dessert)
  '8681e9f2': 'حلويات',        // بف باستري بحشوة التوت المشكل والتفاح
  '192056be': 'حلويات',        // أم علي بالتوست
  'df5fd9a7': 'حلويات',        // سمسمية (sesame candy)
  '682a9e78': 'سمك ومأكولات بحرية', // البايلّلا (paella = seafood+rice)
  '06c363d0': 'خبز ومعجنات',  // فطائر السبانخ على الطريقة الخليجية
  'bfadac69': 'سمك ومأكولات بحرية', // تونا تحتة الخليجية
  '4d01edc1': 'سمك ومأكولات بحرية', // مشخول الروبيان
  'e00fc0ce': 'سمك ومأكولات بحرية', // مشخول روبيان على الطريقة الخليجية
  '6af22cfc': 'أخرى',          // خلطة البهارات الخليجية (spice blend — stays أخرى)

  // FIX 2: مشروبات → سلطة
  'ceea7706': 'سلطة',   // سلطة البنجر الصحية
  '9920f22a': 'سلطة',   // سلطة خضار باللبنة
  'db6befce': 'سلطة',   // سلطة البروكلي بالطحينة
}

// Fetch all أخرى + مشروبات recipes to get full IDs and names
const { data: recipes, error } = await supabase
  .from('recipes')
  .select('id, name, category')
  .in('category', ['أخرى', 'مشروبات'])

if (error) { console.error('❌', error.message); process.exit(1) }
console.log(`\n📥  Found ${recipes.length} recipes in أخرى / مشروبات\n`)

let updated = 0, skipped = 0

for (const r of recipes) {
  const shortId = r.id.slice(0, 8)
  const newCat  = CATEGORY_MAP[shortId]

  if (!newCat || newCat === r.category) {
    // Not in our map or already correct
    if (!newCat) console.log(`  ⚪ not mapped — "${r.name.slice(0, 40)}" (${shortId})`)
    skipped++
    continue
  }

  const { error: upErr } = await supabase
    .from('recipes')
    .update({ category: newCat })
    .eq('id', r.id)

  if (upErr) {
    console.log(`  ❌ FAIL "${r.name.slice(0, 40)}" — ${upErr.message}`)
  } else {
    console.log(`  ✅ "${r.name.slice(0, 40)}"`)
    console.log(`     ${r.category} → ${newCat}`)
    updated++
  }
}

console.log(`\n── Summary ────────────────────────────────`)
console.log(`   Updated: ${updated}`)
console.log(`   Skipped (not in map or already correct): ${skipped}`)
