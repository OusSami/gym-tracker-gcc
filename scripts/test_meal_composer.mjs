/**
 * test_meal_composer.mjs — Phase 2 dry-run
 *
 * Standalone multi-item slot composition. Does NOT touch the live generator.
 * Run: node scripts/test_meal_composer.mjs
 *
 * Rules implemented:
 *   - Calorie bands: Tier 1 ±30%, Tier 2 ±50% (mirrors live generator)
 *   - Gap-driven item selection; extras fill leftover after main dish
 *   - Variety tiebreaker: prefer items not in simulated "last 3 days" set
 *   - recipe_type='component' excluded
 *   - تمر rule: quantity ∈ {1,3,5,7}, day-total ≤ 7
 *   - Pairing heuristic: no western+asian combo in same slot
 */

import fs from 'node:fs'
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

// ── Constants (mirrored from live generator) ──────────────────────────────────
const MEAL_STRUCTURE = [
  { time: 'الفطور',      pct: 0.25, required: true,  cats: ['فطور'] },
  { time: 'الغداء',      pct: 0.35, required: true,  cats: ['أرز ومجبوس','دجاج','لحم','سمك ومأكولات بحرية','أطباق خليجية'] },
  { time: 'وجبة خفيفة', pct: 0.15, required: false, cats: ['حلويات','مقبلات','سلطة','مشروبات'] },
  { time: 'العشاء',      pct: 0.25, required: true,  cats: ['دجاج','لحم','سمك ومأكولات بحرية','شوربة','سلطة','أرز ومجبوس'] },
]

// Shape distribution per slot — varied so each slot has a different mix
// Shapes: solo_dish | dish_extra | dish_2extra | solo_extra | multi_extra
const SLOT_SHAPES = {
  'الفطور':      ['solo_dish','solo_dish','dish_extra','dish_extra','dish_extra','dish_2extra'],
  'الغداء':      ['solo_dish','solo_dish','solo_dish','dish_extra','dish_extra','solo_dish'],
  'وجبة خفيفة': ['solo_extra','solo_extra','multi_extra','dish_extra','solo_dish','multi_extra'],
  'العشاء':      ['solo_dish','solo_dish','dish_extra','dish_extra','dish_2extra','solo_dish'],
}

const PORTION_STEPS = [0.5, 0.75, 1.0]

// ── Seeded RNG (LCG) — reproducible per test, varies per slot ────────────────
function makeRng(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s = Math.imul(s, 1664525) + 1013904223
    return (s >>> 0) / 0x100000000
  }
}

// ── Cuisine classifier ────────────────────────────────────────────────────────
const GULF_KW   = ['مجبوس','كبسة','مندي','مطبق','هريس','عريكة','مدفون','مضبي','قرصان',
                   'حنيذ','هنيذ','مطازيز','مضروبة','اليغمش','الغوزي','مرقوق','جريش',
                   'عصيد','كيشة','مكبوس','بخاري','البكيلة','حمسة','الكمونية','المعدس',
                   'مموش','مطبق','معبوج','القشد','الهريس','المثلوثة','الدقوس']
const WEST_KW   = ['باستا','بيتزا','برجر','ريزوتو','لازانيا','سباغيتي','ستيك','بيستو',
                   'سكونز','بروشكيتا','مونتي كريستو','هاش براون','بف باستري','ترياكي',
                   'ويني','شيزكيك','كريم كراميل','تيراميسو','تراميسو','بانكيك']
const ASIAN_KW  = ['سوشي','رامن','دامبلينج','ويك','تمبورا','باد تاي','كاري الخضار','كاري دجاج']

function cuisineOf(r) {
  const n = r.name || ''
  const c = r.category || ''
  if (c === 'أطباق خليجية' || c === 'أرز ومجبوس') return 'gulf_arab'
  if (GULF_KW.some(k => n.includes(k))) return 'gulf_arab'
  if (WEST_KW.some(k => n.includes(k))) return 'western'
  if (ASIAN_KW.some(k => n.includes(k))) return 'asian'
  return 'neutral'  // most Arab/Levantine dishes
}

