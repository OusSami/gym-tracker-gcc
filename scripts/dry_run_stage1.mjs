#!/usr/bin/env node
/**
 * dry_run_stage1.mjs  —  READ ONLY, no DB writes.
 *
 * Stage 1 dry run: protein default scaling fix.
 *
 * BUG: ING_DEFAULT_G for chicken/meat/shrimp/fish are flat 4-person
 *   totals (1200 / 800 / 500 / 600 g). When a recipe has 2 servings and
 *   an unquantified chicken ingredient, the whole-dish default is still
 *   1200 g ÷ 2 = 600 g per serving  → ~2× overcount.
 *   For 8 servings it goes the other way: 1200 ÷ 8 = 150 g per serving.
 *
 * FIX: per-person baselines, scaled by srv.
 *   chicken  300 g/person  (1200 ÷ 4)
 *   meat     200 g/person  (800 ÷ 4)
 *   shrimp   125 g/person  (500 ÷ 4)
 *   fish     150 g/person  (600 ÷ 4)
 *   At srv=4 the old and new defaults are identical → no change there.
 *
 * Output: for every recipe where the protein default was actually triggered
 *   (grams parsed = 0 for at least one protein ingredient) prints:
 *     name | servings | old cal | new cal | Δ% | protein type(s) defaulted
 */

import fs   from 'node:fs'
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
const env    = readEnv(path.join(__dirname, '..', '.env.local'))
const SB_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SB_KEY = env['SUPABASE_SERVICE_ROLE_KEY']
if (!SB_URL || !SB_KEY) { console.error('❌  Missing credentials'); process.exit(1) }

const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(SB_URL, SB_KEY)

// ── Shared parsing helpers (verbatim from estimate_nutrition.mjs) ──────────
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
  [/كيلوغرام|كيلوجرام/,   1000],
  [/كيلو/,                 1000],
  [/غراماً|غرامات|غرام/,    1],
  [/مللتر|مل(?!عقة)/,        1],
  [/لتر/,                  1000],
  [/أكواب|اكواب|كوب|كأس/,   220],
  [/ملاعق كبيرة|ملعقة كبيرة/, 15],
  [/ملاعق صغيرة|ملعقة صغيرة/,  5],
  [/ملاعق|ملعقة/,            12],
  [/حبات|حبة/,              130],
  [/شرائح|شريحة/,            80],
  [/قطع|قطعة/,              100],
  [/وحدات|وحدة/,             80],
]
function ingToGrams(text) {
  const t = toWestern(text)
  if (/دجاجة كاملة|دجاجتين كاملتين|دجاجة واحدة/.test(text))
    return /دجاجتين/.test(text) ? 2400 : 1200
  if (/(?:^|[\s:،])كيلو(?:$|[\s،])/.test(text) && !t.match(/\d\s*كيلو/)) return 1000
  if (/نصف\s*كيلو/.test(text)) return 500
  if (/ربع\s*كيلو/.test(text))  return 250
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
  ['chickpea',['حمص']],
  ['legume',  ['فاصوليا', 'لوبيا', 'فول']],
  ['onion',   ['بصل', 'بصلة']],
  ['carrot',  ['جزر', 'جزرة']],
  ['veggie',  ['خضار', 'فلفل', 'خيار', 'كوسا', 'باذنجان', 'ملفوف', 'كرنب', 'بروكلي']],
  ['water',   ['ماء', 'مياه', 'ماءً']],
]
function classifyIng(text) {
  for (const [type, keywords] of ING_TYPES)
    if (keywords.some(kw => text.includes(kw))) return type
  return 'other'
}

// ── Old flat defaults (verbatim) ───────────────────────────────────────────
const ING_DEFAULT_G_OLD = {
  rice: 360, grain: 300, noodle: 250, pasta: 300, flour: 250, oat: 200,
  chicken: 1200, meat: 800, shrimp: 500, fish: 600,
  oil: 45, butter: 60, sugar: 150, honey: 60, chocolate: 80,
  egg: 0,
  milk: 300, cream: 150, yogurt: 250, cheese: 120, coconut: 80,
  nut: 80, date: 100,
  potato: 300, pumpkin: 400, tomato: 300, lentil: 250, chickpea: 250,
  legume: 200, onion: 200, carrot: 150, veggie: 200, water: 800,
}

