#!/usr/bin/env node
/**
 * dry_run_stage2.mjs
 *
 * Compares OLD calorie estimates (post-Stage-1b) vs NEW (Stage 2 additions):
 *   - NEW types: fruit (produce section), avocado (produce section), corn (after oil)
 *   - EXTENDED veggie keywords: herbs (كزبرة,بقدونس,نعناع,زعتر,ريحان,سبانخ),
 *     extra veg (فطر,مشروم,كرفس,هليون,شمندر,بنجر,ليمون)
 *   - Note: زيتون (olive) skipped — 'زيت' ⊂ 'زيتون' causes oil/olive conflict
 *     requiring word-boundary matching (deferred to Stage N)
 *
 * Reports: affected count, old vs new cal, delta%, outliers >±100%
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
//  SHARED PARSING UTILITIES (identical for OLD and NEW)
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
  [/حبات|حبة/,               130],
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
//  OLD CONFIGURATION (post-Stage-1b, current estimate_nutrition.mjs)
// ══════════════════════════════════════════════════════════════════

const OLD_ING_TYPES = [
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
  ['veggie',    ['خضار', 'فلفل', 'خيار', 'كوسا', 'باذنجان', 'ملفوف', 'كرنب', 'بروكلي']],
  ['chicken',   ['دجاج', 'دجاجة', 'فراخ', 'فرخة', 'صدر دجاج', 'فيليه دجاج']],
  ['meat',      ['لحم', 'لحمة', 'لحوم', 'عجل', 'ضأن', 'خروف', 'ضلع', 'كبدة', 'هبرة', 'كفتة', 'كفته', 'مفروم']],
  ['shrimp',    ['ربيان', 'روبيان', 'جمبري', 'قريدس', 'كروفيتاس']],
  ['fish',      ['سمك', 'هامور', 'ميرو', 'بلطي', 'تونة', 'سردين', 'فيليه سمك', 'حبار', 'سلمون']],
  ['oil',       ['زيت']],
  ['butter',    ['زبدة', 'سمنة', 'سمن']],
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

const OLD_ING_DEFAULT_G = {
  rice: 360, grain: 300, noodle: 250, pasta: 300, flour: 250, oat: 200,
  chicken: 1200, meat: 800, shrimp: 500, fish: 600,
  oil: 45, butter: 60, sugar: 150, honey: 60, chocolate: 80,
  egg: 0,
  milk: 300, cream: 150, yogurt: 250, cheese: 120, coconut: 80,
  nut: 80, date: 100,
  potato: 300, pumpkin: 400, tomato: 300, lentil: 250, chickpea: 250,
  legume: 200, onion: 200, carrot: 150, veggie: 200, water: 800,
}

const PROTEIN_PER_PERSON_G = { chicken: 300, meat: 200, shrimp: 125, fish: 150 }
const PROTEIN_SCALE_TYPES  = new Set(Object.keys(PROTEIN_PER_PERSON_G))

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
  // Stage 2 new types (used only in NEW path, declared here once for addDensity lookup)
  fruit:        [65,   0.8, 16.0,  0.3, 2.0],
  avocado:      [160,  2.0,  9.0, 15.0, 6.7],
  corn:         [86,   3.3, 19.0,  1.2, 2.7],
}

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
//  OLD estimation path
// ──────────────────────────────────────────────────────────────────

function classifyOld(text) {
  for (const [type, keywords] of OLD_ING_TYPES) {
    if (keywords.some(kw => text.includes(kw))) return type
  }
  return 'other'
}

function buildProfileOld(ingredients, srv) {
  const p = {
    riceG:0, grainG:0, noodleG:0, pastaG:0, flourG:0, oatG:0,
    chickenG:0, meatG:0, shrimpG:0, fishG:0,
    oilG:0, butterG:0, sugarG:0, honeyG:0, chocolateG:0,
    eggsN:0,
    milkML:0, creamML:0, yogurtG:0, cheeseG:0, coconutG:0,
    nutG:0, dateG:0,
    potatoG:0, pumpkinG:0, tomatoG:0, lentilG:0, chickpeaG:0,
    legumesG:0, onionG:0, carrotG:0, veggieG:0, waterML:0,
  }
  for (const ing of (ingredients || [])) {
    const type  = classifyOld(ing)
    const grams = ingToGrams(ing)
    if (type === 'egg') {
      const n = parseInt(toWestern(ing).match(/(\d+)/)?.[1] ?? '2', 10)
      p.eggsN += (n >= 1 && n <= 24) ? n : 2
      continue
    }
    const g = grams > 0 ? grams
      : PROTEIN_SCALE_TYPES.has(type)
        ? PROTEIN_PER_PERSON_G[type] * Math.min(srv, 8)
        : (OLD_ING_DEFAULT_G[type] ?? 0)
    if (g <= 0) continue
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
      case 'water':     p.waterML    += g; break
    }
  }
  return p
}

function calcCalOld(profile, srv) {
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
  )
  return Math.round(tot.cal / srv)
}

// ══════════════════════════════════════════════════════════════════
//  NEW CONFIGURATION (Stage 2 additions)
// ══════════════════════════════════════════════════════════════════
//
// Changes vs OLD:
//  1. veggie keywords extended with herbs + extra veg (no density change)
//  2. New type 'fruit'   — in produce section (before proteins)
//  3. New type 'avocado' — in produce section (before proteins)
//  4. New type 'corn'    — after 'oil' in fats section (avoids زيت الذرة conflict)
//
// Ordering note on olive (زيتون): 'زيت' (oil keyword) is a substring of
// 'زيتون', so whichever type comes first wins for BOTH "زيت" AND "زيتون".
// Needs word-boundary matching; deferred to Stage N.

const NEW_ING_TYPES = [
  // Starches
  ['rice',      ['أرز', 'رز']],
  ['grain',     ['قمح', 'هريس', 'جريش', 'بلغر', 'برغل']],
  ['noodle',    ['شعيرية']],
  ['pasta',     ['معكرونة', 'مكرونة', 'سباغيتي', 'باستا', 'لازانيا', 'فرموتشيني']],
  ['flour',     ['دقيق', 'طحين']],
  ['oat',       ['شوفان']],
  // Produce — before proteins (مفروم fix from Stage 1b)
  ['potato',    ['بطاطس', 'بطاطا']],
  ['pumpkin',   ['قرع', 'يقطين']],
  ['tomato',    ['طماطم', 'طماطة', 'تماطم', 'صلصة طماطم', 'معجون الطماطم', 'معجون طماطم']],
  ['lentil',    ['عدس']],
  ['onion',     ['بصل', 'بصلة', 'كراث', 'ثوم', 'ثومة']],
  ['carrot',    ['جزر', 'جزرة']],
  // veggie: extended with herbs, greens, extra veg — also fixes مفروم herb false positives
  // 'ورق العنب' (grape leaves) listed here BEFORE fruit so 'عنب' in 'ورق العنب' hits veggie first
  // 'ليمون' intentionally excluded — 200g default over-inflates trivial garnish quantities
  ['veggie',    [
    'خضار', 'فلفل', 'خيار', 'كوسا', 'باذنجان', 'ملفوف', 'كرنب', 'بروكلي',
    'سبانخ', 'كزبرة', 'بقدونس', 'نعناع', 'زعتر', 'ريحان',
    'كرفس', 'هليون', 'شمندر', 'بنجر', 'فطر', 'مشروم',
    'ورق العنب',
  ]],
  // NEW: fruit type (produce section, before proteins)
  ['fruit',     [
    'موز', 'تفاح', 'مانجو', 'فراولة', 'رمان', 'تين', 'توت', 'عنب',
    'برتقال', 'أناناس', 'كيوي', 'مشمش', 'جوافة', 'كمثرى', 'خوخ',
    'يوسفي', 'فاكهة',
  ]],
  // NEW: avocado type (produce section, before proteins)
  ['avocado',   ['أفوكادو']],
  // Proteins
  ['chicken',   ['دجاج', 'دجاجة', 'فراخ', 'فرخة', 'صدر دجاج', 'فيليه دجاج']],
  ['meat',      ['لحم', 'لحمة', 'لحوم', 'عجل', 'ضأن', 'خروف', 'ضلع', 'كبدة', 'هبرة', 'كفتة', 'كفته', 'مفروم']],
  ['shrimp',    ['ربيان', 'روبيان', 'جمبري', 'قريدس', 'كروفيتاس']],
  ['fish',      ['سمك', 'هامور', 'ميرو', 'بلطي', 'تونة', 'سردين', 'فيليه سمك', 'حبار', 'سلمون']],
  // Fats — oil before corn so "زيت الذرة" (corn oil) → oil, not corn
  ['oil',       ['زيت']],
  ['butter',    ['زبدة', 'سمنة', 'سمن']],
  // NEW: corn — after oil so "زيت الذرة" → oil first
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

const NEW_ING_DEFAULT_G = {
  ...OLD_ING_DEFAULT_G,
  fruit:   150,  // one medium fruit or a cup of berries
  avocado: 100,  // half a large avocado
  corn:    150,  // ~one cup corn kernels
}

function classifyNew(text) {
  for (const [type, keywords] of NEW_ING_TYPES) {
    if (keywords.some(kw => text.includes(kw))) return type
  }
  return 'other'
}

function buildProfileNew(ingredients, srv) {
  const p = {
    riceG:0, grainG:0, noodleG:0, pastaG:0, flourG:0, oatG:0,
    chickenG:0, meatG:0, shrimpG:0, fishG:0,
    oilG:0, butterG:0, cornG:0, sugarG:0, honeyG:0, chocolateG:0,
    eggsN:0,
    milkML:0, creamML:0, yogurtG:0, cheeseG:0, coconutG:0,
    nutG:0, dateG:0,
    potatoG:0, pumpkinG:0, tomatoG:0, lentilG:0, chickpeaG:0,
    legumesG:0, onionG:0, carrotG:0, veggieG:0, fruitG:0, avocadoG:0, waterML:0,
  }
  for (const ing of (ingredients || [])) {
    const type  = classifyNew(ing)
    const grams = ingToGrams(ing)
    if (type === 'egg') {
      const n = parseInt(toWestern(ing).match(/(\d+)/)?.[1] ?? '2', 10)
      p.eggsN += (n >= 1 && n <= 24) ? n : 2
      continue
    }
    const g = grams > 0 ? grams
      : PROTEIN_SCALE_TYPES.has(type)
        ? PROTEIN_PER_PERSON_G[type] * Math.min(srv, 8)
        : (NEW_ING_DEFAULT_G[type] ?? 0)
    if (g <= 0) continue
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
      case 'water':     p.waterML    += g; break
    }
  }
  return p
}

function calcCalNew(profile, srv) {
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
  )
  return Math.round(tot.cal / srv)
}

// Track which new types each recipe hits (for the summary)
function newTypesHit(ingredients, srv) {
  const hits = new Set()
  for (const ing of (ingredients || [])) {
    const typeOld = classifyOld(ing)
    const typeNew = classifyNew(ing)
    if (typeNew !== typeOld) hits.add(`${typeNew}←${typeOld}(${ing.slice(0,20)})`)
  }
  return [...hits]
}

// ══════════════════════════════════════════════════════════════════
//  FETCH + COMPARE
// ══════════════════════════════════════════════════════════════════

let page = 0, recipes = []
while (true) {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, servings, ingredients')
    .range(page * 1000, page * 1000 + 999)
  if (error) { console.error('DB error:', error.message); process.exit(1) }
  if (!data?.length) break
  recipes.push(...data)
  if (data.length < 1000) break
  page++
}
console.log(`\nFetched ${recipes.length} recipes\n`)

const changed    = []
const outliers   = []
const zeroToSomething = []  // was 0, now has calories (previously undetected ingredient)

for (const r of recipes) {
  const srv  = parseServings(r.servings)
  const ings = Array.isArray(r.ingredients) ? r.ingredients : []

  const profileOld = buildProfileOld(ings, srv)
  const profileNew = buildProfileNew(ings, srv)

  const oldCal = calcCalOld(profileOld, srv)
  const newCal = calcCalNew(profileNew, srv)

  if (oldCal === newCal) continue

  const delta   = newCal - oldCal
  const deltaPct = oldCal > 0 ? ((delta / oldCal) * 100).toFixed(1) : 'n/a'
  const hits    = newTypesHit(ings, srv)

  const entry = { name: r.name, oldCal, newCal, delta, deltaPct, hits }
  changed.push(entry)
  if (oldCal === 0 && newCal > 0) zeroToSomething.push(entry)
  if (oldCal > 0 && Math.abs(delta / oldCal) > 1.0) outliers.push(entry)
}

// ── Report ─────────────────────────────────────────────────────────────────
const pad = s => String(s).padStart(4)

console.log('══════════════════════════════════════════════════')
console.log('  Stage 2 Dry-Run — OLD vs NEW calorie estimates')
console.log('══════════════════════════════════════════════════\n')
console.log(`  Total recipes:      ${recipes.length}`)
console.log(`  Changed:            ${changed.length}`)
console.log(`  Unchanged:          ${recipes.length - changed.length}`)
console.log(`  0→something:        ${zeroToSomething.length}  (ingredient now recognised)`)
console.log(`  Outliers (>±100%):  ${outliers.length}`)
console.log()

// --- New types breakdown ---
const typeCounts = {}
for (const e of changed) {
  for (const h of e.hits) {
    const t = h.split('←')[0]
    typeCounts[t] = (typeCounts[t] || 0) + 1
  }
}
console.log('  Recipes changed per new type:')
for (const [t, n] of Object.entries(typeCounts).sort((a,b) => b[1]-a[1])) {
  console.log(`    ${t.padEnd(12)} ${n}`)
}
console.log()

// --- Changed recipes ---
console.log('  Changed recipes (old → new cal/serving, Δ%):')
console.log('  ─────────────────────────────────────────────────────────')
for (const e of changed.sort((a,b) => Math.abs(b.delta)-Math.abs(a.delta))) {
  const arrow = e.delta > 0 ? '+' : ''
  const flag  = Math.abs(e.delta / (e.oldCal || 1)) > 1.0 ? ' ⚠️' : ''
  const hitsStr = e.hits.slice(0,3).map(h => h.split('(')[0]).join(', ')
  console.log(
    `  ${pad(e.oldCal)} → ${pad(e.newCal)} cal  ${arrow}${e.deltaPct}%  [${hitsStr}]  ${e.name.slice(0,40)}${flag}`
  )
}
console.log()

// --- Outliers detail ---
if (outliers.length) {
  console.log('  ── Outliers >±100% ──────────────────────────────────────')
  for (const e of outliers) {
    console.log(`  ⚠️  ${e.name}`)
    console.log(`       old=${e.oldCal} new=${e.newCal} (${e.deltaPct}%)`)
    console.log(`       hits: ${e.hits.join(' | ')}`)
  }
  console.log()
}

// --- 0 → something ---
if (zeroToSomething.length) {
  console.log('  ── Previously zero-calorie recipes now detected ─────────')
  for (const e of zeroToSomething) {
    console.log(`  + ${e.name} → ${e.newCal} cal/srv  [${e.hits.join(', ')}]`)
  }
  console.log()
}