// Incompatible: western + asian in same slot
function pairingOk(items) {
  const cs = new Set(items.filter(i => i.type === 'dish').map(i => cuisineOf(i.recipe)))
  return !(cs.has('western') && cs.has('asian'))
}

// ── Portion fitting ───────────────────────────────────────────────────────────
function bestPortion(dishCal, targetCal) {
  let best = 1.0, bestDiff = Infinity
  for (const p of PORTION_STEPS) {
    const cal = dishCal * p
    if (cal / targetCal > 1.55) continue  // too far over Tier 2
    const diff = Math.abs(cal - targetCal)
    if (diff < bestDiff) { bestDiff = diff; best = p }
  }
  return best
}

function portionLabel(p) {
  if (p === 0.50) return 'نصف الحصة'
  if (p === 0.75) return '¾ الحصة'
  return 'حصة كاملة'
}

// ── Extra unit fitting ────────────────────────────────────────────────────────
// تمر: quantity ∈ {1,3,5,7} and day-total ≤ 7
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
  // Non-date extras: 1 or 2 units; prefer whichever is closer to remaining gap
  const diff1 = Math.abs(perUnit - remainingCal)
  const diff2 = Math.abs(perUnit * 2 - remainingCal)
  if (diff2 < diff1 && perUnit * 2 <= remainingCal * 1.5) return 2
  return 1
}