// ── New per-person protein baselines ──────────────────────────────────────
const PROTEIN_PER_PERSON_G = { chicken: 300, meat: 200, shrimp: 125, fish: 150 }
const PROTEIN_TYPES = new Set(Object.keys(PROTEIN_PER_PERSON_G))

// ── Profile builders ───────────────────────────────────────────────────────
function _buildProfile(ingredients, mode, srv) {
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
  const proteinDefaultsUsed = []   // which protein types triggered a default

  for (const ing of (ingredients || [])) {
    const type  = classifyIng(ing)
    const grams = ingToGrams(ing)

    if (type === 'egg') {
      const n = parseInt(toWestern(ing).match(/(\d+)/)?.[1] ?? '2', 10)
      p.eggsN += (n >= 1 && n <= 24) ? n : 2
      continue
    }

    let g
    if (grams > 0) {
      g = grams
    } else if (mode === 'new' && PROTEIN_TYPES.has(type)) {
      // FIX: scale by min(srv, 8) — cap prevents extreme totals on batch recipes
      g = PROTEIN_PER_PERSON_G[type] * Math.min(srv, 8)
      proteinDefaultsUsed.push(type)
    } else {
      g = ING_DEFAULT_G_OLD[type] ?? 0
      if (grams === 0 && g > 0 && PROTEIN_TYPES.has(type)) {
        proteinDefaultsUsed.push(type)
      }
    }
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
  return { p, proteinDefaultsUsed: [...new Set(proteinDefaultsUsed)] }
}

// ── Nutrition calculation (verbatim from estimate_nutrition.mjs) ───────────
const DENSITY = {
  riceCooked:[130,2.7,28.0,0.3,0.4], grainCooked:[110,3.5,23.0,0.5,1.8],
  noodleCk:[155,5.0,31.0,0.9,1.2],   pastaCk:[158,5.5,31.0,0.9,1.8],
  bakedFlour:[280,8.0,55.0,2.0,2.5], oatCk:[68,2.5,12.0,1.5,1.7],
  chickenCk:[165,25.0,0.0,6.5,0.0],  meatCk:[240,26.0,0.0,15.0,0.0],
  shrimpCk:[99,24.0,0.2,0.3,0.0],    fishCk:[130,20.0,0.0,5.0,0.0],
  oil:[884,0.0,0.0,100.0,0.0],       butter:[717,0.9,0.1,81.0,0.0],
  sugar:[387,0.0,100.0,0.0,0.0],     honey:[304,0.3,82.0,0.0,0.2],
  chocolate:[546,5.0,60.0,31.0,7.0], egg:[155,13.0,1.1,11.0,0.0],
  milk:[61,3.4,4.7,3.3,0.0],         cream:[345,2.8,3.0,36.0,0.0],
  yogurt:[59,3.5,3.6,3.3,0.0],       cheese:[350,25.0,1.3,28.0,0.0],
  coconut:[354,3.3,15.0,33.0,9.0],   nut:[600,20.0,20.0,50.0,7.0],
  date:[277,1.8,75.0,0.2,6.7],       potatoCk:[77,2.0,17.0,0.1,2.2],
  pumpkinCk:[26,1.0,6.5,0.1,0.5],    tomato:[18,0.9,3.9,0.2,1.2],
  lentilCk:[116,9.0,20.0,0.4,7.9],   chickpeaCk:[164,8.9,27.0,2.6,7.6],
  legumeCk:[127,8.0,23.0,0.5,7.0],   onion:[40,1.1,9.3,0.1,1.7],
  carrot:[41,0.9,9.6,0.2,2.8],       veggie:[30,2.0,5.0,0.3,2.5],
}
function addDensity(key, rawG, ef = 1) {
  const cookedG = rawG * ef
  const d = DENSITY[key]
  if (!d || cookedG <= 0) return {cal:0,prot:0,carbs:0,fat:0,fiber:0,wt:0}
  return {cal:cookedG*d[0]/100, prot:cookedG*d[1]/100, carbs:cookedG*d[2]/100,
          fat:cookedG*d[3]/100, fiber:cookedG*d[4]/100, wt:cookedG}
}
function sumNutrients(...parts) {
  const t={cal:0,prot:0,carbs:0,fat:0,fiber:0,wt:0}
  for(const p of parts){t.cal+=p.cal;t.prot+=p.prot;t.carbs+=p.carbs;t.fat+=p.fat;t.fiber+=p.fiber;t.wt+=p.wt}
  return t
}
function calcFromProfile(profile, srv) {
  const tot = sumNutrients(
    addDensity('riceCooked', profile.riceG, 2.8),
    addDensity('grainCooked',profile.grainG,2.5),
    addDensity('noodleCk',   profile.noodleG,2.5),
    addDensity('pastaCk',    profile.pastaG,2.5),
    addDensity('bakedFlour', profile.flourG,0.9),
    addDensity('oatCk',      profile.oatG,2.2),
    addDensity('chickenCk',  profile.chickenG,0.70),
    addDensity('meatCk',     profile.meatG,0.70),
    addDensity('shrimpCk',   profile.shrimpG,0.85),
    addDensity('fishCk',     profile.fishG,0.80),
    addDensity('oil',        profile.oilG,1.0),
    addDensity('butter',     profile.butterG,1.0),
    addDensity('sugar',      profile.sugarG,1.0),
    addDensity('honey',      profile.honeyG,1.0),
    addDensity('chocolate',  profile.chocolateG,1.0),
    addDensity('egg',        profile.eggsN*50,1.0),
    addDensity('milk',       profile.milkML,1.0),
    addDensity('cream',      profile.creamML,1.0),
    addDensity('yogurt',     profile.yogurtG,1.0),
    addDensity('cheese',     profile.cheeseG,1.0),
    addDensity('coconut',    profile.coconutG,1.0),
    addDensity('nut',        profile.nutG,1.0),
    addDensity('date',       profile.dateG,1.0),
    addDensity('potatoCk',   profile.potatoG,1.0),
    addDensity('pumpkinCk',  profile.pumpkinG,1.0),
    addDensity('tomato',     profile.tomatoG,1.0),
    addDensity('lentilCk',   profile.lentilG,2.5),
    addDensity('chickpeaCk', profile.chickpeaG,2.2),
    addDensity('legumeCk',   profile.legumesG,2.2),
    addDensity('onion',      profile.onionG,0.85),
    addDensity('carrot',     profile.carrotG,1.0),
    addDensity('veggie',     profile.veggieG,1.0),
  )
  const totalWeightG = tot.wt + profile.waterML
  const perSrv = {
    calories:  Math.round(tot.cal / srv),
    protein_g: Math.round(tot.prot  / srv * 10) / 10,
    carbs_g:   Math.round(tot.carbs / srv * 10) / 10,
    fat_g:     Math.round(tot.fat   / srv * 10) / 10,
    fiber_g:   Math.round(tot.fiber / srv * 10) / 10,
  }
  const per100 = totalWeightG > 50 ? {
    cal_per_100g:     Math.round(tot.cal / totalWeightG * 100),
    protein_per_100g: Math.round(tot.prot  / totalWeightG * 1000) / 10,
    carbs_per_100g:   Math.round(tot.carbs / totalWeightG * 1000) / 10,
    fat_per_100g:     Math.round(tot.fat   / totalWeightG * 1000) / 10,
  } : null
  return { perSrv, per100, totalWeightG, hasIngredients: tot.wt > 0 }
}

const CAT_FALLBACK = {
  'أرز ومجبوس':          {calories:520,protein_g:32,carbs_g:57,fat_g:14,fiber_g:3, cal_per_100g:135,protein_per_100g:8.3, carbs_per_100g:14.8,fat_per_100g:3.6},
  'دجاج':                {calories:330,protein_g:33,carbs_g: 6,fat_g:16,fiber_g:1, cal_per_100g:165,protein_per_100g:16.5,carbs_per_100g:3.0, fat_per_100g:8.0},
  'لحم':                 {calories:410,protein_g:30,carbs_g:10,fat_g:24,fiber_g:2, cal_per_100g:220,protein_per_100g:16.0,carbs_per_100g:5.3, fat_per_100g:12.8},
  'سمك ومأكولات بحرية':  {calories:250,protein_g:27,carbs_g: 6,fat_g:10,fiber_g:1, cal_per_100g:130,protein_per_100g:14.0,carbs_per_100g:3.1, fat_per_100g:5.2},
  'سمك':                 {calories:250,protein_g:27,carbs_g: 6,fat_g:10,fiber_g:1, cal_per_100g:130,protein_per_100g:14.0,carbs_per_100g:3.1, fat_per_100g:5.2},
  'شوربة':               {calories:180,protein_g:10,carbs_g:18,fat_g: 6,fiber_g:3, cal_per_100g:60, protein_per_100g:3.3, carbs_per_100g:6.0, fat_per_100g:2.0},
  'سلطة':                {calories:130,protein_g: 4,carbs_g:12,fat_g: 7,fiber_g:3, cal_per_100g:75, protein_per_100g:2.3, carbs_per_100g:6.9, fat_per_100g:4.0},
  'حلويات':              {calories:370,protein_g: 5,carbs_g:52,fat_g:15,fiber_g:2, cal_per_100g:360,protein_per_100g:4.9, carbs_per_100g:50.7,fat_per_100g:14.6},
  'فطور':                {calories:290,protein_g:13,carbs_g:28,fat_g:13,fiber_g:3, cal_per_100g:155,protein_per_100g:7.0, carbs_per_100g:15.0,fat_per_100g:7.0},
  'أطباق خليجية':        {calories:430,protein_g:25,carbs_g:48,fat_g:13,fiber_g:3, cal_per_100g:120,protein_per_100g:7.0, carbs_per_100g:13.4,fat_per_100g:3.6},
  'مقبلات':              {calories:170,protein_g: 7,carbs_g:17,fat_g: 9,fiber_g:3, cal_per_100g:160,protein_per_100g:6.6, carbs_per_100g:16.0,fat_per_100g:8.5},
  'مشروبات':             {calories:130,protein_g: 2,carbs_g:28,fat_g: 2,fiber_g:1, cal_per_100g:52, protein_per_100g:0.8, carbs_per_100g:11.2,fat_per_100g:0.8},
  'خبز ومعجنات':         {calories:310,protein_g: 9,carbs_g:46,fat_g:11,fiber_g:2, cal_per_100g:290,protein_per_100g:8.4, carbs_per_100g:43.0,fat_per_100g:10.3},
  'أخرى':                {calories:340,protein_g:16,carbs_g:32,fat_g:14,fiber_g:3, cal_per_100g:160,protein_per_100g:7.5, carbs_per_100g:15.0,fat_per_100g:6.6},
}

function applyFloors(perSrv, name, category, profile) {
  const has = (kws) => kws.some(kw => name.includes(kw))
  if (has(['هريس','هريسة']) && perSrv.calories < 350) {
    const r = 380 / perSrv.calories
    perSrv = { ...perSrv, calories:380,
      protein_g: Math.round(perSrv.protein_g*r*10)/10,
      carbs_g:   Math.round(perSrv.carbs_g*r*10)/10,
      fat_g:     Math.round(perSrv.fat_g*r*10)/10 }
  }
  if (has(['كبسة','مجبوس','برياني','مندي','بخاري','زربيان','مدفونة','مكبوس','قوزي','مقلوبة'])) {
    if (perSrv.calories < 420)
      perSrv = { ...perSrv, calories:460,
        carbs_g: Math.max(perSrv.carbs_g, 50),
        protein_g: Math.max(perSrv.protein_g, 28) }
  }
  const isRiceDish = category === 'أرز ومجبوس' || profile.riceG > 0 || profile.grainG > 0
  if (isRiceDish && perSrv.calories < 300) perSrv = { ...perSrv, calories:340, carbs_g: Math.max(perSrv.carbs_g, 38) }
  if (has(['دقوس']) && !has(['دجاج','لحم','سمك','أرز']))
    perSrv = { ...perSrv, calories: Math.min(perSrv.calories, 120), carbs_g: Math.min(perSrv.carbs_g, 14) }
  if (category === 'مشروبات' && perSrv.calories > 400) perSrv = { ...perSrv, calories:400 }
  if (perSrv.calories > 1200) {
    const r = 1200 / perSrv.calories
    perSrv = { ...perSrv, calories:1200,
      protein_g: Math.round(perSrv.protein_g*r*10)/10,
      carbs_g:   Math.round(perSrv.carbs_g*r*10)/10,
      fat_g:     Math.round(perSrv.fat_g*r*10)/10 }
  }
  return perSrv
}

// Full estimation pipeline: mode = 'old' | 'new'
function estimateCalories(recipe, mode) {
  const name     = recipe.name     ?? ''
  const category = recipe.category ?? 'أخرى'
  const srv      = parseServings(recipe.servings)
  const { p: profile, proteinDefaultsUsed } = _buildProfile(recipe.ingredients, mode, srv)
  const result   = calcFromProfile(profile, srv)

  let perSrv = result.perSrv
  let usedFallback = false

  if (!result.hasIngredients || perSrv.calories < 30) {
    const fb = CAT_FALLBACK[category] ?? CAT_FALLBACK['أخرى']
    perSrv = { calories: fb.calories, protein_g: fb.protein_g,
               carbs_g: fb.carbs_g, fat_g: fb.fat_g, fiber_g: fb.fiber_g }
    usedFallback = true
  }

  perSrv = applyFloors(perSrv, name, category, profile)
  return { calories: perSrv.calories, usedFallback, proteinDefaultsUsed, srv }
}

// ── Fetch all recipes ──────────────────────────────────────────────────────
console.log('\n📥  Fetching recipes…')
const { data: recipes, error } = await sb.from('recipes')
  .select('id, name, category, servings, ingredients, calories')
  .not('ingredients', 'is', null)
  .order('category')

if (error) { console.error('❌', error.message); process.exit(1) }
console.log(`    ${recipes.length} recipes fetched\n`)

// ── Compare old vs new for each recipe ────────────────────────────────────
const affected      = []
const unaffectedCnt = { srv4: 0, usedFallback: 0, noProteinDefault: 0 }

for (const r of recipes) {
  const oldResult = estimateCalories(r, 'old')
  const newResult = estimateCalories(r, 'new')

  // Only report recipes where:
  //  - protein default was triggered (grams=0 for at least one protein ing)
  //  - AND ingredient-based path was used (not category fallback)
  //  - AND old ≠ new (srv≠4 means the default differs)
  if (!oldResult.proteinDefaultsUsed.length || oldResult.usedFallback) {
    if (oldResult.usedFallback) unaffectedCnt.usedFallback++
    else unaffectedCnt.noProteinDefault++
    continue
  }
  if (oldResult.calories === newResult.calories) {
    unaffectedCnt.srv4++
    continue
  }

  const delta = newResult.calories - oldResult.calories
  const pct   = Math.round(delta / oldResult.calories * 100)

  affected.push({
    name:     r.name,
    category: r.category,
    srv:      oldResult.srv,
    dbCal:    r.calories,        // what's currently stored
    oldCal:   oldResult.calories,
    newCal:   newResult.calories,
    delta,
    pct,
    types:    oldResult.proteinDefaultsUsed.join('+'),
  })
}

// Sort by absolute delta descending (biggest swings first)
affected.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

// ── Print report ──────────────────────────────────────────────────────────
const LINE = '═'.repeat(74)
console.log(LINE)
console.log('  STAGE 1 DRY RUN — protein default scaling fix')
console.log(LINE)
console.log()

// Bucketed summary
const byServings = {}
for (const r of affected) {
  byServings[r.srv] = (byServings[r.srv] || [])
  byServings[r.srv].push(r)
}
console.log('Affected recipes by servings bucket:')
for (const [srv, list] of Object.entries(byServings).sort((a,b)=>+a[0]-+b[0])) {
  const avgDelta = Math.round(list.reduce((s,r)=>s+r.pct,0)/list.length)
  console.log(`  srv=${srv.padStart(2)}  →  ${String(list.length).padStart(3)} recipes  avg Δ ${avgDelta > 0 ? '+' : ''}${avgDelta}%`)
}
console.log()
console.log('Unaffected (skipped):')
console.log(`  srv=4, no change (old default = new default): ${unaffectedCnt.srv4}`)
console.log(`  used category fallback (no ingredient data):  ${unaffectedCnt.usedFallback}`)
console.log(`  no protein ingredient at all:                 ${unaffectedCnt.noProteinDefault}`)
console.log()
console.log(`TOTAL AFFECTED: ${affected.length} recipes\n`)

// Detailed listing
const HDR = [
  'Name'.padEnd(38),
  'Cat'.padEnd(18),
  'Srv',
  'DB'.padStart(5),
  'Old'.padStart(5),
  'New'.padStart(5),
  'Δ%'.padStart(6),
  'Type',
].join('  ')
console.log(HDR)
console.log('─'.repeat(102))

for (const r of affected) {
  const name    = r.name.slice(0, 37).padEnd(38)
  const cat     = r.category.slice(0, 17).padEnd(18)
  const srv     = String(r.srv).padStart(3)
  const dbCal   = String(r.dbCal ?? '-').padStart(5)
  const oldCal  = String(r.oldCal).padStart(5)
  const newCal  = String(r.newCal).padStart(5)
  const pct     = `${r.pct > 0 ? '+' : ''}${r.pct}%`.padStart(6)
  console.log(`${name}  ${cat}  ${srv}  ${dbCal}  ${oldCal}  ${newCal}  ${pct}  ${r.types}`)
}

// ── False-positive meat keyword investigation ──────────────────────────────
// For each affected recipe where "meat" type triggered the default,
// log which specific ingredient string(s) matched a meat keyword.
// Flags recipes in non-meat categories where the match looks incidental.
console.log()
console.log(LINE)
console.log('  FALSE POSITIVE INVESTIGATION — meat keyword matches')
console.log('  (reference list for Stage N — do not fix in Stage 1)')
console.log(LINE)
console.log()

const MEAT_KEYWORDS = ['لحم', 'لحمة', 'لحوم', 'عجل', 'ضأن', 'خروف', 'ضلع', 'كبدة', 'هبرة', 'كفتة', 'كفته', 'مفروم']
const MEAT_PRIMARY_CATS = new Set(['لحم', 'دجاج', 'سمك ومأكولات بحرية', 'سمك', 'أرز ومجبوس'])

function findMeatKeywordMatches(ingredients) {
  const hits = []
  for (const ing of (ingredients || [])) {
    for (const kw of MEAT_KEYWORDS) {
      if (ing.includes(kw)) { hits.push({ ing, kw }); break }
    }
  }
  return hits
}

// Build a map of recipe name → ingredients for all affected recipes
const affectedNames = new Set(affected.filter(r => r.types.includes('meat')).map(r => r.name))

// Fetch ingredients for those recipes (already in our fetched data)
const recipeMap = new Map(recipes.map(r => [r.name, r]))

const fpRows = []
for (const r of affected) {
  if (!r.types.includes('meat')) continue
  const full = recipeMap.get(r.name)
  if (!full) continue
  const hits = findMeatKeywordMatches(full.ingredients)
  const isSuspect = !MEAT_PRIMARY_CATS.has(r.category)
  fpRows.push({ ...r, hits, isSuspect })
}

// Sort: suspicious (non-meat category) first, then alphabetical
fpRows.sort((a, b) => (b.isSuspect ? 1 : 0) - (a.isSuspect ? 1 : 0) || a.category.localeCompare(b.category))

// Count by matched keyword
const kwCount = {}
for (const row of fpRows) {
  for (const { kw } of row.hits) kwCount[kw] = (kwCount[kw] || 0) + 1
}

console.log('Keyword frequency across all affected "meat" recipes:')
for (const [kw, cnt] of Object.entries(kwCount).sort((a,b) => b[1]-a[1])) {
  console.log(`  "${kw}"  → triggered in ${cnt} recipe(s)`)
}
console.log()
console.log(`Suspicious (non-primary-meat category): ${fpRows.filter(r=>r.isSuspect).length} recipes`)
console.log(`Expected meat dishes:                   ${fpRows.filter(r=>!r.isSuspect).length} recipes`)
console.log()

// Print suspicious ones with the matching ingredient string
const suspectRows = fpRows.filter(r => r.isSuspect)
if (suspectRows.length) {
  console.log('Suspicious false-positive recipes (meal keyword in non-meat dish):')
  console.log('─'.repeat(90))
  for (const row of suspectRows) {
    const name = row.name.slice(0, 42).padEnd(42)
    const cat  = row.category.slice(0, 16).padEnd(16)
    console.log(`${name}  [${cat}]  srv=${row.srv}`)
    for (const { ing, kw } of row.hits) {
      console.log(`     → ingredient: "${ing}"  (matched keyword: "${kw}")`)
    }
  }
} else {
  console.log('No suspicious false positives found.')
}

console.log()
console.log(LINE)
console.log('  DRY RUN COMPLETE — no data was written')
console.log(LINE)
console.log()
