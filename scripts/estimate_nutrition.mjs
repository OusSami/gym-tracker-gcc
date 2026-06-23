#!/usr/bin/env node
/**
 * estimate_nutrition.mjs  v2
 *
 * Replaces brittle keyword fingerprints with ingredient-quantity parsing:
 *   1. Parses Arabic ingredient strings to extract key macro ingredients + grams
 *   2. Calculates total recipe nutrition from ingredient nutritional densities
 *   3. Divides by servings count for per-serving values
 *   4. Derives per-100g from total cooked weight estimate
 *   5. Applies dish-type floor rules so rice dishes can never be 160 cal etc.
 *
 * Updates ALL 370 recipes (resets calories to null first to force full re-run).
 *
 * Usage:
 *   node scripts/estimate_nutrition.mjs
 *   node scripts/estimate_nutrition.mjs --dry-run
 *   node scripts/estimate_nutrition.mjs --limit 20
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = process.argv.includes('--dry-run')
const LIMIT_IDX = process.argv.indexOf('--limit')
const LIMIT     = LIMIT_IDX !== -1 ? parseInt(process.argv[LIMIT_IDX + 1], 10) : null

// ── Credentials ───────────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 1 — ARABIC QUANTITY PARSING
// ═══════════════════════════════════════════════════════════════════════════

function toWestern(s) {
  return String(s).replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
}

// Extract the leading numeric value from an Arabic text (handles fractions)
function parseLeadNum(text) {
  const t = toWestern(text)
  if (/ثلاثة أرباع|¾/.test(t)) return 0.75
  if (/نصف/.test(t)) return 0.5
  if (/ثلث/.test(t)) return 0.333
  if (/ربع/.test(t)) return 0.25
  const m = t.match(/(\d+\.?\d*)/)
  return m ? parseFloat(m[1]) : 1
}

// Parse servings string → integer
function parseServings(s) {
  if (!s) return 4
  const n = parseInt(toWestern(s).match(/(\d+)/)?.[1] ?? '4', 10)
  return n >= 1 && n <= 30 ? n : 4
}

// Unit → grams conversion table (per 1 unit)
const UNIT_G = [
  [/كيلوغرام|كيلوجرام/,   1000],
  [/كيلو/,                 1000],
  [/غراماً|غرامات|غرام/,    1],
  [/مللتر|مل(?!عقة)/,        1],      // ml ≈ g
  [/لتر/,                  1000],
  [/أكواب|اكواب|كوب|كأس/,   220],
  [/ملاعق كبيرة|ملعقة كبيرة/, 15],
  [/ملاعق صغيرة|ملعقة صغيرة/,  5],
  [/ملاعق|ملعقة/,            12],     // ambiguous → 12g
  [/حبات|حبة/,              130],     // default veg/fruit unit
  [/شرائح|شريحة/,            80],
  [/قطع|قطعة/,              100],
  [/وحدات|وحدة/,             80],
]

// Returns grams for a single ingredient string.
// Returns 0 if quantity is unknowable (e.g. "حسب الرغبة").
function ingToGrams(text) {
  const t = toWestern(text)

  // Whole chicken signals
  if (/دجاجة كاملة|دجاجتين كاملتين|دجاجة واحدة/.test(text)) {
    return /دجاجتين/.test(text) ? 2400 : 1200
  }
  // Bare "كيلو" without a preceding number
  if (/(?:^|[\s:،])كيلو(?:$|[\s،])/.test(text) && !t.match(/\d\s*كيلو/)) return 1000
  // "نصف كيلو" etc.
  if (/نصف\s*كيلو/.test(text)) return 500
  if (/ربع\s*كيلو/.test(text)) return 250

  for (const [pattern, perUnit] of UNIT_G) {
    // Match patterns like "2 كوب", "ثلث كوب", "نصف ملعقة كبيرة"
    const rx = new RegExp(
      `(نصف|ثلث|ربع|ثلاثة أرباع|\\d+\\.?\\d*)\\s*(?:و(?:نصف|ثلث|ربع))?\\s*${pattern.source}`,
      'i'
    )
    const m = t.match(rx)
    if (m) return parseLeadNum(m[1]) * perUnit
  }

  // Bare leading number with no unit → treat as grams (e.g. "500 روبيان")
  const bareNum = t.match(/^[^٠-٩\d]*(\d+\.?\d*)\s*(?:$|[،,])/)
  if (bareNum) return parseFloat(bareNum[1])

  return 0
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 2 — INGREDIENT TYPE CLASSIFIER
// ═══════════════════════════════════════════════════════════════════════════

// Maps keyword patterns → macro ingredient category
const ING_TYPES = [
  ['rice',    ['أرز', 'رز']],
  ['grain',   ['قمح', 'هريس', 'جريش', 'بلغر', 'برغل']],
  ['noodle',  ['شعيرية']],
  ['pasta',   ['معكرونة', 'مكرونة', 'سباغيتي', 'باستا', 'لازانيا', 'فرموتشيني']],
  ['flour',   ['دقيق', 'طحين']],
  ['oat',     ['شوفان']],
  ['chicken', ['دجاج', 'دجاجة', 'فراخ', 'فرخة', 'صدر دجاج', 'فيليه دجاج']],
  ['meat',    ['لحم', 'لحمة', 'لحوم', 'عجل', 'ضأن', 'خروف', 'ضلع', 'كبدة', 'هبرة', 'كفتة', 'كفته', 'مفروم']],
  ['shrimp',  ['ربيان', 'روبيان', 'جمبري', 'قريدس', 'كروفيتاس']],
  ['fish',    ['سمك', 'هامور', 'ميرو', 'بلطي', 'تونة', 'سردين', 'فيليه سمك', 'حبار']],
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
  ['potato',  ['بطاطس', 'بطاطا']],
  ['pumpkin', ['قرع', 'يقطين']],
  ['tomato',  ['طماطم', 'طماطة', 'تماطم', 'صلصة طماطم', 'معجون الطماطم', 'معجون طماطم']],
  ['lentil',  ['عدس']],
  ['chickpea',['حمص']],   // as ingredient, not dish name
  ['legume',  ['فاصوليا', 'لوبيا', 'فول']],
  ['onion',   ['بصل', 'بصلة']],
  ['carrot',  ['جزر', 'جزرة']],
  ['veggie',  ['خضار', 'فلفل', 'خيار', 'كوسا', 'باذنجان', 'ملفوف', 'كرنب', 'بروكلي']],
  ['water',   ['ماء', 'مياه', 'ماءً']],
]

function classifyIng(text) {
  for (const [type, keywords] of ING_TYPES) {
    if (keywords.some(kw => text.includes(kw))) return type
  }
  return 'other'
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 3 — INGREDIENT PROFILE BUILDER
// ═══════════════════════════════════════════════════════════════════════════

// Default gram quantities when a key ingredient has no parseable quantity.
// These are "reasonable 4-person recipe" defaults.
const ING_DEFAULT_G = {
  rice: 360, grain: 300, noodle: 250, pasta: 300, flour: 250, oat: 200,
  chicken: 1200, meat: 800, shrimp: 500, fish: 600,
  oil: 45, butter: 60, sugar: 150, honey: 60, chocolate: 80,
  egg: 0,          // counted separately
  milk: 300, cream: 150, yogurt: 250, cheese: 120, coconut: 80,
  nut: 80, date: 100,
  potato: 300, pumpkin: 400, tomato: 300, lentil: 250, chickpea: 250,
  legume: 200, onion: 200, carrot: 150, veggie: 200, water: 800,
}

function buildProfile(ingredients) {
  const p = {
    riceG: 0, grainG: 0, noodleG: 0, pastaG: 0, flourG: 0, oatG: 0,
    chickenG: 0, meatG: 0, shrimpG: 0, fishG: 0,
    oilG: 0, butterG: 0, sugarG: 0, honeyG: 0, chocolateG: 0,
    eggsN: 0,
    milkML: 0, creamML: 0, yogurtG: 0, cheeseG: 0, coconutG: 0,
    nutG: 0, dateG: 0,
    potatoG: 0, pumpkinG: 0, tomatoG: 0, lentilG: 0, chickpeaG: 0,
    legumesG: 0, onionG: 0, carrotG: 0, veggieG: 0, waterML: 0,
  }

  for (const ing of (ingredients || [])) {
    const type  = classifyIng(ing)
    const grams = ingToGrams(ing)

    if (type === 'egg') {
      // Count eggs from the number in the string, not weight
      const n = parseInt(toWestern(ing).match(/(\d+)/)?.[1] ?? '2', 10)
      p.eggsN += (n >= 1 && n <= 24) ? n : 2
      continue
    }

    const g = grams > 0 ? grams : (ING_DEFAULT_G[type] ?? 0)
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

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 4 — NUTRITION FROM INGREDIENT PROFILE
// ═══════════════════════════════════════════════════════════════════════════

// Per-100g nutritional densities (approximate, cooked unless noted)
//               [cal, protein, carbs, fat, fiber]
const DENSITY = {
  riceCooked:   [130,  2.7, 28.0, 0.3, 0.4],
  grainCooked:  [110,  3.5, 23.0, 0.5, 1.8],
  noodleCk:     [155,  5.0, 31.0, 0.9, 1.2],
  pastaCk:      [158,  5.5, 31.0, 0.9, 1.8],
  bakedFlour:   [280,  8.0, 55.0, 2.0, 2.5],  // flour in baked goods
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

function calcFromProfile(profile, srv) {
  // Expansion factors: dry → cooked weight multipliers
  // Rice: 1 cup dry (180g) → 3 cups cooked (~540g), so ×3 weight expansion
  // But nutritional databases use cooked values, and we measured dry weight,
  // so: calories in 180g dry rice ≈ calories in 540g cooked. We'll use
  // the cooked density and multiply raw weight by 2.8 to get cooked weight.
  const tot = sumNutrients(
    addDensity('riceCooked',   profile.riceG,     2.8),
    addDensity('grainCooked',  profile.grainG,    2.5),
    addDensity('noodleCk',     profile.noodleG,   2.5),
    addDensity('pastaCk',      profile.pastaG,    2.5),
    addDensity('bakedFlour',   profile.flourG,    0.9),  // slight loss baking
    addDensity('oatCk',        profile.oatG,      2.2),
    addDensity('chickenCk',    profile.chickenG,  0.70), // ~30% cook-off
    addDensity('meatCk',       profile.meatG,     0.70),
    addDensity('shrimpCk',     profile.shrimpG,   0.85),
    addDensity('fishCk',       profile.fishG,     0.80),
    addDensity('oil',          profile.oilG,      1.0),
    addDensity('butter',       profile.butterG,   1.0),
    addDensity('sugar',        profile.sugarG,    1.0),
    addDensity('honey',        profile.honeyG,    1.0),
    addDensity('chocolate',    profile.chocolateG,1.0),
    addDensity('egg',          profile.eggsN * 50,1.0),  // 50g per egg
    addDensity('milk',         profile.milkML,    1.0),
    addDensity('cream',        profile.creamML,   1.0),
    addDensity('yogurt',       profile.yogurtG,   1.0),
    addDensity('cheese',       profile.cheeseG,   1.0),
    addDensity('coconut',      profile.coconutG,  1.0),
    addDensity('nut',          profile.nutG,      1.0),
    addDensity('date',         profile.dateG,     1.0),
    addDensity('potatoCk',     profile.potatoG,   1.0),
    addDensity('pumpkinCk',    profile.pumpkinG,  1.0),
    addDensity('tomato',       profile.tomatoG,   1.0),
    addDensity('lentilCk',     profile.lentilG,   2.5),
    addDensity('chickpeaCk',   profile.chickpeaG, 2.2),
    addDensity('legumeCk',     profile.legumesG,  2.2),
    addDensity('onion',        profile.onionG,    0.85),
    addDensity('carrot',       profile.carrotG,   1.0),
    addDensity('veggie',       profile.veggieG,   1.0),
  )

  // For soups/stews: water inflates the weight but not calories.
  // Include it in weight for per-100g but not as a nutrition contributor.
  const totalWeightG = tot.wt + profile.waterML

  const perSrv = {
    calories:  Math.round(tot.cal / srv),
    protein_g: Math.round(tot.prot  / srv * 10) / 10,
    carbs_g:   Math.round(tot.carbs / srv * 10) / 10,
    fat_g:     Math.round(tot.fat   / srv * 10) / 10,
    fiber_g:   Math.round(tot.fiber / srv * 10) / 10,
  }

  const per100 = totalWeightG > 50 ? {
    cal_per_100g:      Math.round(tot.cal  / totalWeightG * 100),
    protein_per_100g:  Math.round(tot.prot  / totalWeightG * 1000) / 10,
    carbs_per_100g:    Math.round(tot.carbs / totalWeightG * 1000) / 10,
    fat_per_100g:      Math.round(tot.fat   / totalWeightG * 1000) / 10,
  } : null

  return { perSrv, per100, totalWeightG, hasIngredients: tot.wt > 0 }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 5 — CATEGORY FALLBACKS (when ingredients are missing/sparse)
// ═══════════════════════════════════════════════════════════════════════════

// These are used when ingredient parsing yields nothing useful.
// Values represent carefully chosen per-serving medians for each category.
const CAT_FALLBACK = {
  'أرز ومجبوس': { calories:520, protein_g:32, carbs_g:57, fat_g:14, fiber_g:3,  cal_per_100g:135, protein_per_100g:8.3,  carbs_per_100g:14.8, fat_per_100g:3.6 },
  'دجاج':        { calories:330, protein_g:33, carbs_g: 6, fat_g:16, fiber_g:1,  cal_per_100g:165, protein_per_100g:16.5, carbs_per_100g:3.0,  fat_per_100g:8.0 },
  'لحم':         { calories:410, protein_g:30, carbs_g:10, fat_g:24, fiber_g:2,  cal_per_100g:220, protein_per_100g:16.0, carbs_per_100g:5.3,  fat_per_100g:12.8},
  'سمك ومأكولات بحرية': { calories:250, protein_g:27, carbs_g: 6, fat_g:10, fiber_g:1, cal_per_100g:130, protein_per_100g:14.0, carbs_per_100g:3.1, fat_per_100g:5.2 },
  'سمك':         { calories:250, protein_g:27, carbs_g: 6, fat_g:10, fiber_g:1,  cal_per_100g:130, protein_per_100g:14.0, carbs_per_100g:3.1,  fat_per_100g:5.2 },
  'شوربة':       { calories:180, protein_g:10, carbs_g:18, fat_g: 6, fiber_g:3,  cal_per_100g:60,  protein_per_100g:3.3,  carbs_per_100g:6.0,  fat_per_100g:2.0 },
  'سلطة':        { calories:130, protein_g: 4, carbs_g:12, fat_g: 7, fiber_g:3,  cal_per_100g:75,  protein_per_100g:2.3,  carbs_per_100g:6.9,  fat_per_100g:4.0 },
  'حلويات':      { calories:370, protein_g: 5, carbs_g:52, fat_g:15, fiber_g:2,  cal_per_100g:360, protein_per_100g:4.9,  carbs_per_100g:50.7, fat_per_100g:14.6},
  'فطور':        { calories:290, protein_g:13, carbs_g:28, fat_g:13, fiber_g:3,  cal_per_100g:155, protein_per_100g:7.0,  carbs_per_100g:15.0, fat_per_100g:7.0 },
  'أطباق خليجية':{ calories:430, protein_g:25, carbs_g:48, fat_g:13, fiber_g:3,  cal_per_100g:120, protein_per_100g:7.0,  carbs_per_100g:13.4, fat_per_100g:3.6 },
  'مقبلات':      { calories:170, protein_g: 7, carbs_g:17, fat_g: 9, fiber_g:3,  cal_per_100g:160, protein_per_100g:6.6,  carbs_per_100g:16.0, fat_per_100g:8.5 },
  'مشروبات':     { calories:130, protein_g: 2, carbs_g:28, fat_g: 2, fiber_g:1,  cal_per_100g:52,  protein_per_100g:0.8,  carbs_per_100g:11.2, fat_per_100g:0.8 },
  'خبز ومعجنات': { calories:310, protein_g: 9, carbs_g:46, fat_g:11, fiber_g:2,  cal_per_100g:290, protein_per_100g:8.4,  carbs_per_100g:43.0, fat_per_100g:10.3},
  'أخرى':        { calories:340, protein_g:16, carbs_g:32, fat_g:14, fiber_g:3,  cal_per_100g:160, protein_per_100g:7.5,  carbs_per_100g:15.0, fat_per_100g:6.6 },
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 6 — DISH-TYPE FLOOR RULES + SPECIAL OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════

function applyFloors(perSrv, per100, name, category, profile) {
  const has = (kws) => kws.some(kw => name.includes(kw))

  // ── Specific dish overrides where ingredient parsing typically under-counts ─
  // Harees/هريسة: dense wheat+meat porridge. Never < 350 cal.
  if (has(['هريس','هريسة']) && perSrv.calories < 350) {
    const ratio = 380 / perSrv.calories
    perSrv.calories = 380; perSrv.protein_g = Math.round(perSrv.protein_g * ratio * 10)/10
    perSrv.carbs_g  = Math.round(perSrv.carbs_g  * ratio * 10)/10
    perSrv.fat_g    = Math.round(perSrv.fat_g    * ratio * 10)/10
    if (per100) { per100.cal_per_100g = Math.max(per100.cal_per_100g, 90) }
  }

  // Rice+protein dishes can never be low-cal — they always have substantial rice
  const isRiceDish = category === 'أرز ومجبوس' || profile.riceG > 0 || profile.grainG > 0
  const hasProtein = profile.chickenG > 0 || profile.meatG > 0 || profile.shrimpG > 0 || profile.fishG > 0

  if (has(['كبسة','مجبوس','برياني','مندي','بخاري','زربيان','مدفونة','مكبوس','قوزي','مقلوبة'])) {
    if (perSrv.calories < 420) {
      perSrv.calories = 460; perSrv.carbs_g = Math.max(perSrv.carbs_g, 50); perSrv.protein_g = Math.max(perSrv.protein_g, 28)
    }
  }
  if (isRiceDish && perSrv.calories < 300) {
    perSrv.calories = 340; perSrv.carbs_g = Math.max(perSrv.carbs_g, 38)
  }

  // Daqoos / tomato sauces are condiments, not full meals
  if (has(['دقوس']) && !has(['دجاج','لحم','سمك','أرز'])) {
    perSrv.calories = Math.min(perSrv.calories, 120)
    perSrv.carbs_g  = Math.min(perSrv.carbs_g, 14)
  }

  // Drinks should never be > 400 cal
  if (category === 'مشروبات' && perSrv.calories > 400) perSrv.calories = 400

  // Sanity ceiling: nothing should exceed 1200 cal per serving
  if (perSrv.calories > 1200) {
    const ratio = 1200 / perSrv.calories
    perSrv.calories = 1200; perSrv.protein_g = Math.round(perSrv.protein_g * ratio * 10)/10
    perSrv.carbs_g  = Math.round(perSrv.carbs_g  * ratio * 10)/10
    perSrv.fat_g    = Math.round(perSrv.fat_g    * ratio * 10)/10
  }

  return { perSrv, per100 }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 7 — REASONING TEXT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function getReasoning(profile, name, category, srv, usedFallback) {
  if (usedFallback) return `no ingredients — used category fallback (${category})`
  const parts = []
  if (profile.riceG > 0)    parts.push(`rice ${Math.round(profile.riceG)}g dry`)
  if (profile.grainG > 0)   parts.push(`grain ${Math.round(profile.grainG)}g dry`)
  if (profile.chickenG > 0) parts.push(`chicken ${Math.round(profile.chickenG)}g raw`)
  if (profile.meatG > 0)    parts.push(`meat ${Math.round(profile.meatG)}g raw`)
  if (profile.shrimpG > 0)  parts.push(`shrimp ${Math.round(profile.shrimpG)}g`)
  if (profile.fishG > 0)    parts.push(`fish ${Math.round(profile.fishG)}g`)
  if (profile.sugarG > 0)   parts.push(`sugar ${Math.round(profile.sugarG)}g`)
  if (profile.flourG > 0)   parts.push(`flour ${Math.round(profile.flourG)}g`)
  if (profile.oilG + profile.butterG > 0) parts.push(`fat ${Math.round(profile.oilG + profile.butterG)}g`)
  if (profile.eggsN > 0)    parts.push(`${profile.eggsN} eggs`)
  if (profile.lentilG > 0)  parts.push(`lentils ${Math.round(profile.lentilG)}g`)
  if (profile.grainG > 0 && name.includes('هريس')) parts.push('→ harees porridge')
  parts.push(`÷${srv} servings`)
  return parts.join(', ') || `category: ${category}`
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 8 — MAIN ESTIMATOR
// ═══════════════════════════════════════════════════════════════════════════

function estimateNutrition(recipe) {
  const name     = recipe.name     ?? ''
  const category = recipe.category ?? 'أخرى'
  const srv      = parseServings(recipe.servings)
  const profile  = buildProfile(recipe.ingredients)
  const result   = calcFromProfile(profile, srv)

  let perSrv = result.perSrv
  let per100 = result.per100
  let usedFallback = false

  // Fall back to category defaults if ingredients yielded almost nothing
  if (!result.hasIngredients || perSrv.calories < 30) {
    const fb = CAT_FALLBACK[category] ?? CAT_FALLBACK['أخرى']
    perSrv = {
      calories:  fb.calories,  protein_g: fb.protein_g,
      carbs_g:   fb.carbs_g,   fat_g:     fb.fat_g,
      fiber_g:   fb.fiber_g,
    }
    per100 = {
      cal_per_100g:      fb.cal_per_100g,
      protein_per_100g:  fb.protein_per_100g,
      carbs_per_100g:    fb.carbs_per_100g,
      fat_per_100g:      fb.fat_per_100g,
    }
    usedFallback = true
  }

  // Apply floor rules and overrides
  const floored = applyFloors(perSrv, per100, name, category, profile)
  perSrv = floored.perSrv
  per100 = floored.per100

  // Derive per-100g from per-serving if we still don't have it
  if (!per100) {
    const fb = CAT_FALLBACK[category] ?? CAT_FALLBACK['أخرى']
    const scale = perSrv.calories / (fb.calories || 1)
    per100 = {
      cal_per_100g:      Math.round(fb.cal_per_100g * scale),
      protein_per_100g:  Math.round(fb.protein_per_100g * scale * 10) / 10,
      carbs_per_100g:    Math.round(fb.carbs_per_100g * scale * 10) / 10,
      fat_per_100g:      Math.round(fb.fat_per_100g * scale * 10) / 10,
    }
  }

  const reasoning = getReasoning(profile, name, category, srv, usedFallback)
  return { perSrv, per100, srv, reasoning }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION 9 — MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n📥  Fetching all recipes…')

let q = supabase
  .from('recipes')
  .select('id, name, category, servings, ingredients')
  .order('created_at')
if (LIMIT) q = q.limit(LIMIT)

const { data: recipes, error: fetchErr } = await q
if (fetchErr) { console.error('❌', fetchErr.message); process.exit(1) }

const total = recipes.length
console.log(`    ${total} recipes to process${DRY_RUN ? ' (DRY RUN)' : ''}${LIMIT ? ` (limited to ${LIMIT})` : ''}\n`)

let succeeded = 0, failed = 0, fallbackCount = 0

for (let i = 0; i < total; i++) {
  const recipe = recipes[i]
  const idx    = `[${String(i + 1).padStart(String(total).length)}/${total}]`

  try {
    const { perSrv, per100, srv, reasoning } = estimateNutrition(recipe)
    const isFallback = reasoning.includes('fallback')
    if (isFallback) fallbackCount++

    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from('recipes')
        .update({
          calories:          perSrv.calories,
          protein_g:         perSrv.protein_g,
          carbs_g:           perSrv.carbs_g,
          fat_g:             perSrv.fat_g,
          fiber_g:           perSrv.fiber_g,
          cal_per_100g:      per100?.cal_per_100g     ?? null,
          protein_per_100g:  per100?.protein_per_100g ?? null,
          carbs_per_100g:    per100?.carbs_per_100g   ?? null,
          fat_per_100g:      per100?.fat_per_100g     ?? null,
          nutrition_estimated_at: new Date().toISOString(),
        })
        .eq('id', recipe.id)
      if (upErr) throw new Error('DB: ' + upErr.message)
    }

    const name30 = recipe.name.slice(0, 32).padEnd(32)
    console.log(`${idx} ${isFallback ? '⚠️ ' : '✅ '} ${name30}`)
    console.log(`         Per serving: ${String(perSrv.calories).padStart(4)} cal | P:${String(perSrv.protein_g).padStart(5)}g C:${String(perSrv.carbs_g).padStart(5)}g F:${String(perSrv.fat_g).padStart(5)}g`)
    if (per100) {
      console.log(`         Per 100g:    ${String(per100.cal_per_100g).padStart(4)} cal | P:${String(per100.protein_per_100g).padStart(5)}g C:${String(per100.carbs_per_100g).padStart(5)}g F:${String(per100.fat_per_100g).padStart(5)}g`)
    }
    console.log(`         Servings: ${srv} · ${reasoning}`)
    succeeded++

  } catch (err) {
    console.log(`${idx} ❌  ${recipe.name.slice(0, 40)} — ${err.message}`)
    failed++
  }
}

console.log('\n── Summary ──────────────────────────────────────────────')
console.log(`   Total:          ${total}`)
console.log(`   Succeeded:      ${succeeded}`)
console.log(`   Used fallback:  ${fallbackCount} (no/empty ingredients)`)
console.log(`   Failed:         ${failed}`)
if (DRY_RUN) console.log('   DRY RUN — no DB writes made')
console.log()
