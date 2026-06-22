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

// Fetch all recipes
const { data, error } = await supabase
  .from('recipes')
  .select('id, name, source')
  .order('name')

if (error) { console.error('❌', error.message); process.exit(1) }

const CANDIDATE_CATEGORIES = {
  'أرز ومجبوس':          ['أرز','مجبوس','كبسة','برياني','مندي','رز','بخاري','مقلوبة','زربيان','هريسة','قبولي'],
  'لحم':                 ['لحم','لحمة','لحوم','كباب','كفتة','شيش','مشاوي','ضلع','هبرة'],
  'دجاج':                ['دجاج','دجاجة','فراخ','فرخة'],
  'سمك ومأكولات بحرية':  ['سمك','ربيان','جمبري','سمبوسة','قريدس','حبار','بلطي','هامور','ميرو','فيليه'],
  'شوربة':               ['شوربة','حساء','مرق'],
  'سلطة':                ['سلطة','تبولة'],
  'حلويات':              ['حلوى','حلا','كيك','تمر','لقيمات','بسبوسة','كنافة','مهلبية','عصيدة','بقلاوة','سحلب','هريسة حلو','فطيرة','بودينج','تشيز','كاتو','موس','بان كيك','كريم','شوكولا'],
  'فطور وإفطار':         ['فطور','فول','فلافل','بيض','عجة','فتة','منتو'],
  'مقبلات':              ['مقبلات','محمرة','دقوس','بابا غنوج','حمص','متبل'],
  'خبز ومعجنات':         ['خبز','معجنات','سمبوسة','فطيرة','عجين','بروشيتا','أومليت'],
  'مشروبات':             ['عصير','شاي','قهوة','مشروب','كوكتيل'],
}

const lines = []
const log = (...args) => {
  const s = args.join(' ')
  console.log(s)
  lines.push(s)
}

log(`\n${'═'.repeat(60)}`)
log(`  تحليل تصنيف الوصفات — إجمالي ${data.length} وصفة`)
log(`${'═'.repeat(60)}\n`)

// Build match map: recipe → [matched categories]
const recipeCategories = new Map()   // id → { recipe, cats: [] }
const categoryMatches  = {}           // cat → [recipe]

for (const cat of Object.keys(CANDIDATE_CATEGORIES)) categoryMatches[cat] = []

for (const recipe of data) {
  const name = recipe.name ?? ''
  const matched = []
  for (const [cat, keywords] of Object.entries(CANDIDATE_CATEGORIES)) {
    if (keywords.some(kw => name.includes(kw))) {
      matched.push(cat)
      categoryMatches[cat].push(recipe)
    }
  }
  recipeCategories.set(recipe.id, { recipe, cats: matched })
}

// ── Per-category report ───────────────────────────────────────────────────────
log(`${'─'.repeat(60)}`)
log(`  نتائج التصنيف`)
log(`${'─'.repeat(60)}\n`)

for (const [cat, matches] of Object.entries(categoryMatches)) {
  const kws = CANDIDATE_CATEGORIES[cat].join('، ')
  log(`▸ ${cat}  (${matches.length} وصفة)`)
  log(`  الكلمات: ${kws}`)
  if (matches.length === 0) {
    log(`  — لا توجد وصفات مطابقة`)
  } else {
    log(`  أمثلة (أول 5):`)
    matches.slice(0, 5).forEach((r, i) => log(`    ${i + 1}. ${r.name}  [${r.source}]`))
  }
  log('')
}

// ── Uncategorized ─────────────────────────────────────────────────────────────
const uncategorized = data.filter(r => recipeCategories.get(r.id).cats.length === 0)
log(`${'─'.repeat(60)}`)
log(`  بدون تصنيف — ${uncategorized.length} وصفة`)
log(`${'─'.repeat(60)}\n`)
if (uncategorized.length === 0) {
  log('  — جميع الوصفات لها تصنيف واحد على الأقل ✅')
} else {
  uncategorized.forEach((r, i) => log(`  ${i + 1}. ${r.name}  [${r.source}]`))
}
log('')

// ── Multi-category ────────────────────────────────────────────────────────────
const multi = data.filter(r => recipeCategories.get(r.id).cats.length > 1)
log(`${'─'.repeat(60)}`)
log(`  وصفات في تصنيفات متعددة — ${multi.length} وصفة`)
log(`${'─'.repeat(60)}\n`)
if (multi.length === 0) {
  log('  — لا توجد وصفات مزدوجة')
} else {
  multi.forEach((r, i) => {
    const cats = recipeCategories.get(r.id).cats.join(' + ')
    log(`  ${i + 1}. ${r.name}  →  ${cats}  [${r.source}]`)
  })
}
log('')

// ── Summary table ─────────────────────────────────────────────────────────────
log(`${'═'.repeat(60)}`)
log(`  ملخص`)
log(`${'═'.repeat(60)}\n`)
log(`  إجمالي الوصفات:              ${data.length}`)
log(`  بدون تصنيف:                  ${uncategorized.length}`)
log(`  في تصنيفات متعددة:           ${multi.length}`)
log('')
log(`  التوزيع:`)
const sorted = Object.entries(categoryMatches).sort((a,b) => b[1].length - a[1].length)
for (const [cat, matches] of sorted) {
  const bar = '█'.repeat(Math.round(matches.length / 2))
  log(`  ${cat.padEnd(22)}  ${String(matches.length).padStart(3)}  ${bar}`)
}
log('')

// Save to file
const outPath = path.join(__dirname, 'category_analysis.txt')
fs.writeFileSync(outPath, lines.join('\n'), 'utf8')
console.log(`\n📄  Saved to ${outPath}`)
