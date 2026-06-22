#!/usr/bin/env node
/**
 * assign_categories.mjs
 * Assigns a category to every recipe in public.recipes
 * based on keyword matching against the recipe name.
 * First match wins (order of CATEGORY_RULES matters).
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

// ── Category rules — first match wins ────────────────────────────────────────
const CATEGORY_RULES = [
  {
    category: 'حلويات',
    keywords: ['حلوى','حلا','كيك','تمر','لقيمات','بسبوسة',
      'كنافة','مهلبية','عصيدة','بقلاوة','سحلب','فطيرة حلو',
      'بودينج','تشيز','موس','شوكولا','كريم برولية','كليجا',
      'قرص','مصابيب','مثلوثة','خبيصة','جريش حلو','عصيدة',
      'بان كيك','كاتو','كعك','بسكويت','كوكيز','براونيز',
      'تشيز كيك','وافل','دونات','كريب','حلاوة','تمر'],
  },
  {
    category: 'مشروبات',
    keywords: ['عصير','شاي','قهوة','مشروب','كوكتيل','لبن',
      'سموذي','ليموناضة','شربات'],
  },
  {
    category: 'شوربة',
    keywords: ['شوربة','حساء','مرق','هريسة شوربة'],
  },
  {
    category: 'سلطة',
    keywords: ['سلطة','تبولة','كول سلو','فتوش'],
  },
  {
    category: 'مقبلات',
    keywords: ['مقبلات','دقوس','بابا غنوج','حمص','متبل',
      'محمرة','لبنة','جبنة','براشيتا','بروشيتا'],
  },
  {
    category: 'خبز ومعجنات',
    keywords: ['خبز','معجنات','عجين','سمبوسة فطير',
      'فطير','بروشيتا'],
  },
  {
    category: 'سمك ومأكولات بحرية',
    keywords: ['سمك','ربيان','جمبري','قريدس','حبار',
      'بلطي','هامور','ميرو','فيليه سمك','تونة','ماكريل',
      'سردين','كابوريا','فيلية','سيباس'],
  },
  {
    category: 'دجاج',
    keywords: ['دجاج','دجاجة','فراخ','فرخة','كوردون',
      'تشيكن'],
  },
  {
    category: 'لحم',
    keywords: ['لحم','لحمة','لحوم','كباب','كفتة','شيش',
      'مشاوي','ضلع','هبرة','أضلع','ستيك','برغر',
      'لحم مفروم','كفتاه'],
  },
  {
    category: 'أرز ومجبوس',
    keywords: ['أرز','مجبوس','كبسة','برياني','مندي','رز',
      'بخاري','مقلوبة','زربيان','قبولي','مدغوس','ملوخية',
      'هريسة','جريش','مجدرة','رشتة','معكرونة','باستا',
      'مكرونة','سباغيتي','لازانيا','فتة أرز'],
  },
  {
    category: 'فطور',
    keywords: ['فطور','فول','فلافل','بيض','عجة','فتة',
      'منتو','شكشوكة','أومليت','فاهيتا فطور'],
  },
  {
    category: 'أطباق خليجية',
    keywords: ['غيمش','جريش','هريس','مراصيع','بليلة',
      'هنيني','قوزي','مدغوس','مضبي','مطازيز','عصيد',
      'سليق','كبدة','حنيذ','مكبوس','صالونة'],
  },
  {
    category: 'أخرى',
    keywords: [],  // catch-all
  },
]

function assignCategory(name) {
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.length === 0) return rule.category
    if (rule.keywords.some(kw => name.includes(kw))) return rule.category
  }
  return 'أخرى'
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// Fetch all recipes
console.log('📥  Fetching all recipes…')
const { data, error } = await supabase.from('recipes').select('id, name')
if (error) { console.error('❌', error.message); process.exit(1) }
console.log(`    ${data.length} recipes loaded\n`)

// Assign categories
const rows = data.map(r => ({
  id:       r.id,
  name:     r.name,
  category: assignCategory(r.name ?? ''),
}))

// Tally
const tally = {}
for (const r of rows) tally[r.category] = (tally[r.category] || 0) + 1

// Update in batches of 50
const BATCH = 50
let updated = 0
let failed  = 0

console.log('💾  Updating DB…\n')
for (let i = 0; i < rows.length; i += BATCH) {
  const batch  = rows.slice(i, i + BATCH)
  const batchN = Math.floor(i / BATCH) + 1

  // Supabase JS doesn't support bulk update by id easily —
  // update each row individually within the batch (Promise.all per batch)
  const results = await Promise.all(
    batch.map(r =>
      supabase.from('recipes').update({ category: r.category }).eq('id', r.id)
    )
  )
  const batchFailed = results.filter(r => r.error).length
  updated += batch.length - batchFailed
  failed  += batchFailed
  if (batchFailed > 0) {
    results.filter(r => r.error).forEach(r => console.error('  ❌', r.error.message))
  }
  console.log(`  ✓  Batch ${batchN}: ${batch.length} rows updated`)
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n── Category distribution ───────────────────────────')
const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
for (const [cat, count] of sorted) {
  const bar = '█'.repeat(Math.round(count / 2))
  console.log(`  ${cat.padEnd(22)}  ${String(count).padStart(3)}  ${bar}`)
}
console.log('\n── Summary ─────────────────────────────────────────')
console.log(`   Total recipes:   ${rows.length}`)
console.log(`   Updated:         ${updated}`)
console.log(`   Failed:          ${failed}`)
console.log(`   Catch-all (أخرى): ${tally['أخرى'] || 0}`)
console.log()
