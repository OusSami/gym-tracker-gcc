#!/usr/bin/env node
/**
 * dryrun_regex_fix.mjs
 *
 * Compares ingToGrams() BEFORE and AFTER the (?:${pattern.source}) fix.
 * For every recipe in the DB:
 *   1. Identifies which ingredients parsed to different gram amounts
 *   2. Re-estimates nutrition with the fixed parser
 *   3. Compares against stored DB values (delta %)
 *   4. Flags outliers with >±50% calorie change
 *
 * Usage: node scripts/dryrun_regex_fix.mjs
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

// ── Shared helpers ─────────────────────────────────────────────────────────
function toWestern(s) {
  return String(s).replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
}
function parseLeadNum(text) {
  const t = toWestern(text)
  if (/ثلاثة أرباع|¾/.test(t)) return 0.75
  if (/نصف/.test(t)) return 0.5
  if (/ثلثان|ثلثا/.test(t)) return 0.667
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

// ── BROKEN parser (original — missing (?:...) wrapper) ────────────────────
function ingToGrams_broken(text) {
  const t = toWestern(text)
  if (/دجاجة كاملة|دجاجتين كاملتين|دجاجة واحدة/.test(text)) return /دجاجتين/.test(text) ? 2400 : 1200
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

// ── FIXED parser — all 4 fixes: (?:...) wrapper, ثلثان, bare-singular, fallback threshold ──
function ingToGrams_fixed(text) {
  const t = toWestern(text)
  if (/دجاجة كاملة|دجاجتين كاملتين|دجاجة واحدة/.test(text)) return /دجاجتين/.test(text) ? 2400 : 1200
  if (/(?:^|[\s:،])كيلو(?:$|[\s،])/.test(text) && !t.match(/\d\s*كيلو/)) return 1000
  if (/نصف\s*كيلو/.test(text)) return 500
  if (/ربع\s*كيلو/.test(text)) return 250
  // Pass 1: quantity + unit
  for (const [pattern, perUnit] of UNIT_G) {
    const rx = new RegExp(
      `(نصف|ثلثان|ثلثا|ثلث|ربع|ثلاثة أرباع|\\d+\\.?\\d*)\\s*(?:و(?:نصف|ثلث|ربع))?\\s*(?:${pattern.source})`,
      'i'
    )
    const m = t.match(rx)
    if (m) return parseLeadNum(m[1]) * perUnit
  }
  // Pass 2: bare singular unit — Arabic bare singular = "one unit"
  for (const [pattern, perUnit] of UNIT_G) {
    const rx2 = new RegExp(`(?:^|\\s)(?:${pattern.source})(?:\\s|$|[،,.;:])`, 'i')
    if (rx2.test(t)) return perUnit
  }
  const bareNum = t.match(/^[^٠-٩\d]*(\d+\.?\d*)\s*(?:$|[،,])/)
  if (bareNum) return parseFloat(bareNum[1])
  return 0
}

// ── Full estimation pipeline (uses the fixed parser) ──────────────────────
const ING_TYPES = [
  ['rice',     ['أرز', 'رز']],
  ['grain',    ['قمح', 'هريس', 'جريش', 'بلغر', 'برغل']],
  ['noodle',   ['شعيرية']],
  ['pasta',    ['معكرونة', 'مكرونة', 'سباغيتي', 'باستا', 'لازانيا', 'فرموتشيني']],
  ['flour',    ['دقيق', 'طحين']],
  ['oat',      ['شوفان']],
  ['potato',   ['بطاطس', 'بطاطا']],
  ['pumpkin',  ['قرع', 'يقطين']],
  ['tomato',   ['طماطم', 'طماطة', 'تماطم', 'صلصة طماطم', 'معجون الطماطم', 'معجون طماطم']],
  ['lentil',   ['عدس']],
  ['onion',    ['بصل', 'بصلة', 'كراث', 'ثوم', 'ثومة']],
  ['carrot',   ['جزر', 'جزرة']],
  ['veggie',   ['خضار','فلفل','خيار','كوسا','باذنجان','ملفوف','كرنب','بروكلي','سبانخ','كزبرة','بقدونس','نعناع','زعتر','ريحان','كرفس','هليون','شمندر','بنجر','فطر','مشروم','ورق العنب']],
  ['fruit',    ['موز','تفاح','مانجو','فراولة','رمان','تين','توت','عنب','برتقال','أناناس','كيوي','مشمش','جوافة','كمثرى','خوخ','يوسفي','فاكهة']],
  ['avocado',  ['أفوكادو']],
  ['chicken',  ['دجاج','دجاجة','فراخ','فرخة','صدر دجاج','فيليه دجاج']],
  ['meat',     ['لحم','لحمة','لحوم','عجل','ضأن','خروف','غنم','ضلع','كبدة','هبرة','كفتة','كفته','مفروم']],
  ['shrimp',   ['ربيان','روبيان','جمبري','قريدس','كروفيتاس']],
  ['fish',     ['سمك','هامور','ميرو','بلطي','تونة','سردين','فيليه سمك','حبار','سلمون']],
  ['oil',      ['زيت']],
  ['butter',   ['زبدة','سمنة','سمن']],
  ['corn',     ['ذرة']],
  ['sugar',    ['سكر']],
  ['honey',    ['عسل']],
  ['chocolate',['شوكولا','شوكولاته','كاكاو']],
  ['egg',      ['بيض','بيضة','بيضات']],
  ['legume',   ['فاصوليا','لوبيا','فول']],
  ['milk',     ['حليب','لبن حليب']],
  ['cream',    ['كريمة','قشطة','كريم']],
  ['yogurt',   ['زبادي','لبن','لبنة']],
  ['cheese',   ['جبنة','جبن','موزاريلا','شيدر','كريم تشيز']],
  ['coconut',  ['جوز هند','كوكونات']],
  ['nut',      ['لوز','جوز','فستق','كاجو','مكسرات','بندق']],
  ['date',     ['تمر','رطب']],
  ['chickpea', ['حمص']],
  ['water',    ['ماء','مياه','ماءً']],
]

function classifyIng(text) {
  if (text.includes('زيتون') && !text.includes('زيت زيتون') && !text.includes('زيت الزيتون')) return 'olive'
  if (text.includes('ستيك') && !text.includes('تونا') && !text.includes('سمك')) return 'meat'
  for (const [type, keywords] of ING_TYPES) {
    if (keywords.some(kw => text.includes(kw))) return type
  }
  return 'other'
}

const ING_DEFAULT_G = {
  rice:360, grain:300, noodle:250, pasta:300, flour:250, oat:200,
  chicken:1200, meat:800, shrimp:500, fish:600,
  oil:45, butter:60, corn:150, sugar:150, honey:60, chocolate:80,
  egg:0,
  milk:300, cream:150, yogurt:250, cheese:120, coconut:80,
  nut:80, date:100,
  potato:300, pumpkin:400, tomato:300, lentil:250, chickpea:250,
  legume:200, onion:200, carrot:150, veggie:200,
  fruit:150, avocado:100, olive:30,
  water:800,
}
const PROTEIN_PER_PERSON_G = { chicken:300, meat:200, shrimp:125, fish:150 }
const PROTEIN_SCALE_TYPES  = new Set(Object.keys(PROTEIN_PER_PERSON_G))

function buildProfile(ingredients, srv, ingToGramsFn) {
  const p = {
    riceG:0, grainG:0, noodleG:0, pastaG:0, flourG:0, oatG:0,
    chickenG:0, meatG:0, shrimpG:0, fishG:0,
    oilG:0, butterG:0, sugarG:0, honeyG:0, chocolateG:0,
    eggsN:0,
    milkML:0, creamML:0, yogurtG:0, cheeseG:0, coconutG:0,
    nutG:0, dateG:0,
    potatoG:0, pumpkinG:0, tomatoG:0, lentilG:0, chickpeaG:0,
    legumesG:0, onionG:0, carrotG:0, veggieG:0,
    fruitG:0, avocadoG:0, cornG:0, oliveG:0,
    waterML:0,
  }
  for (const ing of (ingredients || [])) {
    const type  = classifyIng(ing)
    const grams = ingToGramsFn(ing)
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
    if (type === 'olive' && /حبات|حبة/.test(ing)) {
      const m = toWestern(ing).match(/(نصف|ثلث|ربع|ثلاثة أرباع|\d+\.?\d*)\s*(?:و(?:نصف|ثلث|ربع))?\s*حب[اةت]/)
      if (m) g = parseLeadNum(m[1]) * 4
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
      case 'corn':      p.cornG      += g; break
      case 'olive':     p.oliveG     += g; break
      case 'water':     p.waterML    += g; break
    }
  }
  return p
}

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
  fruit:[65,0.8,16.0,0.3,2.0],       avocado:[160,2.0,9.0,15.0,6.7],
  corn:[86,3.3,19.0,1.2,2.7],        olive:[115,0.8,6.0,10.5,1.5],
}

function addDensity(key, rawG, ef=1) {
  const cg=rawG*ef, d=DENSITY[key]
  if (!d||cg<=0) return {cal:0,prot:0,carbs:0,fat:0,fiber:0,wt:0}
  return {cal:cg*d[0]/100,prot:cg*d[1]/100,carbs:cg*d[2]/100,fat:cg*d[3]/100,fiber:cg*d[4]/100,wt:cg}
}
function sumNutrients(...parts) {
  const t={cal:0,prot:0,carbs:0,fat:0,fiber:0,wt:0}
  for (const p of parts) {t.cal+=p.cal;t.prot+=p.prot;t.carbs+=p.carbs;t.fat+=p.fat;t.fiber+=p.fiber;t.wt+=p.wt}
  return t
}

function calcFromProfile(profile, srv) {
  const tot = sumNutrients(
    addDensity('riceCooked',  profile.riceG,    2.8),
    addDensity('grainCooked', profile.grainG,   2.5),
    addDensity('noodleCk',    profile.noodleG,  2.5),
    addDensity('pastaCk',     profile.pastaG,   2.5),
    addDensity('bakedFlour',  profile.flourG,   0.9),
    addDensity('oatCk',       profile.oatG,     2.2),
    addDensity('chickenCk',   profile.chickenG, 0.70),
    addDensity('meatCk',      profile.meatG,    0.70),
    addDensity('shrimpCk',    profile.shrimpG,  0.85),
    addDensity('fishCk',      profile.fishG,    0.80),
    addDensity('oil',         profile.oilG,     1.0),
    addDensity('butter',      profile.butterG,  1.0),
    addDensity('sugar',       profile.sugarG,   1.0),
    addDensity('honey',       profile.honeyG,   1.0),
    addDensity('chocolate',   profile.chocolateG,1.0),
    addDensity('egg',         profile.eggsN*50, 1.0),
    addDensity('milk',        profile.milkML,   1.0),
    addDensity('cream',       profile.creamML,  1.0),
    addDensity('yogurt',      profile.yogurtG,  1.0),
    addDensity('cheese',      profile.cheeseG,  1.0),
    addDensity('coconut',     profile.coconutG, 1.0),
    addDensity('nut',         profile.nutG,     1.0),
    addDensity('date',        profile.dateG,    1.0),
    addDensity('potatoCk',    profile.potatoG,  1.0),
    addDensity('pumpkinCk',   profile.pumpkinG, 1.0),
    addDensity('tomato',      profile.tomatoG,  1.0),
    addDensity('lentilCk',    profile.lentilG,  2.5),
    addDensity('chickpeaCk',  profile.chickpeaG,2.2),
    addDensity('legumeCk',    profile.legumesG, 2.2),
    addDensity('onion',       profile.onionG,   0.85),
    addDensity('carrot',      profile.carrotG,  1.0),
    addDensity('veggie',      profile.veggieG,  1.0),
    addDensity('fruit',       profile.fruitG,   1.0),
    addDensity('avocado',     profile.avocadoG, 1.0),
    addDensity('corn',        profile.cornG,    1.0),
    addDensity('olive',       profile.oliveG,   1.0),
  )
  const totalWeightG = tot.wt + profile.waterML
  const perSrv = {
    calories:  Math.round(tot.cal/srv),
    protein_g: Math.round(tot.prot /srv*10)/10,
    carbs_g:   Math.round(tot.carbs/srv*10)/10,
    fat_g:     Math.round(tot.fat  /srv*10)/10,
    fiber_g:   Math.round(tot.fiber/srv*10)/10,
  }
  const per100 = totalWeightG>50 ? {
    cal_per_100g:     Math.round(tot.cal/totalWeightG*100),
    protein_per_100g: Math.round(tot.prot/totalWeightG*1000)/10,
    carbs_per_100g:   Math.round(tot.carbs/totalWeightG*1000)/10,
    fat_per_100g:     Math.round(tot.fat/totalWeightG*1000)/10,
  } : null
  return { perSrv, per100, totalWeightG, hasIngredients: tot.wt>0 }
}

const CAT_FALLBACK = {
  'أرز ومجبوس': {calories:520,protein_g:32,carbs_g:57,fat_g:14,fiber_g:3,cal_per_100g:135,protein_per_100g:8.3,carbs_per_100g:14.8,fat_per_100g:3.6},
  'دجاج':       {calories:330,protein_g:33,carbs_g:6,fat_g:16,fiber_g:1,cal_per_100g:165,protein_per_100g:16.5,carbs_per_100g:3.0,fat_per_100g:8.0},
  'لحم':        {calories:410,protein_g:30,carbs_g:10,fat_g:24,fiber_g:2,cal_per_100g:220,protein_per_100g:16.0,carbs_per_100g:5.3,fat_per_100g:12.8},
  'سمك ومأكولات بحرية':{calories:250,protein_g:27,carbs_g:6,fat_g:10,fiber_g:1,cal_per_100g:130,protein_per_100g:14.0,carbs_per_100g:3.1,fat_per_100g:5.2},
  'سمك':        {calories:250,protein_g:27,carbs_g:6,fat_g:10,fiber_g:1,cal_per_100g:130,protein_per_100g:14.0,carbs_per_100g:3.1,fat_per_100g:5.2},
  'شوربة':      {calories:180,protein_g:10,carbs_g:18,fat_g:6,fiber_g:3,cal_per_100g:60,protein_per_100g:3.3,carbs_per_100g:6.0,fat_per_100g:2.0},
  'سلطة':       {calories:130,protein_g:4,carbs_g:12,fat_g:7,fiber_g:3,cal_per_100g:75,protein_per_100g:2.3,carbs_per_100g:6.9,fat_per_100g:4.0},
  'حلويات':     {calories:370,protein_g:5,carbs_g:52,fat_g:15,fiber_g:2,cal_per_100g:360,protein_per_100g:4.9,carbs_per_100g:50.7,fat_per_100g:14.6},
  'فطور':       {calories:290,protein_g:13,carbs_g:28,fat_g:13,fiber_g:3,cal_per_100g:155,protein_per_100g:7.0,carbs_per_100g:15.0,fat_per_100g:7.0},
  'أطباق خليجية':{calories:430,protein_g:25,carbs_g:48,fat_g:13,fiber_g:3,cal_per_100g:120,protein_per_100g:7.0,carbs_per_100g:13.4,fat_per_100g:3.6},
  'مقبلات':     {calories:170,protein_g:7,carbs_g:17,fat_g:9,fiber_g:3,cal_per_100g:160,protein_per_100g:6.6,carbs_per_100g:16.0,fat_per_100g:8.5},
  'مشروبات':    {calories:130,protein_g:2,carbs_g:28,fat_g:2,fiber_g:1,cal_per_100g:52,protein_per_100g:0.8,carbs_per_100g:11.2,fat_per_100g:0.8},
  'خبز ومعجنات':{calories:310,protein_g:9,carbs_g:46,fat_g:11,fiber_g:2,cal_per_100g:290,protein_per_100g:8.4,carbs_per_100g:43.0,fat_per_100g:10.3},
  'أخرى':       {calories:340,protein_g:16,carbs_g:32,fat_g:14,fiber_g:3,cal_per_100g:160,protein_per_100g:7.5,carbs_per_100g:15.0,fat_per_100g:6.6},
}

function applyFloors(perSrv, per100, name, category, profile) {
  const has = (kws) => kws.some(kw => name.includes(kw))
  if (has(['هريس','هريسة']) && perSrv.calories < 350) {
    const ratio=380/perSrv.calories
    perSrv.calories=380; perSrv.protein_g=Math.round(perSrv.protein_g*ratio*10)/10
    perSrv.carbs_g=Math.round(perSrv.carbs_g*ratio*10)/10
    perSrv.fat_g=Math.round(perSrv.fat_g*ratio*10)/10
    if (per100) per100.cal_per_100g=Math.max(per100.cal_per_100g,90)
  }
  const isRiceDish = category==='أرز ومجبوس'||profile.riceG>0||profile.grainG>0
  if (has(['كبسة','مجبوس','برياني','مندي','بخاري','زربيان','مدفونة','مكبوس','قوزي','مقلوبة'])) {
    if (perSrv.calories<420) { perSrv.calories=460; perSrv.carbs_g=Math.max(perSrv.carbs_g,50); perSrv.protein_g=Math.max(perSrv.protein_g,28) }
  }
  if (isRiceDish && perSrv.calories<300) { perSrv.calories=340; perSrv.carbs_g=Math.max(perSrv.carbs_g,38) }
  if (has(['دقوس']) && !has(['دجاج','لحم','سمك','أرز'])) {
    perSrv.calories=Math.min(perSrv.calories,120); perSrv.carbs_g=Math.min(perSrv.carbs_g,14)
  }
  if (category==='مشروبات' && perSrv.calories>400) perSrv.calories=400
  if (perSrv.calories>1200) {
    const ratio=1200/perSrv.calories
    perSrv.calories=1200; perSrv.protein_g=Math.round(perSrv.protein_g*ratio*10)/10
    perSrv.carbs_g=Math.round(perSrv.carbs_g*ratio*10)/10; perSrv.fat_g=Math.round(perSrv.fat_g*ratio*10)/10
  }
  return { perSrv, per100 }
}

function estimateNutrition(recipe, ingToGramsFn) {
  const name=recipe.name??'', category=recipe.category??'أخرى'
  const srv=parseServings(recipe.servings)
  const profile=buildProfile(recipe.ingredients, srv, ingToGramsFn)
  const result=calcFromProfile(profile, srv)
  let perSrv=result.perSrv, per100=result.per100, usedFallback=false
  if (!result.hasIngredients||perSrv.calories<80) {
    const fb=CAT_FALLBACK[category]??CAT_FALLBACK['أخرى']
    perSrv={calories:fb.calories,protein_g:fb.protein_g,carbs_g:fb.carbs_g,fat_g:fb.fat_g,fiber_g:fb.fiber_g}
    per100={cal_per_100g:fb.cal_per_100g,protein_per_100g:fb.protein_per_100g,carbs_per_100g:fb.carbs_per_100g,fat_per_100g:fb.fat_per_100g}
    usedFallback=true
  }
  const floored=applyFloors(perSrv, per100, name, category, profile)
  perSrv=floored.perSrv; per100=floored.per100
  if (!per100) {
    const fb=CAT_FALLBACK[category]??CAT_FALLBACK['أخرى']
    const scale=perSrv.calories/(fb.calories||1)
    per100={cal_per_100g:Math.round(fb.cal_per_100g*scale),protein_per_100g:Math.round(fb.protein_per_100g*scale*10)/10,carbs_per_100g:Math.round(fb.carbs_per_100g*scale*10)/10,fat_per_100g:Math.round(fb.fat_per_100g*scale*10)/10}
  }
  return { perSrv, usedFallback }
}

// ── Per-ingredient comparison ──────────────────────────────────────────────
function getIngChanges(ingredients) {
  const changes = []
  for (const ing of (ingredients || [])) {
    const brokenG = ingToGrams_broken(ing)
    const fixedG  = ingToGrams_fixed(ing)
    if (Math.abs(brokenG - fixedG) > 0.01) {
      changes.push({ ing, brokenG, fixedG })
    }
  }
  return changes
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log('\n📥  Fetching all recipes with stored nutrition…')
const { data: recipes, error } = await supabase
  .from('recipes')
  .select('id, name, category, servings, ingredients, calories, protein_g, carbs_g, fat_g, fiber_g')
  .order('created_at')
if (error) { console.error('❌', error.message); process.exit(1) }

const total = recipes.length
console.log(`    ${total} recipes fetched\n`)

const affected    = []   // { recipe, changes, storedCal, newCal, deltaPct, ... }
const unaffected  = []
const outliers    = []   // delta > ±50% calories

for (const recipe of recipes) {
  const changes = getIngChanges(recipe.ingredients)
  const isAffected = changes.length > 0

  const newEst  = estimateNutrition(recipe, ingToGrams_fixed)
  const newNS   = newEst.perSrv
  const stored  = {
    calories:  recipe.calories  ?? null,
    protein_g: recipe.protein_g ?? null,
    carbs_g:   recipe.carbs_g   ?? null,
    fat_g:     recipe.fat_g     ?? null,
    fiber_g:   recipe.fiber_g   ?? null,
  }

  let calDeltaPct = null
  if (stored.calories && stored.calories > 0) {
    calDeltaPct = Math.round((newNS.calories - stored.calories) / stored.calories * 100)
  }

  const row = { recipe, changes, stored, newNS, calDeltaPct }
  if (isAffected) {
    affected.push(row)
    if (calDeltaPct !== null && Math.abs(calDeltaPct) >= 50) outliers.push(row)
  } else {
    unaffected.push(row)
  }
}

// ── Report: affected recipes table ─────────────────────────────────────────
console.log('═'.repeat(110))
console.log('AFFECTED RECIPES — stored vs new estimate (delta = new − stored)')
console.log('═'.repeat(110))
console.log(
  'Name'.padEnd(34) +
  'Cat'.padEnd(12) +
  'Srv' .padStart(4) +
  '  StoredCal' +
  '  NewCal' +
  '  ΔCal%' +
  '  StoredP' +
  '  NewP' +
  '  StoredF' +
  '  NewF'
)
console.log('─'.repeat(110))

for (const { recipe, changes, stored, newNS, calDeltaPct } of affected) {
  const name    = (recipe.name || '').slice(0, 33).padEnd(33)
  const cat     = (recipe.category || '').slice(0, 11).padEnd(11)
  const srv     = String(parseServings(recipe.servings)).padStart(4)
  const sCal    = String(stored.calories  ?? '?').padStart(9)
  const nCal    = String(newNS.calories).padStart(8)
  const delta   = calDeltaPct !== null ? (calDeltaPct >= 0 ? '+' : '') + calDeltaPct + '%' : '   ?'
  const flagged = calDeltaPct !== null && Math.abs(calDeltaPct) >= 50 ? ' ⚠️ ' : '    '
  const sP      = String(stored.protein_g ?? '?').padStart(8)
  const nP      = String(newNS.protein_g).padStart(6)
  const sF      = String(stored.fat_g    ?? '?').padStart(8)
  const nF      = String(newNS.fat_g).padStart(6)
  console.log(`${name} ${cat} ${srv}  ${sCal}  ${nCal}  ${delta.padStart(6)}${flagged}  ${sP}  ${nP}  ${sF}  ${nF}`)

  // Show the specific ingredient changes (indented)
  for (const { ing, brokenG, fixedG } of changes) {
    const ingShort = ing.slice(0, 55)
    const diff     = fixedG > brokenG ? '+' + (fixedG - brokenG).toFixed(0) : (fixedG - brokenG).toFixed(0)
    console.log(`     → "${ingShort}"`)
    console.log(`          broken: ${brokenG.toFixed(1)}g  →  fixed: ${fixedG.toFixed(1)}g  (${diff}g)`)
  }
}

// ── Outliers section ────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(110))
console.log(`OUTLIERS  (|ΔCal| ≥ 50%) — ${outliers.length} recipe(s)`)
console.log('═'.repeat(110))
if (outliers.length === 0) {
  console.log('   None.')
} else {
  for (const { recipe, stored, newNS, calDeltaPct, changes } of outliers) {
    console.log(`\n  ${recipe.name} [${recipe.category}]`)
    console.log(`    Cal: ${stored.calories} → ${newNS.calories}  (${calDeltaPct >= 0 ? '+' : ''}${calDeltaPct}%)`)
    console.log(`    P:   ${stored.protein_g}g → ${newNS.protein_g}g`)
    console.log(`    C:   ${stored.carbs_g}g → ${newNS.carbs_g}g`)
    console.log(`    F:   ${stored.fat_g}g → ${newNS.fat_g}g`)
    console.log('    Ingredient changes:')
    for (const { ing, brokenG, fixedG } of changes) {
      console.log(`      "${ing.slice(0, 60)}"  ${brokenG.toFixed(1)}g → ${fixedG.toFixed(1)}g`)
    }
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
const affectedCount  = affected.length
const outlierCount   = outliers.length
const unaffCount     = unaffected.length

// Distribution of delta% among affected recipes (excluding nulls)
const deltas = affected.filter(r => r.calDeltaPct !== null).map(r => r.calDeltaPct)
const avgDelta = deltas.length ? Math.round(deltas.reduce((a,b) => a+b, 0) / deltas.length) : 0
const bigIncrease = deltas.filter(d => d > 20).length
const bigDecrease = deltas.filter(d => d < -20).length

console.log('\n' + '═'.repeat(110))
console.log('SUMMARY')
console.log('═'.repeat(110))
console.log(`  Total recipes:        ${total}`)
console.log(`  Affected by fix:      ${affectedCount}  (${Math.round(affectedCount/total*100)}%)`)
console.log(`  Unaffected:           ${unaffCount}  (${Math.round(unaffCount/total*100)}%)`)
console.log(`  Outliers |ΔCal|≥50%: ${outlierCount}`)
console.log(`  Avg calorie delta:    ${avgDelta >= 0 ? '+' : ''}${avgDelta}%`)
console.log(`  Cal increase >20%:    ${bigIncrease}`)
console.log(`  Cal decrease >20%:    ${bigDecrease}`)
console.log()

// Breakdown by most-commonly-changed unit patterns
const unitBuckets = {}
for (const { changes } of affected) {
  for (const { ing, brokenG, fixedG } of changes) {
    // Detect which UNIT_G pattern was involved by checking what the fixed parser matched
    let unit = 'unknown'
    if (/غراماً|غرامات|غرام/.test(ing)) unit = 'غرام'
    else if (/أكواب|اكواب|كوب|كأس/.test(ing)) unit = 'كوب'
    else if (/مللتر|مل/.test(ing)) unit = 'مل'
    else if (/ملاعق|ملعقة/.test(ing)) unit = 'ملعقة'
    else if (/حبات|حبة/.test(ing)) unit = 'حبة'
    else if (/شرائح|شريحة/.test(ing)) unit = 'شريحة'
    else if (/قطع|قطعة/.test(ing)) unit = 'قطعة'
    unitBuckets[unit] = (unitBuckets[unit] || 0) + 1
  }
}
console.log('  Changed ingredients by unit:')
for (const [unit, count] of Object.entries(unitBuckets).sort((a,b) => b[1]-a[1])) {
  console.log(`    ${unit.padEnd(8)} ${count}`)
}
console.log()
