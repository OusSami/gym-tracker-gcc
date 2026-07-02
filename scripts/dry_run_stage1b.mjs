#!/usr/bin/env node
/**
 * dry_run_stage1b.mjs — READ ONLY, no DB writes.
 *
 * Compares the Stage 1b reorder against the pre-Stage-1b ING_TYPES:
 *   OLD: produce types after proteins, مفروم in meat, no ثوم, no سلمون
 *   NEW: produce types before proteins (prevents "بصل مفروم" matching meat),
 *        ثوم/ثومة/كراث added to onion, سلمون added to fish, مفروم kept in meat
 *        so standalone "المفروم" (ground meat shorthand) still classifies correctly.
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readEnv(f) {
  const e = {}
  for (const l of fs.readFileSync(f,'utf8').split('\n')) {
    const m = l.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/)
    if (m) e[m[1]] = m[2].replace(/^["']|["']$/g,'')
  }
  return e
}
const env = readEnv(path.join(__dirname,'..', '.env.local'))
const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ── ING_TYPES variants ────────────────────────────────────────────────────

const ING_TYPES_OLD = [
  ['rice',    ['أرز', 'رز']],
  ['grain',   ['قمح', 'هريس', 'جريش', 'بلغر', 'برغل']],
  ['noodle',  ['شعيرية']],
  ['pasta',   ['معكرونة', 'مكرونة', 'سباغيتي', 'باستا', 'لازانيا', 'فرموتشيني']],
  ['flour',   ['دقيق', 'طحين']],
  ['oat',     ['شوفان']],
  // proteins BEFORE produce (original order — false-positive risk)
  ['chicken', ['دجاج', 'دجاجة', 'فراخ', 'فرخة', 'صدر دجاج', 'فيليه دجاج']],
  ['meat',    ['لحم', 'لحمة', 'لحوم', 'عجل', 'ضأن', 'خروف', 'ضلع', 'كبدة', 'هبرة', 'كفتة', 'كفته', 'مفروم']],
  ['shrimp',  ['ربيان', 'روبيان', 'جمبري', 'قريدس', 'كروفيتاس']],
  ['fish',    ['سمك', 'هامور', 'ميرو', 'بلطي', 'تونة', 'سردين', 'فيليه سمك', 'حبار']],  // no سلمون
  ['oil',     ['زيت']],
  ['butter',  ['زبدة', 'سمنة', 'سمن']],
  ['sugar',   ['سكر']],
  ['honey',   ['عسل']],
  ['chocolate',['شوكولا', 'شوكولاته', 'كاكاو']],
  ['egg',     ['بيض', 'بيضة', 'بيضات']],
  ['milk',    ['حليب', 'لبن حليب']],
  ['cream',   ['كريمة', 'قشطة', 'كريم']],
  ['yogurt',  ['زبادي', 'لبن', 'لبنة']],
  ['cheese',  ['جبنة', 'جبن', 'موزاريلا', 'شيدر', 'كريم تشيز']],
  ['coconut', ['جوز هند', 'كوكونات']],
  ['nut',     ['لوز', 'جوز', 'فستق', 'كاجو', 'مكسرات', 'بندق']],
  ['date',    ['تمر', 'رطب']],
  // produce AFTER proteins (original position)
  ['potato',  ['بطاطس', 'بطاطا']],
  ['pumpkin', ['قرع', 'يقطين']],
  ['tomato',  ['طماطم', 'طماطة', 'تماطم', 'صلصة طماطم', 'معجون الطماطم', 'معجون طماطم']],
  ['lentil',  ['عدس']],
  ['chickpea',['حمص']],
  ['legume',  ['فاصوليا', 'لوبيا', 'فول']],
  ['onion',   ['بصل', 'بصلة']],              // no ثوم/كراث
  ['carrot',  ['جزر', 'جزرة']],
  ['veggie',  ['خضار', 'فلفل', 'خيار', 'كوسا', 'باذنجان', 'ملفوف', 'كرنب', 'بروكلي']],
  ['water',   ['ماء', 'مياه', 'ماءً']],
]

const ING_TYPES_NEW = [
  ['rice',    ['أرز', 'رز']],
  ['grain',   ['قمح', 'هريس', 'جريش', 'بلغر', 'برغل']],
  ['noodle',  ['شعيرية']],
  ['pasta',   ['معكرونة', 'مكرونة', 'سباغيتي', 'باستا', 'لازانيا', 'فرموتشيني']],
  ['flour',   ['دقيق', 'طحين']],
  ['oat',     ['شوفان']],
  // Produce before proteins — Stage 1b reorder
  // chickpea/legume intentionally NOT here; they go after nut/butter (see below)
  ['potato',  ['بطاطس', 'بطاطا']],
  ['pumpkin', ['قرع', 'يقطين']],
  ['tomato',  ['طماطم', 'طماطة', 'تماطم', 'صلصة طماطم', 'معجون الطماطم', 'معجون طماطم']],
  ['lentil',  ['عدس']],
  ['onion',   ['بصل', 'بصلة', 'كراث', 'ثوم', 'ثومة']],  // ثوم/كراث added
  ['carrot',  ['جزر', 'جزرة']],
  ['veggie',  ['خضار', 'فلفل', 'خيار', 'كوسا', 'باذنجان', 'ملفوف', 'كرنب', 'بروكلي']],
  // Proteins after produce; مفروم stays for standalone ground-meat shorthand
  ['chicken', ['دجاج', 'دجاجة', 'فراخ', 'فرخة', 'صدر دجاج', 'فيليه دجاج']],
  ['meat',    ['لحم', 'لحمة', 'لحوم', 'عجل', 'ضأن', 'خروف', 'ضلع', 'كبدة', 'هبرة', 'كفتة', 'كفته', 'مفروم']],
  ['shrimp',  ['ربيان', 'روبيان', 'جمبري', 'قريدس', 'كروفيتاس']],
  ['fish',    ['سمك', 'هامور', 'ميرو', 'بلطي', 'تونة', 'سردين', 'فيليه سمك', 'حبار', 'سلمون']],  // سلمون added
  // Butter before legumes: "زبدة الفول السوداني" must match butter first
  ['oil',     ['زيت']],
  ['butter',  ['زبدة', 'سمنة', 'سمن']],
  ['sugar',   ['سكر']],
  ['honey',   ['عسل']],
  ['chocolate',['شوكولا', 'شوكولاته', 'كاكاو']],
  ['egg',     ['بيض', 'بيضة', 'بيضات']],
  // Legumes before dairy: 'لبن' (yogurt keyword) is substring of 'البني'
  // (brown), so "الفول البني" must match legume via 'فول' before yogurt
  ['legume',  ['فاصوليا', 'لوبيا', 'فول']],
  // Dairy before nuts: "حليب لوز" (almond milk) must match milk via 'حليب'
  // before nut matches via 'لوز'
  ['milk',    ['حليب', 'لبن حليب']],
  ['cream',   ['كريمة', 'قشطة', 'كريم']],
  ['yogurt',  ['زبادي', 'لبن', 'لبنة']],
  ['cheese',  ['جبنة', 'جبن', 'موزاريلا', 'شيدر', 'كريم تشيز']],
  // Nuts before chickpea: 'حمص' is a substring of 'محمص' (roasted),
  // so "لوز محمص" must match nut via 'لوز' before reaching chickpea
  ['coconut', ['جوز هند', 'كوكونات']],
  ['nut',     ['لوز', 'جوز', 'فستق', 'كاجو', 'مكسرات', 'بندق']],
  ['date',    ['تمر', 'رطب']],
  ['chickpea',['حمص']],
  ['water',   ['ماء', 'مياه', 'ماءً']],
]

// ── Shared parsing logic (identical to estimate_nutrition.mjs) ─────────────

function toWestern(s) {
  return String(s).replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
}
function parseServings(s) {
  if (!s) return 4
  const n = parseInt(toWestern(s).match(/(\d+)/)?.[1] ?? '4', 10)
  return n >= 1 && n <= 30 ? n : 4
}

const PROTEIN_PER_PERSON_G = { chicken: 300, meat: 200, shrimp: 125, fish: 150 }
const PROTEIN_SCALE_TYPES  = new Set(Object.keys(PROTEIN_PER_PERSON_G))

const ING_DEFAULT_G = {
  rice: 360, grain: 300, noodle: 250, pasta: 300, flour: 250, oat: 200,
  chicken: 1200, meat: 800, shrimp: 500, fish: 600,
  oil: 30, butter: 30, sugar: 50, honey: 30, chocolate: 50,
  egg: 0, milk: 200, cream: 100, yogurt: 200, cheese: 80, coconut: 50,
  nut: 50, date: 100, potato: 300, pumpkin: 300, tomato: 200,
  lentil: 200, chickpea: 200, legume: 200, onion: 200, carrot: 150,
  veggie: 200, water: 800,
}

const MACRO = {
  rice:     { cal: 360, prot: 6.8, fat: 0.6, fiber: 0.6 },
  grain:    { cal: 340, prot: 12,  fat: 2,   fiber: 10  },
  noodle:   { cal: 360, prot: 12,  fat: 1.5, fiber: 2   },
  pasta:    { cal: 360, prot: 12,  fat: 1.5, fiber: 2   },
  flour:    { cal: 360, prot: 10,  fat: 1,   fiber: 3   },
  oat:      { cal: 389, prot: 17,  fat: 7,   fiber: 11  },
  chicken:  { cal: 240, prot: 27,  fat: 14,  rawFactor: 0.70 },
  meat:     { cal: 240, prot: 26,  fat: 15,  rawFactor: 0.70 },
  shrimp:   { cal: 100, prot: 24,  fat: 1,   rawFactor: 0.85 },
  fish:     { cal: 200, prot: 20,  fat: 12,  rawFactor: 0.75 },
  oil:      { cal: 884, prot: 0,   fat: 100, fiber: 0   },
  butter:   { cal: 720, prot: 1,   fat: 82,  fiber: 0   },
  sugar:    { cal: 400, prot: 0,   fat: 0,   fiber: 0   },
  honey:    { cal: 304, prot: 0.3, fat: 0,   fiber: 0   },
  chocolate:{ cal: 550, prot: 5,   fat: 31,  fiber: 7   },
  egg:      { cal: 155, prot: 13,  fat: 11,  perUnit: 60 },
  milk:     { cal: 60,  prot: 3.2, fat: 3.3, fiber: 0   },
  cream:    { cal: 300, prot: 2.5, fat: 30,  fiber: 0   },
  yogurt:   { cal: 90,  prot: 4,   fat: 5,   fiber: 0   },
  cheese:   { cal: 350, prot: 22,  fat: 28,  fiber: 0   },
  coconut:  { cal: 650, prot: 6,   fat: 65,  fiber: 9   },
  nut:      { cal: 600, prot: 20,  fat: 50,  fiber: 7   },
  date:     { cal: 280, prot: 2,   fat: 0.5, fiber: 6.7 },
  potato:   { cal: 80,  prot: 2,   fat: 0.1, fiber: 2.2 },
  pumpkin:  { cal: 26,  prot: 1,   fat: 0.1, fiber: 0.5 },
  tomato:   { cal: 20,  prot: 1,   fat: 0.2, fiber: 1.2 },
  lentil:   { cal: 340, prot: 24,  fat: 1,   fiber: 12  },
  chickpea: { cal: 360, prot: 20,  fat: 6,   fiber: 12  },
  legume:   { cal: 340, prot: 22,  fat: 1.5, fiber: 14  },
  onion:    { cal: 40,  prot: 1,   fat: 0.1, fiber: 1.7 },
  carrot:   { cal: 41,  prot: 0.9, fat: 0.2, fiber: 2.8 },
  veggie:   { cal: 30,  prot: 2,   fat: 0.3, fiber: 2.5 },
  water:    { cal: 0,   prot: 0,   fat: 0,   fiber: 0   },
}

const UNIT_G = [
  [/دجاجتين|دجاجة كاملة/,  () => 2400],
  [/دجاجة|دجاجه/,          () => 1200],
  [/كيلو(?:غرام|غرامات|جرام)?(?:\s|$)/, m => parseFloat(m) * 1000],
  [/(?:نصف|½)\s*كيلو/,     () => 500],
  [/غراماً|غرامات|غرام|جرام|جم/, m => parseFloat(m)],
  [/ملعقة كبيرة|ملعقة كبيره|م\.ك\b/, m => parseFloat(m) * 15],
  [/ملعقة صغيرة|ملعقة صغيره|م\.ص\b/, m => parseFloat(m) * 5],
  [/كوب|أكواب/,             m => parseFloat(m) * 240],
  [/ملليتر|مل\b/,           m => parseFloat(m)],
  [/لتر|ليتر/,              m => parseFloat(m) * 1000],
]

function ingToGrams(text) {
  const t = toWestern(text)
  for (const [pat, fn] of UNIT_G) {
    const m = t.match(new RegExp('(نصف|ثلث|ربع|ثلاثة أرباع|\\d+\\.?\\d*)\\s*(?:و(?:نصف|ثلث|ربع))?\\s*' + pat.source))
    if (m) {
      let val = 0
      const lead = m[1]
      if      (lead === 'نصف' || lead === '½') val = 0.5
      else if (lead === 'ثلث')                 val = 0.333
      else if (lead === 'ربع')                 val = 0.25
      else if (lead === 'ثلاثة أرباع')          val = 0.75
      else val = parseFloat(lead) || 1
      if (m[0].includes('ونصف')) val += 0.5
      else if (m[0].includes('وثلث')) val += 0.333
      else if (m[0].includes('وربع')) val += 0.25
      return fn(val, m)
    }
  }
  return 0
}

function classifyIng(text, ingTypes) {
  for (const [type, kws] of ingTypes) {
    if (kws.some(kw => text.includes(kw))) return type
  }
  return null
}

function estimateCal(ingredients, servings, ingTypes) {
  const srv = parseServings(servings)
  let totalCal = 0
  for (const ing of (ingredients || [])) {
    const type = classifyIng(ing, ingTypes)
    if (!type) continue
    const grams = ingToGrams(ing)
    let g
    if (grams > 0) {
      g = grams
    } else if (PROTEIN_SCALE_TYPES.has(type)) {
      g = PROTEIN_PER_PERSON_G[type] * Math.min(srv, 8)
    } else {
      g = ING_DEFAULT_G[type] ?? 0
    }
    if (g <= 0) continue
    const macro = MACRO[type]
    if (!macro) continue
    if (type === 'egg') {
      const units = grams > 0 ? grams / (macro.perUnit || 60) : 1
      totalCal += units * macro.cal * (macro.perUnit || 60) / 100
    } else if (macro.rawFactor) {
      totalCal += (g * macro.rawFactor) * (macro.cal / 100)
    } else {
      totalCal += g * (macro.cal / 100)
    }
  }
  return Math.min(Math.round(totalCal / parseServings(servings)), 1200)
}

// Helper: did ingredient match meat specifically via مفروم keyword
// (i.e. no other meat keyword present)?
const ING_TYPES_OLD_NO_MAFRUM = ING_TYPES_OLD.map(([t, kws]) =>
  t === 'meat' ? [t, kws.filter(k => k !== 'مفروم')] : [t, kws]
)
function wasMafrumOnlyMeat(ing) {
  return classifyIng(ing, ING_TYPES_OLD) === 'meat' &&
         classifyIng(ing, ING_TYPES_OLD_NO_MAFRUM) !== 'meat'
}

// ── Fetch recipes ─────────────────────────────────────────────────────────
const { data: recipes } = await sb.from('recipes')
  .select('id, name, category, servings, ingredients, calories')
  .not('ingredients', 'is', null)
  .order('name')

if (!recipes) { console.error('❌  Could not fetch recipes'); process.exit(1) }

// ── Compare OLD vs NEW ────────────────────────────────────────────────────
const changed = []

function diffDetail(ingredients) {
  const details = []
  for (const ing of (ingredients || [])) {
    const o = classifyIng(ing, ING_TYPES_OLD)
    const n = classifyIng(ing, ING_TYPES_NEW)
    if (o !== n) details.push({ ing, o, n })
  }
  return details
}

for (const r of recipes) {
  const oldCal = estimateCal(r.ingredients, r.servings, ING_TYPES_OLD)
  const newCal = estimateCal(r.ingredients, r.servings, ING_TYPES_NEW)
  if (oldCal === newCal) continue
  const delta = newCal - oldCal
  const pct   = oldCal > 0 ? Math.round((delta / oldCal) * 100) : 0
  changed.push({ name: r.name, category: r.category, srv: parseServings(r.servings),
    oldCal, newCal, delta, pct, detail: diffDetail(r.ingredients) })
}

// Ground-meat preservation: standalone مفروم still resolves to 'meat' in NEW
const groundMeatPreserved = recipes.filter(r =>
  (r.ingredients || []).some(ing =>
    wasMafrumOnlyMeat(ing) && classifyIng(ing, ING_TYPES_NEW) === 'meat'
  )
)

// Salmon gains
const salmonGained = recipes.filter(r =>
  (r.ingredients || []).some(ing => ing.includes('سلمون') &&
    classifyIng(ing, ING_TYPES_OLD) !== 'fish' &&
    classifyIng(ing, ING_TYPES_NEW) === 'fish')
)

changed.sort((a, b) => a.pct - b.pct)
const decreases    = changed.filter(r => r.delta < 0)
const increases    = changed.filter(r => r.delta > 0)
const bigDecreases = decreases.filter(r => r.pct <= -50)
const bigIncreases = increases.filter(r => r.pct >= 50)
const nearZero     = changed.filter(r => r.newCal <= 5)

const line = '═'.repeat(70)
console.log(`\n${line}`)
console.log('   STAGE 1b DRY RUN — produce-before-proteins + ثوم + سلمون')
console.log(`${line}\n`)

console.log(`Total recipes changed: ${changed.length}`)
console.log(`  Decreases: ${decreases.length}  (avg ${Math.round(decreases.reduce((s,r)=>s+r.pct,0)/Math.max(decreases.length,1))}%)`)
console.log(`  Increases: ${increases.length}  (avg ${Math.round(increases.reduce((s,r)=>s+r.pct,0)/Math.max(increases.length,1))}%)`)
console.log(`  >50% decrease: ${bigDecreases.length}`)
console.log(`  >50% increase: ${bigIncreases.length}`)
console.log(`  Near-zero new (≤5 cal): ${nearZero.length}`)
console.log()

console.log(`── Ground-meat preservation ────────────────────────────────────────`)
console.log(`   Standalone مفروم ingredients that STILL resolve to 'meat' in NEW`)
console.log(`   (no produce keyword matched → fell through to meat correctly):`)
console.log(`   ${groundMeatPreserved.length} recipes`)
for (const r of groundMeatPreserved.slice(0, 8)) {
  const hits = (r.ingredients || []).filter(wasMafrumOnlyMeat)
    .filter(ing => classifyIng(ing, ING_TYPES_NEW) === 'meat')
  console.log(`   • ${r.name.slice(0,50)}`)
  for (const ing of hits.slice(0,2)) console.log(`       "${ing}"`)
}
if (groundMeatPreserved.length > 8) console.log(`   ... and ${groundMeatPreserved.length - 8} more`)
console.log()

console.log(`── سلمون (salmon) keyword addition ────────────────────────────────`)
console.log(`   ${salmonGained.length} recipes where سلمون ingredient now classifies as 'fish':`)
for (const r of salmonGained) {
  const o = estimateCal(r.ingredients, r.servings, ING_TYPES_OLD)
  const n = estimateCal(r.ingredients, r.servings, ING_TYPES_NEW)
  console.log(`   • ${r.name.slice(0,50).padEnd(50)}  ${o}→${n} cal/serving`)
  const salIngs = (r.ingredients||[]).filter(i=>i.includes('سلمون'))
  for (const ing of salIngs.slice(0,2)) console.log(`     "${ing}"`)
}
console.log()

if (nearZero.length > 0) {
  console.log(`── Near-zero after reorder (≤5 cal) — investigate ─────────────────`)
  for (const r of nearZero) {
    console.log(`   ${r.pct}%  ${r.oldCal}→${r.newCal}  [${r.category}]  ${r.name}`)
    for (const d of r.detail) console.log(`     "${d.ing}"  ${d.o}→${d.n}`)
  }
  console.log()
}

if (bigDecreases.length || bigIncreases.length) {
  console.log(`── Outliers >50% decrease (first 30) ──────────────────────────────`)
  for (const r of bigDecreases.slice(0, 30)) {
    console.log(`  ${r.pct}%  ${r.oldCal}→${r.newCal}  [srv=${r.srv}]  ${r.name}  (${r.category})`)
  }
  if (bigDecreases.length > 30) console.log(`  ... and ${bigDecreases.length - 30} more`)
  if (bigIncreases.length) {
    console.log(`\n── Outliers >50% increase ──────────────────────────────────────────`)
    for (const r of bigIncreases) {
      console.log(`  +${r.pct}%  ${r.oldCal}→${r.newCal}  [srv=${r.srv}]  ${r.name}  (${r.category})`)
      for (const d of r.detail) console.log(`     "${d.ing}"  ${d.o}→${d.n}`)
    }
  }
  console.log()
}

console.log(`── All changes sorted by % (first 40) ─────────────────────────────`)
for (const r of changed.slice(0, 40)) {
  console.log(`  ${r.pct > 0 ? '+' : ''}${r.pct}%  ${r.oldCal}→${r.newCal}  [srv=${r.srv}]  ${r.name}`)
}
if (changed.length > 40) console.log(`  ... and ${changed.length - 40} more`)

console.log(`\n${line}`)
console.log('   DRY RUN — no DB writes made')
console.log(`${line}\n`)
