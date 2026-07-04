/**
 * compare_meal_plans.mjs — Phase 3 pre-deploy comparison
 *
 * Runs BOTH v1 (single recipe/slot) and v2 (multi-item composer) logic
 * in-process against the real DB, for 4 representative profiles.
 *
 * Run: node scripts/compare_meal_plans.mjs
 *
 * Output shows side-by-side: what each version picks per slot, calorie accuracy,
 * and tier breakdown. No live API is called; no DB writes are made.
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
const env = readEnv(path.join(__dirname, '..', '.env.local'))
const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])

// ── Shared constants ──────────────────────────────────────────────────────────
const MEAL_STRUCTURE = [
  { time: 'الفطور',      pct: 0.25, required: true,  cats: ['فطور'],
    categories: ['فطور'] },
  { time: 'الغداء',      pct: 0.35, required: true,  cats: ['أرز ومجبوس','دجاج','لحم','سمك ومأكولات بحرية','أطباق خليجية'],
    categories: ['أرز ومجبوس','دجاج','لحم','سمك ومأكولات بحرية','أطباق خليجية'] },
  { time: 'وجبة خفيفة', pct: 0.15, required: false, cats: ['حلويات','مقبلات','سلطة','مشروبات'],
    categories: ['حلويات','مقبلات','سلطة','مشروبات'] },
  { time: 'العشاء',      pct: 0.25, required: true,  cats: ['دجاج','لحم','سمك ومأكولات بحرية','شوربة','سلطة','أرز ومجبوس'],
    categories: ['دجاج','لحم','سمك ومأكولات بحرية','شوربة','سلطة','أرز ومجبوس'] },
]

const FIELDS = 'id, name, category, recipe_type, extra_type, calories, protein_g, carbs_g, fat_g, servings'

// ── V1 logic (mirrors meal-plan.js exactly) ───────────────────────────────────
// Simple per-slot single-recipe selection with 5-tier fallback
function v1SelectSlot({ dishes, categories, seed, dayOffset, mealIdx, targetCal }) {
  const min30 = Math.round(targetCal * 0.70)
  const max30 = Math.round(targetCal * 1.30)
  const min50 = Math.round(targetCal * 0.50)
  const max50 = Math.round(targetCal * 1.50)

  const primaryCat = categories[(seed + mealIdx + dayOffset) % categories.length]

  const inCat  = dishes.filter(d => d.category === primaryCat)
  const inCats = dishes.filter(d => categories.includes(d.category))

  let pool =
    inCat.filter(d => d.calories >= min30 && d.calories <= max30)  ||
    inCat.filter(d => d.calories >= min50 && d.calories <= max50)  ||
    inCat                                                            ||
    inCats.filter(d => d.calories >= min50 && d.calories <= max50) ||
    dishes

  // Replicate v1 tier waterfall
  if (!pool.length || (pool = inCat.filter(d => d.calories >= min30 && d.calories <= max30)).length === 0) {
    pool = inCat.filter(d => d.calories >= min50 && d.calories <= max50)
    if (!pool.length) pool = inCat
    if (!pool.length) pool = inCats.filter(d => d.calories >= min50 && d.calories <= max50)
    if (!pool.length) pool = dishes
  }

  if (!pool.length) return null
  const idx    = (seed + dayOffset * 13 + mealIdx * 7) % pool.length
  const recipe = pool[idx]

  const withinT1 = recipe.calories >= min30 && recipe.calories <= max30
  const withinT2 = recipe.calories >= min50 && recipe.calories <= max50

  return {
    recipe,
    calories:   recipe.calories,
    targetCal,
    withinTier1: withinT1,
    withinTier2: withinT2,
  }
}

// ── V2 composer (inline copy from lib/mealComposer.js) ────────────────────────
const SLOT_SHAPES = {
  'الفطور':      ['solo_dish','solo_dish','dish_extra','dish_extra','dish_extra','dish_2extra'],
  'الغداء':      ['solo_dish','solo_dish','solo_dish','dish_extra','dish_extra','solo_dish'],
  'وجبة خفيفة': ['solo_extra','solo_extra','multi_extra','dish_extra','solo_dish','multi_extra'],
  'العشاء':      ['solo_dish','solo_dish','dish_extra','dish_extra','dish_2extra','solo_dish'],
}
const PORTION_STEPS = [0.5, 0.75, 1.0]

function makeRng(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s = Math.imul(s, 1664525) + 1013904223
    return (s >>> 0) / 0x100000000
  }
}
function portionLabel(p) {
  if (p === 0.50) return 'نصف الحصة'
  if (p === 0.75) return '¾ الحصة'
  return 'حصة كاملة'
}
function bestPortion(dishCal, targetCal) {
  let best = 1.0, bestDiff = Infinity
  for (const p of PORTION_STEPS) {
    const cal = dishCal * p
    if (cal / targetCal > 1.55) continue
    const diff = Math.abs(cal - targetCal)
    if (diff < bestDiff) { bestDiff = diff; best = p }
  }
  return best
}
function fitExtraUnits(extra, remainingCal, datesUsedToday) {
  const perUnit = extra.calories
  if (!perUnit) return 0
  if (extra.extra_type === 'dates') {
    const maxAllowed = 7 - datesUsedToday
    const candidates = [1,3,5,7].filter(n => n <= maxAllowed)
    if (!candidates.length) return 0
    let best = candidates[0], bestDiff = Infinity
    for (const n of candidates) {
      const diff = Math.abs(n * perUnit - remainingCal)
      if (diff < bestDiff) { bestDiff = diff; best = n }
    }
    return best
  }
  const d1 = Math.abs(perUnit - remainingCal)
  const d2 = Math.abs(perUnit * 2 - remainingCal)
  if (d2 < d1 && perUnit * 2 <= remainingCal * 1.5) return 2
  return 1
}

function v2ComposeSlot({ mealTime, targetCal, dishes, extras, recentIds, dayDatesUsed, seed }) {
  const rng     = makeRng(seed)
  const tier1Lo = Math.round(targetCal * 0.70)
  const tier1Hi = Math.round(targetCal * 1.30)
  const tier2Lo = Math.round(targetCal * 0.50)
  const tier2Hi = Math.round(targetCal * 1.50)
  const slot     = MEAL_STRUCTURE.find(m => m.time === mealTime)
  const slotCats = slot?.cats || []
  const eligible = dishes.filter(d => slotCats.includes(d.category) && d.calories > 0)

  function sortDishes(pool, tgt) {
    return [...pool].sort((a, b) => {
      const aR = recentIds.has(a.id) ? 1 : 0
      const bR = recentIds.has(b.id) ? 1 : 0
      if (aR !== bR) return aR - bR
      const aBest = Math.min(...PORTION_STEPS.map(p => Math.abs(a.calories * p - tgt)))
      const bBest = Math.min(...PORTION_STEPS.map(p => Math.abs(b.calories * p - tgt)))
      return aBest - bBest
    })
  }
  function pickFrom(pool, n = 5) {
    const top = pool.slice(0, Math.min(n, pool.length))
    return top.length ? top[Math.floor(rng() * top.length)] : null
  }

  const shapes = SLOT_SHAPES[mealTime] || ['solo_dish','dish_extra']
  let shape = shapes[Math.floor(rng() * shapes.length)]
  if (shape === 'solo_extra' && targetCal >= 250) {
    const alts = ['multi_extra','dish_extra','multi_extra','dish_extra']
    shape = alts[Math.floor(rng() * alts.length)]
  }

  const items  = []
  let calUsed  = 0
  let datesNow = dayDatesUsed

  function addExtra(pool, remainCal) {
    const candidates = pool
      .filter(e => !items.some(i => i.recipe.id === e.id))
      .filter(e => {
        if (e.extra_type === 'dates' && datesNow >= 7) return false
        return e.calories <= remainCal * 1.6 && e.calories > 0
      })
      .sort((a, b) => Math.abs(a.calories - remainCal) - Math.abs(b.calories - remainCal))
    const e = pickFrom(candidates, 4)
    if (!e) return 0
    const units = fitExtraUnits(e, remainCal, datesNow)
    if (!units) return 0
    const ecal = Math.round(e.calories * units)
    items.push({ type: 'extra', recipe: e, units, calories: ecal })
    calUsed += ecal
    if (e.extra_type === 'dates') datesNow += units
    return ecal
  }

  if (['solo_dish','dish_extra','dish_2extra'].includes(shape)) {
    const dishTarget = shape === 'solo_dish' ? targetCal : Math.round(targetCal * 0.75)
    let pool = sortDishes(eligible.filter(d => {
      const lo = Math.min(...PORTION_STEPS.map(p => d.calories * p))
      const hi = Math.max(...PORTION_STEPS.map(p => d.calories * p))
      return hi >= tier1Lo && lo <= tier1Hi
    }), dishTarget)
    if (!pool.length) pool = sortDishes(eligible.filter(d => {
      const lo = Math.min(...PORTION_STEPS.map(p => d.calories * p))
      const hi = Math.max(...PORTION_STEPS.map(p => d.calories * p))
      return hi >= tier2Lo && lo <= tier2Hi
    }), dishTarget)
    if (!pool.length) pool = sortDishes(eligible, dishTarget)
    if (!pool.length) pool = sortDishes(dishes, dishTarget)

    const dish = pickFrom(pool)
    if (!dish) return null
    const portion = bestPortion(dish.calories, dishTarget)
    const dishCal = Math.round(dish.calories * portion)
    items.push({ type: 'dish', recipe: dish, portion, calories: dishCal })
    calUsed += dishCal
    if (shape === 'dish_extra' || shape === 'dish_2extra') {
      addExtra(extras, targetCal - calUsed)
      if (shape === 'dish_2extra') addExtra(extras, targetCal - calUsed)
    }

  } else if (shape === 'solo_extra') {
    const candidates = extras
      .filter(e => e.calories > 0 && !(e.extra_type === 'dates' && datesNow >= 7))
      .sort((a, b) => Math.abs(a.calories - targetCal) - Math.abs(b.calories - targetCal))
    const e = pickFrom(candidates, 4)
    if (e) {
      const units = fitExtraUnits(e, targetCal, datesNow)
      if (units) {
        const ecal = Math.round(e.calories * units)
        items.push({ type: 'extra', recipe: e, units, calories: ecal })
        calUsed += ecal
        if (e.extra_type === 'dates') datesNow += units
      }
    }

  } else if (shape === 'multi_extra') {
    for (let i = 0; i < 3; i++) {
      const rem = targetCal - calUsed
      if (rem < 20) break
      if (!addExtra(extras, rem * 0.5)) break
    }
  }

  return {
    mealTime, shape, targetCal,
    items, totalCal: calUsed,
    withinTier1: calUsed >= tier1Lo && calUsed <= tier1Hi,
    withinTier2: calUsed >= tier2Lo && calUsed <= tier2Hi,
    dayDatesUsed: datesNow,
  }
}

// ── Data load ─────────────────────────────────────────────────────────────────
const { data: allDishes } = await sb.from('recipes').select(FIELDS)
  .or('recipe_type.is.null,recipe_type.eq.dish')
  .not('calories','is',null).gt('calories',0)
const { data: allExtras } = await sb.from('recipes').select(FIELDS)
  .eq('recipe_type','extra')
  .not('calories','is',null).gt('calories',0)

const dishes = allDishes || []
const extras  = allExtras || []
console.log(`Loaded ${dishes.length} dishes, ${extras.length} extras\n`)

// ── Profiles ──────────────────────────────────────────────────────────────────
const PROFILES = [
  { label: 'Profile A — Male 75kg, muscle goal,  2800 kcal/day', dailyCal: 2800, seed0: 42,  dayOffset: 0 },
  { label: 'Profile B — Female 60kg, weight loss, 1500 kcal/day', dailyCal: 1500, seed0: 77,  dayOffset: 0 },
  { label: 'Profile C — Male 90kg, endurance,    3200 kcal/day', dailyCal: 3200, seed0: 113, dayOffset: 0 },
  { label: 'Profile D — Female 55kg, general,    1800 kcal/day', dailyCal: 1800, seed0: 200, dayOffset: 0 },
]

// ── Tier label helper ─────────────────────────────────────────────────────────
function tierLabel(cal, target) {
  const pct = Math.round((cal / target) * 100)
  const lo1 = Math.round(target * 0.70), hi1 = Math.round(target * 1.30)
  const lo2 = Math.round(target * 0.50), hi2 = Math.round(target * 1.50)
  const band = cal >= lo1 && cal <= hi1 ? '✓ T1'
             : cal >= lo2 && cal <= hi2 ? '~ T2'
             : '✗ OOB'
  return `${cal} kcal (${pct}%) [${band}]`
}

// ── Main comparison loop ──────────────────────────────────────────────────────
const globalSummary = { v1t1: 0, v2t1: 0, total: 0 }

for (const profile of PROFILES) {
  const { label, dailyCal, seed0, dayOffset } = profile
  const recentIds = new Set()  // fresh profile — no recent history

  console.log('\n' + '═'.repeat(72))
  console.log(label)
  console.log(`Daily goal: ${dailyCal} kcal  |  seed: ${seed0}  |  dayOffset: ${dayOffset}`)
  console.log('═'.repeat(72))

  let v1DayTotal = 0, v2DayTotal = 0
  let v1T1 = 0, v2T1 = 0, slotCount = 0
  let v2DatesUsed = 0

  for (let mealIdx = 0; mealIdx < MEAL_STRUCTURE.length; mealIdx++) {
    const { time, pct, required, categories } = MEAL_STRUCTURE[mealIdx]
    const targetCal = Math.round(dailyCal * pct)

    // V1 result
    const v1 = v1SelectSlot({
      dishes,
      categories,
      seed: seed0,
      dayOffset,
      mealIdx,
      targetCal,
    })

    // V2 result
    const v2 = v2ComposeSlot({
      mealTime:     time,
      targetCal,
      dishes,
      extras,
      recentIds,
      dayDatesUsed: v2DatesUsed,
      seed:         seed0 + mealIdx * 17 + dayOffset * 13,
    })
    if (v2) v2DatesUsed = v2.dayDatesUsed

    slotCount++
    if (v1?.withinTier1) v1T1++
    if (v2?.withinTier1) v2T1++
    v1DayTotal += v1?.calories || 0
    v2DayTotal += v2?.totalCal || 0

    console.log(`\n  ┌─ ${time.padEnd(14)} (target: ${targetCal} kcal)`)

    // V1 line
    if (v1) {
      const tl = tierLabel(v1.calories, targetCal)
      console.log(`  │  V1: "${v1.recipe.name}"`)
      console.log(`  │      ${tl}`)
    } else {
      console.log(`  │  V1: ❌ no candidate found`)
    }

    // V2 lines
    if (v2) {
      const shape = v2.shape.padEnd(12)
      console.log(`  │  V2: [${shape}]`)
      for (const item of v2.items) {
        if (item.type === 'dish') {
          console.log(`  │    • [dish] "${item.recipe.name}"`)
          console.log(`  │             ${portionLabel(item.portion)} — ${item.calories} kcal`)
        } else {
          const u = item.units > 1 ? ` × ${item.units}` : ''
          console.log(`  │    • [extra/${item.recipe.extra_type}] ${item.recipe.name}${u} — ${item.calories} kcal`)
        }
      }
      const tl = tierLabel(v2.totalCal, targetCal)
      console.log(`  │      Total: ${tl}`)
      if (v2DatesUsed > 0) console.log(`  │      تمر today: ${v2DatesUsed}/7`)
    } else {
      console.log(`  │  V2: ❌ composer returned null`)
    }
    console.log(`  └${'─'.repeat(60)}`)
  }

  const v1pct = Math.round((v1DayTotal / dailyCal) * 100)
  const v2pct = Math.round((v2DayTotal / dailyCal) * 100)

  console.log(`\n  ── Day summary ${'─'.repeat(50)}`)
  console.log(`  V1 day total : ${v1DayTotal} kcal (${v1pct}% of ${dailyCal})  |  T1 slots: ${v1T1}/${slotCount}`)
  console.log(`  V2 day total : ${v2DayTotal} kcal (${v2pct}% of ${dailyCal})  |  T1 slots: ${v2T1}/${slotCount}`)
  console.log(`  V2 تمر total : ${v2DatesUsed}/7 ${v2DatesUsed <= 7 ? '✓' : '✗ LIMIT EXCEEDED'}`)

  globalSummary.v1t1  += v1T1
  globalSummary.v2t1  += v2T1
  globalSummary.total += slotCount
}

const t = globalSummary.total
console.log('\n' + '═'.repeat(72))
console.log('AGGREGATE SUMMARY (all 4 profiles × 4 slots = 16 slots)')
console.log('═'.repeat(72))
console.log(`  V1 Tier-1 slots: ${globalSummary.v1t1}/${t} (${Math.round(globalSummary.v1t1/t*100)}%)`)
console.log(`  V2 Tier-1 slots: ${globalSummary.v2t1}/${t} (${Math.round(globalSummary.v2t1/t*100)}%)`)
console.log()
console.log('  ✓ V2 live API is NOT active. Promote meal-plan-v2.js → meal-plan.js')
console.log('    only after reviewing the output above and confirming.')
