#!/usr/bin/env node
/**
 * fix_nutrition.mjs
 * FIX 3: Correct 22 recipes with impossible or wildly wrong nutrition values.
 * Values derived from culinary knowledge of each specific dish.
 */

const SB_URL = 'https://jwhetqqlbkggojjvxhch.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aGV0cXFsYmtnZ29qanZ4aGNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA2NDY4NiwiZXhwIjoyMDk1NjQwNjg2fQ.PxaU3CWgXSVOAWz1llgCnFBDAu1W3baB2XwqtcB8hPY'

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// Each entry: [full-id-prefix, display-name, { per-serving }, { per-100g }, reasoning]
const FIXES = [
  // ── دقوس / tomato sauces ─────────────────────────────────────────────
  // دقوس is a cooked tomato+garlic+pepper sauce for kabsa, ~3 tbsp per serving (~50g)
  ['4d5e36f2', 'طريقة عمل الدقوس البارد',
    { calories:85,  protein_g:1.5, carbs_g:10.0, fat_g:4.5, fiber_g:2.0 },
    { cal_per_100g:170, protein_per_100g:3.0, carbs_per_100g:20.0, fat_per_100g:9.0 },
    'tomato condiment sauce ~50g/serving'],

  ['ba43651c', 'طريقة عمل الدقوس البارد (2)',
    { calories:85,  protein_g:1.5, carbs_g:10.0, fat_g:4.5, fiber_g:2.0 },
    { cal_per_100g:170, protein_per_100g:3.0, carbs_per_100g:20.0, fat_per_100g:9.0 },
    'tomato condiment sauce ~50g/serving'],

  ['84419780', 'الدقوس الحار',
    { calories:90,  protein_g:1.5, carbs_g:11.0, fat_g:4.5, fiber_g:2.0 },
    { cal_per_100g:175, protein_per_100g:3.0, carbs_per_100g:22.0, fat_per_100g:9.0 },
    'spicy tomato sauce ~50g/serving'],

  ['30d8e7eb', 'دقوس حار للكبسة',
    { calories:90,  protein_g:1.5, carbs_g:11.0, fat_g:4.5, fiber_g:2.0 },
    { cal_per_100g:175, protein_per_100g:3.0, carbs_per_100g:22.0, fat_per_100g:9.0 },
    'spicy tomato condiment ~50g/serving'],

  ['a92f4cd5', 'طريقة عمل الدقوس الحار للكبسة',
    { calories:90,  protein_g:1.5, carbs_g:11.0, fat_g:4.5, fiber_g:2.0 },
    { cal_per_100g:175, protein_per_100g:3.0, carbs_per_100g:22.0, fat_per_100g:9.0 },
    'spicy tomato condiment ~50g/serving'],

  ['169de2e0', 'دقوس الكبسة السعودية',
    { calories:90,  protein_g:1.5, carbs_g:11.0, fat_g:4.5, fiber_g:2.0 },
    { cal_per_100g:175, protein_per_100g:3.0, carbs_per_100g:22.0, fat_per_100g:9.0 },
    'Saudi kabsa tomato sauce ~50g/serving'],

  // ── Rice dish with sauce ──────────────────────────────────────────────
  // "رز أبيض مع صوص الدقوس" = plain white rice + daqoos sauce, ~300g serving
  ['5c94e639', 'رز أبيض مع صوص الدقوس',
    { calories:310, protein_g:6.0,  carbs_g:56.0, fat_g:6.0, fiber_g:2.0 },
    { cal_per_100g:103, protein_per_100g:2.0, carbs_per_100g:18.7, fat_per_100g:2.0 },
    'white rice ~250g + 50g tomato sauce per serving'],

  // ── Fish مطبق (Gulf fish pancake) ────────────────────────────────────
  ['f0316310', 'مطبق سمك مع البصل',
    { calories:370, protein_g:28.0, carbs_g:28.0, fat_g:16.0, fiber_g:2.0 },
    { cal_per_100g:160, protein_per_100g:12.1, carbs_per_100g:12.1, fat_per_100g:6.9 },
    'Gulf fish pancake with egg dough ~230g/serving'],

  // ── Gulf meat/rice dishes ─────────────────────────────────────────────
  // مدفون لحم = buried lamb in rice, substantial dish
  ['24dff83d', 'مدفون لحم',
    { calories:560, protein_g:36.0, carbs_g:52.0, fat_g:20.0, fiber_g:3.0 },
    { cal_per_100g:145, protein_per_100g:9.3, carbs_per_100g:13.5, fat_per_100g:5.2 },
    'buried lamb in rice dish ~385g/serving'],

  // ── Eggplant dishes ───────────────────────────────────────────────────
  // معبوج الباذنجان = Emirati stuffed/baked eggplant
  ['e1450f9b', 'معبوج الباذنجان',
    { calories:185, protein_g:5.0,  carbs_g:16.0, fat_g:11.0, fiber_g:4.0 },
    { cal_per_100g:85,  protein_per_100g:2.3, carbs_per_100g:7.4, fat_per_100g:5.1 },
    'Emirati baked/stuffed eggplant ~220g/serving'],

  // ── Sauces / condiments ───────────────────────────────────────────────
  // صوص الشاورما = mayo-based shawarma sauce, ~2 tbsp serving (~30g)
  ['5e6fe2ef', 'صوص الشاورما السهل',
    { calories:155, protein_g:1.0,  carbs_g:4.0,  fat_g:15.0, fiber_g:0.0 },
    { cal_per_100g:516, protein_per_100g:3.3, carbs_per_100g:13.3, fat_per_100g:50.0 },
    'mayo-based sauce ~30g/serving'],

  // صوص الثومية = toum/garlic sauce, ~2 tbsp serving (~30g)
  ['10d04662', 'صوص الثومية بطريقة سهلة',
    { calories:170, protein_g:1.0,  carbs_g:4.0,  fat_g:17.0, fiber_g:0.5 },
    { cal_per_100g:566, protein_per_100g:3.3, carbs_per_100g:13.3, fat_per_100g:56.7 },
    'garlic+oil emulsion ~30g/serving'],

  // ── Chicken dish ─────────────────────────────────────────────────────
  // برجر دجاج دايت = diet chicken burger (bun + chicken patty)
  ['787b8616', 'برجر دجاج دايت',
    { calories:330, protein_g:32.0, carbs_g:26.0, fat_g:10.0, fiber_g:2.0 },
    { cal_per_100g:183, protein_per_100g:17.8, carbs_per_100g:14.4, fat_per_100g:5.6 },
    'diet chicken burger patty + light bun ~180g'],

  // ── Stuffed grape leaves ──────────────────────────────────────────────
  // فتة ورق عنب = grape leaf dish (fattet with yogurt/bread)
  ['b1bd8d26', 'فتة ورق عنب السهلة',
    { calories:220, protein_g:9.0,  carbs_g:24.0, fat_g:9.0, fiber_g:3.0 },
    { cal_per_100g:125, protein_per_100g:5.1, carbs_per_100g:13.7, fat_per_100g:5.1 },
    'stuffed grape leaves with yogurt fattet ~175g/serving'],

  // ── Dips ─────────────────────────────────────────────────────────────
  // جربي صوص الحمص بالبنجر = beetroot hummus, ~4 tbsp serving (~80g)
  ['a5dc348d', 'جربي صوص الحمص بالبنجر اليوم!',
    { calories:190, protein_g:6.0,  carbs_g:16.0, fat_g:11.0, fiber_g:4.0 },
    { cal_per_100g:237, protein_per_100g:7.5, carbs_per_100g:20.0, fat_per_100g:13.8 },
    'beetroot hummus ~80g/serving (4 tbsp)'],

  // بابا غنوج = baba ghanoush, ~80g serving
  ['772dcc6b', 'بابا غنوج',
    { calories:175, protein_g:5.0,  carbs_g:14.0, fat_g:11.0, fiber_g:4.0 },
    { cal_per_100g:219, protein_per_100g:6.3, carbs_per_100g:17.5, fat_per_100g:13.8 },
    'baba ghanoush dip ~80g/serving'],

  // ── Baked goods / desserts ────────────────────────────────────────────
  // ليزي كيك الشوفان = oat-based lazy cake, ~100g/serving
  ['4ad525f1', 'ليزي كيك الشوفان',
    { calories:290, protein_g:7.0,  carbs_g:36.0, fat_g:13.0, fiber_g:4.0 },
    { cal_per_100g:290, protein_per_100g:7.0, carbs_per_100g:36.0, fat_per_100g:13.0 },
    'oat lazy cake ~100g/serving'],

  // بف باستري بحشوة التوت = puff pastry with mixed berry filling, ~90g/serving
  ['8681e9f2', 'بف باستري بحشوة التوت المشكل والتفاح',
    { calories:270, protein_g:4.0,  carbs_g:33.0, fat_g:13.0, fiber_g:2.0 },
    { cal_per_100g:300, protein_per_100g:4.4, carbs_per_100g:36.7, fat_per_100g:14.4 },
    'puff pastry + berry filling ~90g/serving'],

  // سمسمية = sesame+sugar candy, ~70g/serving
  ['df5fd9a7', 'سمسمية',
    { calories:380, protein_g:10.0, carbs_g:38.0, fat_g:22.0, fiber_g:4.0 },
    { cal_per_100g:543, protein_per_100g:14.3, carbs_per_100g:54.3, fat_per_100g:31.4 },
    'sesame candy bar ~70g/serving'],

  // ── Salads ────────────────────────────────────────────────────────────
  // سلطة الجرجير بالتفاح = arugula apple salad ~160g/serving
  ['e3d519c8', 'سلطة الجرجير بالتفاح',
    { calories:135, protein_g:3.0,  carbs_g:14.0, fat_g:7.0, fiber_g:3.0 },
    { cal_per_100g:84,  protein_per_100g:1.9, carbs_per_100g:8.8, fat_per_100g:4.4 },
    'arugula+apple salad ~160g/serving (was 618 cal/100g — error)'],

  // سلطة خضار باللبنة = vegetable salad with labneh ~160g/serving
  ['9920f22a', 'سلطة خضار باللبنة',
    { calories:185, protein_g:8.0,  carbs_g:14.0, fat_g:10.0, fiber_g:3.0 },
    { cal_per_100g:116, protein_per_100g:5.0, carbs_per_100g:8.8, fat_per_100g:6.3 },
    'vegetable+labneh salad ~160g/serving'],

  // ── Drinks ────────────────────────────────────────────────────────────
  // عصير الليمون بالريحان = lemon+basil juice ~250ml/serving
  ['32363fcf', 'عصير الليمون بالريحان',
    { calories:110, protein_g:0.5,  carbs_g:27.0, fat_g:0.0, fiber_g:0.5 },
    { cal_per_100g:44,  protein_per_100g:0.2, carbs_per_100g:10.8, fat_per_100g:0.0 },
    'lemon+basil juice ~250ml/serving (carbs were 55 > cal/4)'],
]

