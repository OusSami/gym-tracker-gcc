#!/usr/bin/env node
/**
 * dry_run_olive.mjs
 *
 * Olive/oil (زيتون/زيت) misclassification fix — read-only dry-run.
 *
 * The bug: 'زيت' (oil, 884 kcal/100g) is a prefix of 'زيتون' (olive), so any
 * ingredient string containing 'زيتون' matches the oil keyword.
 *
 * The fix: before the ING_TYPES loop, check for olive via negative-exclusion —
 *   text.includes('زيتون') && !text.includes('زيت زيتون') && !text.includes('زيت الزيتون')
 * This captures standalone olives while leaving "زيت زيتون"/"زيت الزيتون" (olive
 * oil, legitimately 884 kcal/100g) correctly classified as oil.
 *
 * Secondary fix: حبة/حبات defaults to 130g (generic vegetable piece) in UNIT_G,
 * but a single olive is ~4g. For olive type, we re-parse the piece count and
 * multiply by 4g instead.
 *
 * Reports: old vs new for the 9 known affected recipes + full 690-recipe pass.
 * Does NOT write to DB.
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readEnvFile(f) {
  const env = {}
  if (!fs.existsSync(f)) return env
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}
const envLocal = readEnvFile(path.join(__dirname, '..', '.env.local'))
const SB_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL  || envLocal['NEXT_PUBLIC_SUPABASE_URL']
const SB_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || envLocal['SUPABASE_SERVICE_ROLE_KEY']
if (!SB_URL || !SB_KEY) { console.error('❌  Missing Supabase credentials'); process.exit(1) }
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(SB_URL, SB_KEY)

// ══════════════════════════════════════════════════════════════════
//  SHARED PARSING UTILITIES
// ══════════════════════════════════════════════════════════════════

function toWestern(s) {
  return String(s).replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
}
function parseLeadNum(text) {
  const t = toWestern(text)
  if (/ثلاثة أرباع|¾/.test(t)) return 0.75
  if (/نصف/.test(t)) return 0.5
  if (/ثلث/.test(t)) return 0.333
  if (/ربع/.test(t)) return 0.25
  const m = t.match(/(\d+\.?\d*)/)
  return m ? parseFloat(m[1]) : 1
}
function parseServings(s) {
  if (!s) return 4
  const n = parseInt(toWestern(s).match(/(\d+)/)?.[1] ?? '4', 10)
  return n >= 1 && n <= 30 ? n : 4
}
const UNIT_G = [
  [/كيلوغرام|كيلوجرام/,    1000],
  [/كيلو/,                  1000],
  [/غراماً|غرامات|غرام/,      1],
  [/مللتر|مل(?!عقة)/,         1],
  [/لتر/,                   1000],
  [/أكواب|اكواب|كوب|كأس/,    220],
  [/ملاعق كبيرة|ملعقة كبيرة/, 15],
  [/ملاعق صغيرة|ملعقة صغيرة/,  5],
  [/ملاعق|ملعقة/,             12],
  [/حبات|حبة/,               130],   // generic piece; overridden to 4g for olive
  [/شرائح|شريحة/,             80],
  [/قطع|قطعة/,               100],
  [/وحدات|وحدة/,              80],
]
function ingToGrams(text) {
  const t = toWestern(text)
  if (/دجاجة كاملة|دجاجتين كاملتين|دجاجة واحدة/.test(text)) {
    return /دجاجتين/.test(text) ? 2400 : 1200
  }
  if (/(?:^|[\s:،])كيلو(?:$|[\s،])/.test(text) && !t.match(/\d\s*كيلو/)) return 1000
  if (/نصف\s*كيلو/.test(text)) return 500
  if (/ربع\s*كيلو/.test(text)) return 250
  for (const [pattern, perUnit] of UNIT_G) {
    const rx = new RegExp(
      `(نصف|ثلث|ربع|ثلاثة أرباع|\\d+\\.?\\d*)\\s*(?:و(?:نصف|ثلث|ربع))?\\s*${pattern.source}`,
      'i'
    )
    const m = t.match(rx)
    if (m) return parseLeadNum(m[1]) * perUnit
  }
  const bareNum = t.match(/^[^٠-٩\d]*(\d+\.?\d*)\s*(?:$|[،,])/)
  if (bareNum) return parseFloat(bareNum[1])
  return 0
}

// ══════════════════════════════════════════════════════════════════
//  SHARED ING_TYPES (post-Stage-2, same for OLD and NEW paths)
// ══════════════════════════════════════════════════════════════════

const ING_TYPES = [
  ['rice',      ['أرز', 'رز']],
  ['grain',     ['قمح', 'هريس', 'جريش', 'بلغر', 'برغل']],
  ['noodle',    ['شعيرية']],
  ['pasta',     ['معكرونة', 'مكرونة', 'سباغيتي', 'باستا', 'لازانيا', 'فرموتشيني']],
  ['flour',     ['دقيق', 'طحين']],
  ['oat',       ['شوفان']],
  ['potato',    ['بطاطس', 'بطاطا']],
  ['pumpkin',   ['قرع', 'يقطين']],
  ['tomato',    ['طماطم', 'طماطة', 'تماطم', 'صلصة طماطم', 'معجون الطماطم', 'معجون طماطم']],
  ['lentil',    ['عدس']],
  ['onion',     ['بصل', 'بصلة', 'كراث', 'ثوم', 'ثومة']],
  ['carrot',    ['جزر', 'جزرة']],
  ['veggie',    [
    'خضار', 'فلفل', 'خيار', 'كوسا', 'باذنجان', 'ملفوف', 'كرنب', 'بروكلي',
    'سبانخ', 'كزبرة', 'بقدونس', 'نعناع', 'زعتر', 'ريحان',
    'كرفس', 'هليون', 'شمندر', 'بنجر', 'فطر', 'مشروم',
    'ورق العنب',
  ]],
  ['fruit',     [
    'موز', 'تفاح', 'مانجو', 'فراولة', 'رمان', 'تين', 'توت', 'عنب',
    'برتقال', 'أناناس', 'كيوي', 'مشمش', 'جوافة', 'كمثرى', 'خوخ',
    'يوسفي', 'فاكهة',
  ]],
  ['avocado',   ['أفوكادو']],
  ['chicken',   ['دجاج', 'دجاجة', 'فراخ', 'فرخة', 'صدر دجاج', 'فيليه دجاج']],
  ['meat',      ['لحم', 'لحمة', 'لحوم', 'عجل', 'ضأن', 'خروف', 'ضلع', 'كبدة', 'هبرة', 'كفتة', 'كفته', 'مفروم']],
  ['shrimp',    ['ربيان', 'روبيان', 'جمبري', 'قريدس', 'كروفيتاس']],
  ['fish',      ['سمك', 'هامور', 'ميرو', 'بلطي', 'تونة', 'سردين', 'فيليه سمك', 'حبار', 'سلمون']],
  ['oil',       ['زيت']],
  ['butter',    ['زبدة', 'سمنة', 'سمن']],
  ['corn',      ['ذرة']],
  ['sugar',     ['سكر']],
  ['honey',     ['عسل']],
  ['chocolate', ['شوكولا', 'شوكولاته', 'كاكاو']],
  ['egg',       ['بيض', 'بيضة', 'بيضات']],
  ['legume',    ['فاصوليا', 'لوبيا', 'فول']],
  ['milk',      ['حليب', 'لبن حليب']],
  ['cream',     ['كريمة', 'قشطة', 'كريم']],
  ['yogurt',    ['زبادي', 'لبن', 'لبنة']],
  ['cheese',    ['جبنة', 'جبن', 'موزاريلا', 'شيدر', 'كريم تشيز']],
  ['coconut',   ['جوز هند', 'كوكونات']],
  ['nut',       ['لوز', 'جوز', 'فستق', 'كاجو', 'مكسرات', 'بندق']],
  ['date',      ['تمر', 'رطب']],
  ['chickpea',  ['حمص']],
  ['water',     ['ماء', 'مياه', 'ماءً']],
]

// ══════════════════════════════════════════════════════════════════
//  OLD path — no olive type
// ══════════════════════════════════════════════════════════════════

function classifyOld(text) {
  for (const [type, keywords] of ING_TYPES) {
    if (keywords.some(kw => text.includes(kw))) return type
  }
  return 'other'
}

// ══════════════════════════════════════════════════════════════════
//  NEW path — olive check before the ING_TYPES loop
// ══════════════════════════════════════════════════════════════════

function classifyNew(text) {
  // Olive check via negative exclusion:
  //   'زيت' is a prefix of 'زيتون', so simple .includes('زيتون') would also
  //   fire for "زيت زيتون" / "زيت الزيتون" (olive oil → should stay as oil).
  //   Exclude those two oil-context phrases before returning 'olive'.
  if (text.includes('زيتون') &&
      !text.includes('زيت زيتون') &&
      !text.includes('زيت الزيتون')) {
    return 'olive'
  }
  for (const [type, keywords] of ING_TYPES) {
    if (keywords.some(kw => text.includes(kw))) return type
  }
  return 'other'
}

// ══════════════════════════════════════════════════════════════════
//  DENSITY + DEFAULTS (shared; olive entries added for NEW path)
// ══════════════════════════════════════════════════════════════════

const DENSITY = {
  riceCooked:   [130,  2.7, 28.0, 0.3, 0.4],
  grainCooked:  [110,  3.5, 23.0, 0.5, 1.8],
  noodleCk:     [155,  5.0, 31.0, 0.9, 1.2],
  pastaCk:      [158,  5.5, 31.0, 0.9, 1.8],
  bakedFlour:   [280,  8.0, 55.0, 2.0, 2.5],
  oatCk:        [68,   2.5, 12.0, 1.5, 1.7],
  chickenCk:    [165, 25.0,  0.0, 6.5, 0.0],
  meatCk:       [240, 26.0,  0.0,15.0, 0.0],
  shrimpCk:     [99,  24.0,  0.2, 0.3, 0.0],
  fishCk:       [130, 20.0,  0.0, 5.0, 0.0],
  oil:          [884,  0.0,  0.0,100.0,0.0],
  butter:       [717,  0.9,  0.1, 81.0,0.0],
  sugar:        [387,  0.0,100.0, 0.0, 0.0],
  honey:        [304,  0.3, 82.0, 0.0, 0.2],
  chocolate:    [546,  5.0, 60.0, 31.0,7.0],
  egg:          [155, 13.0,  1.1, 11.0,0.0],
  milk:         [61,   3.4,  4.7,  3.3,0.0],
  cream:        [345,  2.8,  3.0, 36.0,0.0],
  yogurt:       [59,   3.5,  3.6,  3.3,0.0],
  cheese:       [350, 25.0,  1.3, 28.0,0.0],
  coconut:      [354,  3.3, 15.0, 33.0,9.0],
  nut:          [600, 20.0, 20.0, 50.0,7.0],
  date:         [277,  1.8, 75.0,  0.2,6.7],
  potatoCk:     [77,   2.0, 17.0,  0.1,2.2],
  pumpkinCk:    [26,   1.0,  6.5,  0.1,0.5],
  tomato:       [18,   0.9,  3.9,  0.2,1.2],
  lentilCk:     [116,  9.0, 20.0,  0.4,7.9],
  chickpeaCk:   [164,  8.9, 27.0,  2.6,7.6],
  legumeCk:     [127,  8.0, 23.0,  0.5,7.0],
  onion:        [40,   1.1,  9.3,  0.1,1.7],
  carrot:       [41,   0.9,  9.6,  0.2,2.8],
  veggie:       [30,   2.0,  5.0,  0.3,2.5],
  fruit:        [65,   0.8, 16.0,  0.3,2.0],
  avocado:      [160,  2.0,  9.0, 15.0,6.7],
  corn:         [86,   3.3, 19.0,  1.2,2.7],
  // Stage Olive (NEW path only):
  olive:        [115,  0.8,  6.0, 10.5,1.5],  // USDA per 100g, ripe/canned
}

const ING_DEFAULT_G = {
  rice: 360, grain: 300, noodle: 250, pasta: 300, flour: 250, oat: 200,
  chicken: 1200, meat: 800, shrimp: 500, fish: 600,
  oil: 45, butter: 60, corn: 150, sugar: 150, honey: 60, chocolate: 80,
  egg: 0,
  milk: 300, cream: 150, yogurt: 250, cheese: 120, coconut: 80,
  nut: 80, date: 100,
  potato: 300, pumpkin: 400, tomato: 300, lentil: 250, chickpea: 250,
  legume: 200, onion: 200, carrot: 150, veggie: 200,
  fruit: 150, avocado: 100,
  olive: 30,   // ~8 medium olives as a garnish
  water: 800,
}

const PROTEIN_PER_PERSON_G = { chicken: 300, meat: 200, shrimp: 125, fish: 150 }
const PROTEIN_SCALE_TYPES  = new Set(Object.keys(PROTEIN_PER_PERSON_G))

function addDensity(key, rawG, expansionFactor = 1) {
  const cookedG = rawG * expansionFactor
  const d = DENSITY[key]
  if (!d || cookedG <= 0) return { cal:0, prot:0, carbs:0, fat:0, fiber:0, wt:0 }
  return {
    cal:   cookedG * d[0] / 100,
    prot:  cookedG * d[1] / 100,
    carbs: cookedG * d[2] / 100,
    fat:   cookedG * d[3] / 100,
    fiber: cookedG * d[4] / 100,
    wt:    cookedG,
  }
}
function sumNutrients(...parts) {
  const t = { cal:0, prot:0, carbs:0, fat:0, fiber:0, wt:0 }
  for (const p of parts) { t.cal+=p.cal; t.prot+=p.prot; t.carbs+=p.carbs; t.fat+=p.fat; t.fiber+=p.fiber; t.wt+=p.wt }
  return t
}

// ──────────────────────────────────────────────────────────────────
//  Generic profile builder — accepts a classify function
// ──────────────────────────────────────────────────────────────────

function buildProfile(ingredients, srv, classifyFn, includeOlive) {
  const p = {
    riceG:0, grainG:0, noodleG:0, pastaG:0, flourG:0, oatG:0,
    chickenG:0, meatG:0, shrimpG:0, fishG:0,
    oilG:0, butterG:0, cornG:0, sugarG:0, honeyG:0, chocolateG:0,
    eggsN:0,
    milkML:0, creamML:0, yogurtG:0, cheeseG:0, coconutG:0,
    nutG:0, dateG:0,
    potatoG:0, pumpkinG:0, tomatoG:0, lentilG:0, chickpeaG:0,
    legumesG:0, onionG:0, carrotG:0, veggieG:0,
    fruitG:0, avocadoG:0, oliveG:0, waterML:0,
  }

  for (const ing of (ingredients || [])) {
    const type  = classifyFn(ing)
    const grams = ingToGrams(ing)

    if (type === 'egg') {
      const n = parseInt(toWestern(ing).match(/(\d+)/)?.[1] ?? '2', 10)
      p.eggsN += (n >= 1 && n <= 24) ? n : 2
      continue
    }

    let g = grams > 0 ? grams
      : PROTEIN_SCALE_TYPES.has(type)
        ? PROTEIN_PER_PERSON_G[type] * Math.min(srv, 8)
        : (ING_DEFAULT_G[type] ?? 0)
    if (g <= 0) continue

    // Olive-specific حبة override: generic حبة = 130g, but one olive ≈ 4g.
    // Re-parse the piece count and multiply by 4 so "20 حبة زيتون" → 80g,
    // not the incorrect 2,600g (= 20 × 130) that ingToGrams returns.
    if (type === 'olive' && /حبات|حبة/.test(ing)) {
      const m = toWestern(ing).match(
        /(نصف|ثلث|ربع|ثلاثة أرباع|\d+\.?\d*)\s*(?:و(?:نصف|ثلث|ربع))?\s*حب[اةت]/
      )
      if (m) g = parseLeadNum(m[1]) * 4   // 4g per olive
    }

    switch (type) {
      case 'rice':      p.riceG      += g; break
      case 'grain':     p.grainG     += g; break
      case 'noodle':    p.noodleG    += g; break
      case 'pasta':     p.pastaG     += g; break
      case 'flour':     p.flourG     += g; break
      case 'oat':       p.oatG       += g; break
      case 'chicken':   p.chickenG   += g; break
      case 'meat':      p.meatG      += g; break
      case 'shrimp':    p.shrimpG    += g; break
      case 'fish':      p.fishG      += g; break
      case 'oil':       p.oilG       += g; break
      case 'butter':    p.butterG    += g; break
      case 'corn':      p.cornG      += g; break
      case 'sugar':     p.sugarG     += g; break
      case 'honey':     p.honeyG     += g; break
      case 'chocolate': p.chocolateG += g; break
      case 'milk':      p.milkML     += g; break
      case 'cream':     p.creamML    += g; break
      case 'yogurt':    p.yogurtG    += g; break
      case 'cheese':    p.cheeseG    += g; break
      case 'coconut':   p.coconutG   += g; break
      case 'nut':       p.nutG       += g; break
      case 'date':      p.dateG      += g; break
      case 'potato':    p.potatoG    += g; break
      case 'pumpkin':   p.pumpkinG   += g; break
      case 'tomato':    p.tomatoG    += g; break
      case 'lentil':    p.lentilG    += g; break
      case 'chickpea':  p.chickpeaG  += g; break
      case 'legume':    p.legumesG   += g; break
      case 'onion':     p.onionG     += g; break
      case 'carrot':    p.carrotG    += g; break
      case 'veggie':    p.veggieG    += g; break
      case 'fruit':     p.fruitG     += g; break
      case 'avocado':   p.avocadoG   += g; break
      case 'olive':     p.oliveG     += g; break
      case 'water':     p.waterML    += g; break
    }
  }
  return p
}

function calcCal(profile, srv) {
  const tot = sumNutrients(
    addDensity('riceCooked',  profile.riceG,     2.8),
    addDensity('grainCooked', profile.grainG,    2.5),
    addDensity('noodleCk',    profile.noodleG,   2.5),
    addDensity('pastaCk',     profile.pastaG,    2.5),
    addDensity('bakedFlour',  profile.flourG,    0.9),
    addDensity('oatCk',       profile.oatG,      2.2),
    addDensity('chickenCk',   profile.chickenG,  0.70),
    addDensity('meatCk',      profile.meatG,     0.70),
    addDensity('shrimpCk',    profile.shrimpG,   0.85),
    addDensity('fishCk',      profile.fishG,     0.80),
    addDensity('oil',         profile.oilG,      1.0),
    addDensity('butter',      profile.butterG,   1.0),
    addDensity('corn',        profile.cornG,     1.0),
    addDensity('sugar',       profile.sugarG,    1.0),
    addDensity('honey',       profile.honeyG,    1.0),
    addDensity('chocolate',   profile.chocolateG,1.0),
    addDensity('egg',         profile.eggsN * 50,1.0),
    addDensity('milk',        profile.milkML,    1.0),
    addDensity('cream',       profile.creamML,   1.0),
    addDensity('yogurt',      profile.yogurtG,   1.0),
    addDensity('cheese',      profile.cheeseG,   1.0),
    addDensity('coconut',     profile.coconutG,  1.0),
    addDensity('nut',         profile.nutG,      1.0),
    addDensity('date',        profile.dateG,     1.0),
    addDensity('potatoCk',    profile.potatoG,   1.0),
    addDensity('pumpkinCk',   profile.pumpkinG,  1.0),
    addDensity('tomato',      profile.tomatoG,   1.0),
    addDensity('lentilCk',    profile.lentilG,   2.5),
    addDensity('chickpeaCk',  profile.chickpeaG, 2.2),
    addDensity('legumeCk',    profile.legumesG,  2.2),
    addDensity('onion',       profile.onionG,    0.85),
    addDensity('carrot',      profile.carrotG,   1.0),
    addDensity('veggie',      profile.veggieG,   1.0),
    addDensity('fruit',       profile.fruitG,    1.0),
    addDensity('avocado',     profile.avocadoG,  1.0),
    addDensity('olive',       profile.oliveG,    1.0),
  )
  return Math.round(tot.cal / srv)
}

// ══════════════════════════════════════════════════════════════════
//  FETCH + COMPARE
// ══════════════════════════════════════════════════════════════════

let page = 0, recipes = []
while (true) {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, servings, ingredients, calories')
    .range(page * 1000, page * 1000 + 999)
  if (error) { console.error('DB error:', error.message); process.exit(1) }
  if (!data?.length) break
  recipes.push(...data)
  if (data.length < 1000) break
  page++
}
console.log(`Fetched ${recipes.length} recipes\n`)

// Identify the 9 known-affected recipes (any recipe with a standalone-olive ingredient)
function hasStandaloneOlive(ings) {
  return (ings || []).some(ing =>
    ing.includes('زيتون') &&
    !ing.includes('زيت زيتون') &&
    !ing.includes('زيت الزيتون')
  )
}

const changed   = []
const unchanged = []

for (const r of recipes) {
  const srv     = parseServings(r.servings)
  const ings    = Array.isArray(r.ingredients) ? r.ingredients : []
  const isOlive = hasStandaloneOlive(ings)

  const profOld = buildProfile(ings, srv, classifyOld, false)
  const profNew = buildProfile(ings, srv, classifyNew, true)
  const oldCal  = calcCal(profOld, srv)
  const newCal  = calcCal(profNew, srv)

  if (oldCal === newCal) { unchanged.push(r.name); continue }
  const delta    = newCal - oldCal
  const deltaPct = oldCal > 0 ? ((delta / oldCal) * 100).toFixed(1) : 'n/a'

  // Find olive ingredients for context
  const oliveIngs = ings.filter(i => i.includes('زيتون') && !i.includes('زيت زيتون') && !i.includes('زيت الزيتون'))

  changed.push({ name: r.name, srv, dbCal: r.calories, oldCal, newCal, delta, deltaPct, isOlive, oliveIngs })
}

// ── Report ─────────────────────────────────────────────────────────────────

console.log('══════════════════════════════════════════════════')
console.log('  Olive Fix Dry-Run — OLD vs NEW calorie estimates')
console.log('══════════════════════════════════════════════════\n')
console.log(`  Total recipes:    ${recipes.length}`)
console.log(`  Changed:          ${changed.length}`)
console.log(`  Unchanged:        ${unchanged.length}`)
console.log()

// --- The 9 known affected recipes (olive ingredient present) ---
const oliveRecipes = changed.filter(r => r.isOlive)
console.log(`  ── ${oliveRecipes.length} recipes with standalone زيتون ingredient ────────────────`)
for (const r of oliveRecipes.sort((a,b) => a.delta - b.delta)) {
  const arrow = r.delta > 0 ? '+' : ''
  console.log(`  ${String(r.oldCal).padStart(4)} → ${String(r.newCal).padStart(4)} cal/srv  ${arrow}${r.deltaPct}%  DB=${r.dbCal}  ${r.name}`)
  for (const ing of r.oliveIngs) {
    const g       = ingToGrams(ing)
    // What grams does the NEW path use after حبة override?
    let newG = g > 0 ? g : ING_DEFAULT_G['olive']
    if (/حبات|حبة/.test(ing)) {
      const m = toWestern(ing).match(/(نصف|ثلث|ربع|ثلاثة أرباع|\d+\.?\d*)\s*(?:و(?:نصف|ثلث|ربع))?\s*حب[اةت]/)
      if (m) newG = parseLeadNum(m[1]) * 4
    }
    const oldContrib = (g > 0 ? g : ING_DEFAULT_G['oil']) * 884 / 100
    const newContrib = newG * 115 / 100
    console.log(`       ing: "${ing.trim().slice(0,55)}"`)
    console.log(`            old: ${g>0?g+'g parsed':'default 45g'} × 884 kcal = ${Math.round(oldContrib)} cal total`)
    console.log(`            new: ${newG}g × 115 kcal = ${Math.round(newContrib)} cal total`)
  }
}
console.log()

// --- Any unexpected changes (non-olive recipes) ---
const unexpected = changed.filter(r => !r.isOlive)
if (unexpected.length) {
  console.log(`  ── ${unexpected.length} UNEXPECTED changes (non-olive recipes) ────────────────`)
  for (const r of unexpected) {
    console.log(`  ${String(r.oldCal).padStart(4)} → ${String(r.newCal).padStart(4)} cal/srv  ${r.deltaPct}%  ${r.name}`)
    // Show which ingredient triggered the change
    const suspects = (r.oliveIngs.length ? r.oliveIngs : (Array.isArray(r.ingredients) ? r.ingredients : [])).slice(0,3)
    for (const ing of suspects) {
      const tOld = classifyOld(ing), tNew = classifyNew(ing)
      if (tOld !== tNew) console.log(`       "${ing.slice(0,50)}"  ${tOld}→${tNew}`)
    }
  }
} else {
  console.log('  ── 0 unexpected changes — only the 9 olive recipes shifted ✓')
}
console.log()

// --- Sanity check: olive oil strings should still classify as oil ---
console.log('  ── Oil-context sanity checks (should remain → oil) ─────────────')
const oilChecks = [
  'ملعقتان كبيرتان من زيت الزيتون',
  '3 ملاعق كبيرة زيت زيتون',
  'زيت الزيتون : ربع كوب',
  'زيت زيتون بكر ممتاز',
  'زيت الزيتون البكر',
]
for (const s of oilChecks) {
  const tOld = classifyOld(s), tNew = classifyNew(s)
  const ok = tNew === 'oil' ? '✓' : '✗ WRONG'
  console.log(`  ${ok}  classifyNew("${s}") → ${tNew}`)
}
console.log()
