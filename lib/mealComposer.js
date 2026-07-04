/**
 * lib/mealComposer.js
 * Multi-item slot composer for meal-plan generation (Phase 3).
 *
 * Shapes: solo_dish | dish_extra | dish_2extra | solo_extra | multi_extra
 * Rules:  Tier bands ±30%/±50% (mirrors live generator) · portion steps [0.5, 0.75, 1.0]
 *         تمر qty ∈ {1,3,5,7}, day-total ≤ 7 · pairing check dormant (no two_dishes shape yet)
 */

export const MEAL_STRUCTURE = [
  { time: 'الفطور',      pct: 0.25, required: true,  cats: ['فطور'] },
  { time: 'الغداء',      pct: 0.35, required: true,  cats: ['أرز ومجبوس', 'دجاج', 'لحم', 'سمك ومأكولات بحرية', 'أطباق خليجية'] },
  { time: 'وجبة خفيفة', pct: 0.15, required: false, cats: ['حلويات', 'مقبلات', 'سلطة', 'مشروبات'] },
  { time: 'العشاء',      pct: 0.25, required: true,  cats: ['دجاج', 'لحم', 'سمك ومأكولات بحرية', 'شوربة', 'سلطة', 'أرز ومجبوس'] },
]

const SLOT_SHAPES = {
  'الفطور':      ['solo_dish', 'solo_dish', 'dish_extra', 'dish_extra', 'dish_extra', 'dish_2extra'],
  'الغداء':      ['solo_dish', 'solo_dish', 'solo_dish',  'dish_extra', 'dish_extra', 'solo_dish'],
  'وجبة خفيفة': ['solo_extra', 'solo_extra', 'multi_extra', 'dish_extra', 'solo_dish', 'multi_extra'],
  'العشاء':      ['solo_dish', 'solo_dish', 'dish_extra', 'dish_extra', 'dish_2extra', 'solo_dish'],
}

const PORTION_STEPS = [0.5, 0.75, 1.0]

// LCG seeded RNG — reproducible output per (daily seed + slot index).
// 3 warmup rounds spread the low-magnitude seed (days-since-epoch ≈ 20 000)
// into the full 32-bit range before any caller consumes the sequence.
function makeRng(seed) {
  let s = (seed >>> 0) || 1
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0
  return () => {
    s = Math.imul(s, 1664525) + 1013904223
    return (s >>> 0) / 0x100000000
  }
}

// ── Cuisine classifier ────────────────────────────────────────────────────────
const GULF_KW  = ['مجبوس','كبسة','مندي','مطبق','هريس','عريكة','مدفون','مضبي','قرصان',
                   'حنيذ','هنيذ','مطازيز','مضروبة','اليغمش','الغوزي','مرقوق','جريش',
                   'عصيد','كيشة','مكبوس','بخاري','البكيلة','حمسة','الكمونية','المعدس',
                   'مموش','معبوج','القشد','الهريس','المثلوثة','الدقوس']
const WEST_KW  = ['باستا','بيتزا','برجر','ريزوتو','لازانيا','سباغيتي','ستيك','بيستو',
                   'سكونز','بروشكيتا','مونتي كريستو','هاش براون','بف باستري','ترياكي',
                   'ويني','شيزكيك','كريم كراميل','تيراميسو','تراميسو','بانكيك']
const ASIAN_KW = ['سوشي','رامن','دامبلينج','ويك','تمبورا','باد تاي','كاري الخضار','كاري دجاج']

export function cuisineOf(r) {
  const n = r.name || '', c = r.category || ''
  if (c === 'أطباق خليجية' || c === 'أرز ومجبوس') return 'gulf_arab'
  if (GULF_KW.some(k => n.includes(k)))  return 'gulf_arab'
  if (WEST_KW.some(k => n.includes(k)))  return 'western'
  if (ASIAN_KW.some(k => n.includes(k))) return 'asian'
  return 'neutral'
}

// Dormant until two_dishes shape is added
export function pairingOk(items) {
  const cs = new Set(items.filter(i => i.type === 'dish').map(i => cuisineOf(i.recipe)))
  return !(cs.has('western') && cs.has('asian'))
}

export function portionLabel(p) {
  if (p === 0.50) return 'نصف الحصة'
  if (p === 0.75) return '¾ الحصة'
  return 'حصة كاملة'
}