console.log(`\n🔧  Resolving full IDs and fixing ${FIXES.length} nutrition errors…\n`)

// Resolve short prefixes → full UUIDs via text cast
const { data: allRecipes } = await supabase
  .from('recipes')
  .select('id, name, calories, protein_g, carbs_g, fat_g')

const byPrefix = {}
for (const r of (allRecipes ?? [])) byPrefix[r.id.slice(0, 8)] = r

let fixed = 0, failed = 0

for (const [shortId, label, srv, p100, reason] of FIXES) {
  const cur = byPrefix[shortId]
  if (!cur) {
    console.log(`⚠️   ${label.slice(0, 40)} — id prefix ${shortId} not found`)
    failed++
    continue
  }
  const before = `${cur.calories} cal`

  const { error } = await supabase
    .from('recipes')
    .update({
      calories:          srv.calories,
      protein_g:         srv.protein_g,
      carbs_g:           srv.carbs_g,
      fat_g:             srv.fat_g,
      fiber_g:           srv.fiber_g ?? null,
      cal_per_100g:      p100.cal_per_100g,
      protein_per_100g:  p100.protein_per_100g,
      carbs_per_100g:    p100.carbs_per_100g,
      fat_per_100g:      p100.fat_per_100g,
      nutrition_estimated_at: new Date().toISOString(),
    })
    .eq('id', cur.id)

  if (error) {
    console.log(`❌  ${label.slice(0, 40)} — ${error.message}`)
    failed++
  } else {
    console.log(`✅  ${label.slice(0, 40)}`)
    console.log(`    Before: ${before}  →  After: ${srv.calories} cal | P:${srv.protein_g}g C:${srv.carbs_g}g F:${srv.fat_g}g`)
    console.log(`    Per 100g: ${p100.cal_per_100g} cal  |  Reason: ${reason}`)
    fixed++
  }
}

console.log(`\n── Summary ────────────────`)
console.log(`   Fixed:  ${fixed}`)
console.log(`   Failed: ${failed}`)
