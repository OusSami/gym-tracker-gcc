/**
 * insert_extras_v1.mjs — Phase 1: insert 14 standalone extra entries into recipes
 *
 * PREREQUISITE: Run migrations/migration_extras.sql in the Supabase SQL editor first.
 *
 * Extras added (all: recipe_type='extra', category='إضافات'):
 *   dates  (1): تمر
 *   nuts   (2): لوز محمص, مكسرات مشكلة
 *   fruit  (5): تفاح, موز, برتقال, فراولة, مانجو
 *   juice  (3): عصير برتقال طازج, عصير تفاح طازج, عصير مانجو طازج
 *   savory (1): زيتون
 *   dairy  (2): لبنة, جبن أبيض
 *
 * Nutrition sources: USDA FoodData Central. Per-serving values match
 * natural unit listed in `servings` column.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
function readEnv(f) {
  const env = {}
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}
const env = readEnv(path.join(__dirname, '..', '.env.local'))
const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])

// ── Pre-flight: confirm extra_type column exists ──────────────────────────────
const { error: colCheck } = await sb.from('recipes').select('extra_type').limit(1)
if (colCheck) {
  console.error('ERROR: extra_type column not found.')
  console.error('Run migrations/migration_extras.sql in the Supabase SQL editor first.')
  process.exit(1)
}
console.log('✓ extra_type column confirmed')

// ── Pre-flight: confirm no name collisions ────────────────────────────────────
const NAMES = [
  'تمر','لوز محمص','مكسرات مشكلة',
  'تفاح','موز','برتقال','فراولة','مانجو',
  'عصير برتقال طازج','عصير تفاح طازج','عصير مانجو طازج',
  'زيتون','لبنة','جبن أبيض',
]
const { data: existing } = await sb.from('recipes').select('name').in('name', NAMES)
if (existing?.length) {
  console.error('COLLISION: these names already exist in DB:', existing.map(r => r.name))
  process.exit(1)
}
console.log('✓ No name collisions')

// ── 14 extra rows ─────────────────────────────────────────────────────────────
// Fields: name, category, recipe_type, extra_type,
//         servings, calories, protein_g, carbs_g, fat_g, fiber_g,
//         cal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
//         source
//
// ingredients/steps/image_url/cook_time left NULL (not cooked recipes).

const EXTRAS = [
  // ── dates ──────────────────────────────────────────────────────────────────
  {
    name: 'تمر', extra_type: 'dates',
    servings: '1 تمرة (24 جرام)',
    calories: 66,   protein_g: 0.4,  carbs_g: 18.0, fat_g: 0.0,  fiber_g: 1.6,
    cal_per_100g: 277, protein_per_100g: 1.8, carbs_per_100g: 75.0, fat_per_100g: 0.2,
  },
  // ── nuts ───────────────────────────────────────────────────────────────────
  {
    name: 'لوز محمص', extra_type: 'nuts',
    servings: '30 جرام',
    calories: 179,  protein_g: 6.6,  carbs_g: 6.6,  fat_g: 15.0, fiber_g: 3.3,
    cal_per_100g: 598, protein_per_100g: 21.9, carbs_per_100g: 21.9, fat_per_100g: 49.9,
  },
  {
    name: 'مكسرات مشكلة', extra_type: 'nuts',
    servings: '30 جرام',
    calories: 182,  protein_g: 4.3,  carbs_g: 7.8,  fat_g: 16.2, fiber_g: 1.7,
    cal_per_100g: 607, protein_per_100g: 14.4, carbs_per_100g: 26.0, fat_per_100g: 54.1,
  },
  // ── fruit ──────────────────────────────────────────────────────────────────
  {
    name: 'تفاح', extra_type: 'fruit',
    servings: '1 حبة متوسطة (182 جرام)',
    calories: 95,   protein_g: 0.5,  carbs_g: 25.0, fat_g: 0.3,  fiber_g: 4.4,
    cal_per_100g: 52,  protein_per_100g: 0.3, carbs_per_100g: 13.8, fat_per_100g: 0.2,
  },
  {
    name: 'موز', extra_type: 'fruit',
    servings: '1 حبة متوسطة (118 جرام)',
    calories: 105,  protein_g: 1.3,  carbs_g: 27.0, fat_g: 0.4,  fiber_g: 3.1,
    cal_per_100g: 89,  protein_per_100g: 1.1, carbs_per_100g: 22.8, fat_per_100g: 0.3,
  },
  {
    name: 'برتقال', extra_type: 'fruit',
    servings: '1 حبة متوسطة (131 جرام)',
    calories: 62,   protein_g: 1.2,  carbs_g: 15.4, fat_g: 0.2,  fiber_g: 3.1,
    cal_per_100g: 47,  protein_per_100g: 0.9, carbs_per_100g: 11.8, fat_per_100g: 0.1,
  },
  {
    name: 'فراولة', extra_type: 'fruit',
    servings: 'كوب (150 جرام)',
    calories: 48,   protein_g: 1.0,  carbs_g: 11.5, fat_g: 0.5,  fiber_g: 3.0,
    cal_per_100g: 32,  protein_per_100g: 0.7, carbs_per_100g: 7.7,  fat_per_100g: 0.3,
  },
  {
    name: 'مانجو', extra_type: 'fruit',
    servings: '100 جرام',
    calories: 60,   protein_g: 0.8,  carbs_g: 15.0, fat_g: 0.4,  fiber_g: 1.6,
    cal_per_100g: 60,  protein_per_100g: 0.8, carbs_per_100g: 15.0, fat_per_100g: 0.4,
  },
  // ── juice ──────────────────────────────────────────────────────────────────
  {
    name: 'عصير برتقال طازج', extra_type: 'juice',
    servings: 'كوب (200 مل)',
    calories: 90,   protein_g: 1.4,  carbs_g: 21.0, fat_g: 0.4,  fiber_g: 0.4,
    cal_per_100g: 45,  protein_per_100g: 0.7, carbs_per_100g: 10.4, fat_per_100g: 0.2,
  },
  {
    name: 'عصير تفاح طازج', extra_type: 'juice',
    servings: 'كوب (200 مل)',
    calories: 92,   protein_g: 0.2,  carbs_g: 23.0, fat_g: 0.2,  fiber_g: 0.2,
    cal_per_100g: 46,  protein_per_100g: 0.1, carbs_per_100g: 11.5, fat_per_100g: 0.1,
  },
  {
    name: 'عصير مانجو طازج', extra_type: 'juice',
    servings: 'كوب (200 مل)',
    calories: 110,  protein_g: 1.2,  carbs_g: 26.0, fat_g: 0.5,  fiber_g: 1.0,
    cal_per_100g: 55,  protein_per_100g: 0.6, carbs_per_100g: 13.0, fat_per_100g: 0.3,
  },
  // ── savory ─────────────────────────────────────────────────────────────────
  {
    name: 'زيتون', extra_type: 'savory',
    servings: '10 حبات (33 جرام)',
    calories: 48,   protein_g: 0.3,  carbs_g: 1.3,  fat_g: 5.0,  fiber_g: 1.1,
    cal_per_100g: 145, protein_per_100g: 1.0, carbs_per_100g: 3.8, fat_per_100g: 15.0,
  },
  // ── dairy ──────────────────────────────────────────────────────────────────
  {
    name: 'لبنة', extra_type: 'dairy',
    servings: '2 ملعقة كبيرة (30 جرام)',
    calories: 45,   protein_g: 2.7,  carbs_g: 2.1,  fat_g: 3.0,  fiber_g: 0.0,
    cal_per_100g: 150, protein_per_100g: 9.0, carbs_per_100g: 7.0, fat_per_100g: 10.0,
  },
  {
    name: 'جبن أبيض', extra_type: 'dairy',
    servings: 'شريحة (30 جرام)',
    calories: 75,   protein_g: 4.2,  carbs_g: 1.2,  fat_g: 6.0,  fiber_g: 0.0,
    cal_per_100g: 250, protein_per_100g: 14.0, carbs_per_100g: 4.0, fat_per_100g: 20.0,
  },
]

// Attach shared fields
const rows = EXTRAS.map(e => ({
  ...e,
  category:     'إضافات',
  recipe_type:  'extra',
  source:       'manual',
}))

const { data: inserted, error: insertErr } = await sb
  .from('recipes')
  .insert(rows)
  .select('id, name, category, recipe_type, extra_type, servings, calories, protein_g, carbs_g, fat_g, fiber_g')

if (insertErr) {
  console.error('INSERT failed:', insertErr.message)
  process.exit(1)
}

console.log(`\n✓ Inserted ${inserted.length} extras:\n`)
const typeOrder = ['dates','nuts','fruit','juice','savory','dairy']
const sorted = inserted.sort((a,b) =>
  typeOrder.indexOf(a.extra_type) - typeOrder.indexOf(b.extra_type) ||
  a.name.localeCompare(b.name, 'ar')
)
for (const r of sorted) {
  console.log(`  [${r.extra_type.padEnd(6)}] ${r.name.padEnd(22)} | ${String(r.calories).padStart(3)} kcal | P:${r.protein_g} C:${r.carbs_g} F:${r.fat_g}g | ${r.servings}`)
}

// Final count
const { count } = await sb
  .from('recipes')
  .select('*', { count: 'exact', head: true })
  .eq('recipe_type', 'extra')
console.log(`\n✓ Total recipe_type='extra' rows in DB: ${count}`)