// ── Core: compose one slot ────────────────────────────────────────────────────
function composeSlot({ mealTime, targetCal, dishes, extras, recentIds, dayDatesUsed, seed }) {
  const rng = makeRng(seed)
  const tier1Lo = Math.round(targetCal * 0.70)
  const tier1Hi = Math.round(targetCal * 1.30)
  const tier2Lo = Math.round(targetCal * 0.50)
  const tier2Hi = Math.round(targetCal * 1.50)

  const slot = MEAL_STRUCTURE.find(m => m.time === mealTime)
  const slotCats = slot?.cats || []

  // Slot-eligible dishes (correct categories, exclude components)
  const eligible = dishes.filter(d => slotCats.includes(d.category) && d.calories > 0)

  // Gap-driven sort: prefer not-recent, then closest calorie fit at best portion
  function sortDishes(pool, tgt) {
    return [...pool].sort((a, b) => {
      const aNew = recentIds.has(a.id) ? 1 : 0
      const bNew = recentIds.has(b.id) ? 1 : 0
      if (aNew !== bNew) return aNew - bNew
      const aBest = Math.min(...PORTION_STEPS.map(p => Math.abs(a.calories * p - tgt)))
      const bBest = Math.min(...PORTION_STEPS.map(p => Math.abs(b.calories * p - tgt)))
      return aBest - bBest
    })
  }

  // Pick from top N candidates with seeded randomness (variety without pure random)
  function pickFrom(pool, n = 5) {
    const top = pool.slice(0, Math.min(n, pool.length))
    if (!top.length) return null
    return top[Math.floor(rng() * top.length)]
  }

  // Pick shape
  const shapes = SLOT_SHAPES[mealTime] || ['solo_dish', 'dish_extra']
  const shape  = shapes[Math.floor(rng() * shapes.length)]

  const items = []
  let calUsed = 0
  let datesNow = dayDatesUsed

  const addExtra = (pool, remainCal) => {
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

  // ── Shape execution ───────────────────────────────────────────────────────
  if (['solo_dish', 'dish_extra', 'dish_2extra'].includes(shape)) {
    const dishTarget = (shape === 'solo_dish') ? targetCal : Math.round(targetCal * 0.75)

    // Tier 1 → Tier 2 → any fallback (same as live generator logic)
    let pool = sortDishes(eligible.filter(d => {
      const best = Math.min(...PORTION_STEPS.map(p => d.calories * p))
      const worst = Math.max(...PORTION_STEPS.map(p => d.calories * p))
      return worst >= tier1Lo && best <= tier1Hi
    }), dishTarget)
    if (!pool.length) pool = sortDishes(eligible.filter(d => {
      const best  = Math.min(...PORTION_STEPS.map(p => d.calories * p))
      const worst = Math.max(...PORTION_STEPS.map(p => d.calories * p))
      return worst >= tier2Lo && best <= tier2Hi
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
    // Single extra closest to targetCal
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
      const added = addExtra(extras, remaining * 0.5)
      if (!added) break
    }
  }

  const pOk = pairingOk(items)
  const pairingNote = pOk ? null : flagPairingIssue(items)

  return {
    mealTime, shape, targetCal,
    items, totalCal: calUsed,
    withinTier1: calUsed >= tier1Lo && calUsed <= tier1Hi,
    withinTier2: calUsed >= tier2Lo && calUsed <= tier2Hi,
    pairingOk: pOk, pairingNote,
    dayDatesUsed: datesNow,
  }
}

function flagPairingIssue(items) {
  const cs = items.filter(i => i.type === 'dish').map(i => ({
    name: i.recipe.name, cuisine: cuisineOf(i.recipe)
  }))
  return `⚠️  Incompatible pairing: ${cs.map(c => `"${c.name}" (${c.cuisine})`).join(' + ')}`
}

// ── Full day composition ──────────────────────────────────────────────────────
function composeDay({ label, dailyCal, simulatedRecentIds, dayOffset = 0 }) {
  // dishes / extras are passed in from loadData() — see main()
  return { label, dailyCal, simulatedRecentIds, dayOffset }  // placeholder; filled in main()
}

// ── Data loader ───────────────────────────────────────────────────────────────
async function loadData() {
  const FIELDS = 'id, name, category, recipe_type, extra_type, calories, protein_g, carbs_g, fat_g, fiber_g, servings'
  const { data: dishes } = await sb.from('recipes').select(FIELDS)
    .or('recipe_type.is.null,recipe_type.eq.dish')
    .not('calories', 'is', null).gt('calories', 0)
  const { data: extras } = await sb.from('recipes').select(FIELDS)
    .eq('recipe_type', 'extra')
    .not('calories', 'is', null).gt('calories', 0)
  return { dishes: dishes || [], extras: extras || [] }
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function renderSlot(result) {
  if (!result) { console.log('  ❌ No result (fallback needed)'); return }

  const { mealTime, shape, targetCal, items, totalCal, withinTier1, withinTier2, pairingOk, pairingNote, dayDatesUsed } = result
  const pct   = Math.round((totalCal / targetCal) * 100)
  const band  = withinTier1 ? '✓ Tier1 ±30%' : withinTier2 ? '~ Tier2 ±50%' : '✗ outside bands'

  console.log(`\n  ┌─ ${mealTime}  [shape: ${shape}]`)
  console.log(`  │  Target: ${targetCal} kcal`)
  for (const item of items) {
    if (item.type === 'dish') {
      const cuis = cuisineOf(item.recipe)
      console.log(`  │  • [dish/${cuis}] ${item.recipe.name}`)
      console.log(`  │      ${portionLabel(item.portion)} — ${item.calories} kcal`)
    } else {
      const u = item.units === 1 ? '' : ` × ${item.units}`
      console.log(`  │  • [extra/${item.recipe.extra_type}] ${item.recipe.name}${u} — ${item.calories} kcal`)
    }
  }
  console.log(`  │  ─────────────────────────────────────`)
  console.log(`  │  Total: ${totalCal} kcal (${pct}% of target) — ${band}`)
  console.log(`  │  Pairing: ${pairingOk ? '✓' : pairingNote}`)
  console.log(`  └─ تمر today so far: ${dayDatesUsed}/7`)
}

// ── Main: run 4 test profiles ─────────────────────────────────────────────────
const { dishes, extras } = await loadData()
console.log(`Loaded ${dishes.length} dishes, ${extras.length} extras\n`)

const PROFILES = [
  {
    label:   'Profile A — Male 75kg, muscle goal, 2800 kcal/day',
    dailyCal: 2800,
    seed0:    42,
    // Simulate a few recently used IDs (first 4 dish IDs in DB)
    recentIds: new Set(dishes.slice(0, 4).map(d => d.id)),
  },
  {
    label:   'Profile B — Female 60kg, weight loss, 1500 kcal/day',
    dailyCal: 1500,
    seed0:    77,
    recentIds: new Set(dishes.slice(10, 14).map(d => d.id)),
  },
  {
    label:   'Profile C — Male 90kg, endurance, 3200 kcal/day',
    dailyCal: 3200,
    seed0:    113,
    recentIds: new Set(dishes.slice(5, 9).map(d => d.id)),
  },
  {
    label:   'Profile D — Female 55kg, general, 1800 kcal/day',
    dailyCal: 1800,
    seed0:    200,
    recentIds: new Set(dishes.slice(20, 24).map(d => d.id)),
  },
]

for (const profile of PROFILES) {
  console.log('\n' + '═'.repeat(70))
  console.log(profile.label)
  console.log(`Daily goal: ${profile.dailyCal} kcal`)
  console.log('═'.repeat(70))

  let dayDates = 0
  let slotIdx  = 0
  const planItems = []   // for day-total summary

  for (const slot of MEAL_STRUCTURE) {
    const targetCal = Math.round(profile.dailyCal * slot.pct)
    const result    = composeSlot({
      mealTime:     slot.time,
      targetCal,
      dishes,
      extras,
      recentIds:    profile.recentIds,
      dayDatesUsed: dayDates,
      seed:         profile.seed0 + slotIdx * 17,
    })
    renderSlot(result)
    if (result) {
      dayDates = result.dayDatesUsed
      planItems.push(result)
    }
    slotIdx++
  }

  // Day summary
  const dayTotal  = planItems.reduce((s, r) => s + r.totalCal, 0)
  const pairingFails = planItems.filter(r => !r.pairingOk)
  console.log(`\n  ── Day summary ───────────────────────────────────────────`)
  console.log(`  Total day calories : ${dayTotal} kcal (goal: ${profile.dailyCal})`)
  console.log(`  تمر total today    : ${dayDates}/7 ${dayDates <= 7 ? '✓' : '✗ EXCEEDS LIMIT'}`)
  console.log(`  Pairing issues     : ${pairingFails.length === 0 ? 'none ✓' : pairingFails.map(r => r.mealTime).join(', ')}`)
  console.log(`  Slots in Tier 1    : ${planItems.filter(r => r.withinTier1).length}/${planItems.length}`)
  console.log(`  Slots in Tier 2    : ${planItems.filter(r => r.withinTier2 && !r.withinTier1).length}/${planItems.length}`)
  console.log(`  Slots outside bands: ${planItems.filter(r => !r.withinTier2).length}/${planItems.length}`)
}

// ── Pairing heuristic crudeness flags ─────────────────────────────────────────
console.log('\n' + '═'.repeat(70))
console.log('PAIRING HEURISTIC — KNOWN CRUDE CASES')
console.log('═'.repeat(70))
console.log(`
  1. Two Western dishes in the same slot are allowed (e.g. pasta + risotto).
     Sub-typing Western cuisine (Italian vs. French vs. American) is not
     implemented — would need a cuisine_subtype column or keyword expansion.

  2. "neutral" covers all Levantine/Egyptian/Iraqi dishes. A neutral + western
     combo (e.g. فول + هاش براون) is allowed and is probably fine culturally
     since both are breakfast staples, but the heuristic can't distinguish
     "breakfast-neutral" from "dinner-neutral" dishes.

  3. Indian curry (كاري) is tagged 'asian' via the ASIAN_KW list. But كاري is
     common in Gulf cuisine contexts (Emirati/Kuwaiti) and often pairs fine with
     Gulf rice dishes. This could produce false-positive pairing rejections if a
     كاري dish ends up with a Gulf tag because it's in أطباق خليجية — though the
     category-first classification mitigates this.

  4. Two dishes both tagged 'neutral' from very different cuisines (e.g. Moroccan
     كسكس + Iraqi دولمة) are allowed. These are often culturally compatible at an
     Arab dining table, but could occasionally feel mismatched.

  Recommendation for v2: add cuisine_tag TEXT column to recipes
  (gulf | arab | levantine | maghrebi | western | asian | universal)
  and replace keyword heuristic with a data-driven rule.
`)