function bestPortion(dishCal, targetCal) {
  let best = 1.0, bestDiff = Infinity
  for (const p of PORTION_STEPS) {
    const cal = dishCal * p
    if (cal / targetCal > 1.55) continue  // beyond Tier-2 ceiling
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
    const candidates = [1, 3, 5, 7].filter(n => n <= maxAllowed)
    if (!candidates.length) return 0
    let best = candidates[0], bestDiff = Infinity
    for (const n of candidates) {
      const diff = Math.abs(n * perUnit - remainingCal)
      if (diff < bestDiff) { bestDiff = diff; best = n }
    }
    return best
  }
  // Non-date extras: 1 or 2 units
  const diff1 = Math.abs(perUnit - remainingCal)
  const diff2 = Math.abs(perUnit * 2 - remainingCal)
  if (diff2 < diff1 && perUnit * 2 <= remainingCal * 1.5) return 2
  return 1
}

/**
 * composeSlot — pick one or more items to fill a meal slot.
 *
 * @param {string}  mealTime      — 'الفطور' | 'الغداء' | 'وجبة خفيفة' | 'العشاء'
 * @param {number}  targetCal     — calorie target for this slot
 * @param {Array}   dishes        — all eligible dish records (pre-fetched, no components)
 * @param {Array}   extras        — all extra records (pre-fetched)
 * @param {Set}     recentIds     — recipe IDs from last N days (variety tiebreaker)
 * @param {number}  dayDatesUsed  — تمر units already consumed today before this slot
 * @param {number}  seed          — deterministic per-slot seed (changes daily + by slot)
 *
 * @returns {{ mealTime, shape, targetCal, items, totalCal, withinTier1, withinTier2, pairingOk, dayDatesUsed } | null}
 */
export function composeSlot({ mealTime, targetCal, dishes, extras, recentIds, dayDatesUsed, seed }) {
  const rng     = makeRng(seed)
  const tier1Lo = Math.round(targetCal * 0.70)
  const tier1Hi = Math.round(targetCal * 1.30)
  const tier2Lo = Math.round(targetCal * 0.50)
  const tier2Hi = Math.round(targetCal * 1.50)

  const slot     = MEAL_STRUCTURE.find(m => m.time === mealTime)
  const slotCats = slot?.cats || []
  const eligible = dishes.filter(d => slotCats.includes(d.category) && d.calories > 0)

  // Gap-driven sort: prefer not-recently-used, then closest calorie fit
  function sortDishes(pool, tgt) {
    return [...pool].sort((a, b) => {
      const aRec = recentIds.has(a.id) ? 1 : 0
      const bRec = recentIds.has(b.id) ? 1 : 0
      if (aRec !== bRec) return aRec - bRec
      const aBest = Math.min(...PORTION_STEPS.map(p => Math.abs(a.calories * p - tgt)))
      const bBest = Math.min(...PORTION_STEPS.map(p => Math.abs(b.calories * p - tgt)))
      return aBest - bBest
    })
  }

  // Pick from top N with seeded jitter (variety without pure randomness)
  function pickFrom(pool, n = 5) {
    const top = pool.slice(0, Math.min(n, pool.length))
    return top.length ? top[Math.floor(rng() * top.length)] : null
  }

  // Select shape
  const shapes = SLOT_SHAPES[mealTime] || ['solo_dish', 'dish_extra']
  let shape = shapes[Math.floor(rng() * shapes.length)]
  // solo_extra can't reach ≥250 kcal target reliably — demote it
  if (shape === 'solo_extra' && targetCal >= 250) {
    const alts = ['multi_extra', 'dish_extra', 'multi_extra', 'dish_extra']
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

  if (['solo_dish', 'dish_extra', 'dish_2extra'].includes(shape)) {
    const dishTarget = shape === 'solo_dish' ? targetCal : Math.round(targetCal * 0.75)

    // Tier 1 → Tier 2 → any eligible → cross-category (same tier ladder as v1)
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
    if (!pool.length) pool = sortDishes(dishes, dishTarget)  // cross-category fallback

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
    // 2–3 extras, each closing ~half the remaining gap
    for (let i = 0; i < 3; i++) {
      const remaining = targetCal - calUsed
      if (remaining < 20) break
      if (!addExtra(extras, remaining * 0.5)) break
    }
  }

  return {
    mealTime, shape, targetCal,
    items, totalCal: calUsed,
    withinTier1: calUsed >= tier1Lo && calUsed <= tier1Hi,
    withinTier2: calUsed >= tier2Lo && calUsed <= tier2Hi,
    pairingOk:   pairingOk(items),
    dayDatesUsed: datesNow,
  }
}
