/**
 * GET /api/packages/meal-plan?userId=xxx&day=N
 * Returns a daily meal plan picked from public.recipes.
 * day=0..6 selects different recipes each day of the week.
 *
 * Calorie targeting: each slot gets a % of the user's daily goal.
 * Required meals (الفطور, الغداء, العشاء) use a full tier fallback so they
 * are NEVER skipped. Only وجبة خفيفة is optional.
 *
 * Each slot may contain 1–3 items (dish + optional extras) via the
 * multi-item composer in lib/mealComposer.js. The top-level `food` field
 * is kept for backward compatibility; `items[]` carries the full breakdown.
 */
import { supabaseAdmin }     from '../../../lib/supabase'
import { calcNutrientGoals } from '../../../lib/nutrition'
import {
  MEAL_STRUCTURE,
  composeSlot,
  portionLabel,
} from '../../../lib/mealComposer'

const GOAL_MAP = {
  weight:    'weight_loss',
  muscle:    'muscle',
  strength:  'strength',
  endurance: 'endurance',
  general:   'general',
}

const RECIPE_FIELDS = 'id, name, category, recipe_type, extra_type, calories, protein_g, carbs_g, fat_g, image_url, servings'
const MEAL_ORDER    = MEAL_STRUCTURE.map(m => m.time)

function macroVal(val, scale) {
  return Math.round((val || 0) * scale * 10) / 10
}

function buildItemEntry(item) {
  const r     = item.recipe
  const scale = item.type === 'dish' ? (item.portion || 1) : (item.units || 1)
  const desc  = item.type === 'dish'
    ? portionLabel(item.portion)
    : item.units > 1
      ? `${r.servings || 'حصة'} × ${item.units}`
      : (r.servings || 'حصة')
  return {
    type:         item.type,
    name_ar:      r.name,
    calories:     item.calories,
    protein_g:    macroVal(r.protein_g, scale),
    carbs_g:      macroVal(r.carbs_g,   scale),
    fat_g:        macroVal(r.fat_g,     scale),
    image_url:    r.image_url  || null,
    portion:      item.type === 'dish'  ? (item.portion || 1)  : null,
    portion_desc: desc,
    units:        item.type === 'extra' ? (item.units || 1)    : null,
    extra_type:   r.extra_type || null,
    category:     r.category,
    recipe_id:    r.id,
  }
}

function buildSlotEntry(mealTime, result, targetCal) {
  const items    = result.items.map(buildItemEntry)
  const primary  = items.find(i => i.type === 'dish') || items[0]
  const totalP   = Math.round(items.reduce((s, i) => s + i.protein_g, 0) * 10) / 10
  const totalC   = Math.round(items.reduce((s, i) => s + i.carbs_g,   0) * 10) / 10
  const totalF   = Math.round(items.reduce((s, i) => s + i.fat_g,     0) * 10) / 10

  return {
    meal_time: mealTime,
    // v1-compatible primary food entry (calories reflects slot total)
    food: primary ? {
      name_ar:      primary.name_ar,
      calories:     result.totalCal,
      protein_g:    totalP,
      carbs_g:      totalC,
      fat_g:        totalF,
      image_url:    primary.image_url,
      portion_desc: primary.portion_desc,
      category:     primary.category,
      recipe_id:    primary.recipe_id,
    } : null,
    actual_calories: result.totalCal,
    target_calories: targetCal,
    protein_g:       totalP,
    carbs_g:         totalC,
    fat_g:           totalF,
    // per-item breakdown
    items,
    shape: result.shape,
  }
}

export default async function handler(req, res) {
  const { userId, day } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })
  const dayOffset = parseInt(day || '0', 10)

  const sb = supabaseAdmin()

  const { data: profile } = await sb
    .from('profiles')
    .select('calorie_target, weight_kg, height_cm, birthday, fitness_level, goal, sex, unit_system, health_conditions')
    .eq('id', userId)
    .single()

  const conditions   = profile?.health_conditions || []
  const isPregnant   = conditions.includes('pregnancy')
  const weight       = profile?.weight_kg || 75
  const proteinTotal = Math.round(weight * 1.6)

  let dailyGoal = profile?.calorie_target
  if (!dailyGoal || dailyGoal <= 0) {
    const mapped = { ...profile, goal: GOAL_MAP[profile?.goal] || 'general' }
    dailyGoal = calcNutrientGoals(mapped).calories
  }
  dailyGoal = dailyGoal || 2000

  const target_breakdown = {
    'فطور':  Math.round(dailyGoal * 0.25),
    'غداء':  Math.round(dailyGoal * 0.35),
    'خفيفة': Math.round(dailyGoal * 0.15),
    'عشاء':  Math.round(dailyGoal * 0.25),
  }

  // 2 queries upfront (vs up-to-20 per request in the previous version)
  const [{ data: dishData }, { data: extraData }] = await Promise.all([
    sb.from('recipes').select(RECIPE_FIELDS)
      .or('recipe_type.is.null,recipe_type.eq.dish')
      .not('calories', 'is', null).gt('calories', 0),
    sb.from('recipes').select(RECIPE_FIELDS)
      .eq('recipe_type', 'extra')
      .not('calories', 'is', null).gt('calories', 0),
  ])
  const dishes = dishData || []
  const extras = extraData || []

  const seed       = Math.floor(Date.now() / 86400000)
  const recentIds  = new Set()
  const plan       = []
  let dayDatesUsed = 0

  for (let mealIdx = 0; mealIdx < MEAL_STRUCTURE.length; mealIdx++) {
    const { time: mealTime, pct, required } = MEAL_STRUCTURE[mealIdx]
    const targetCal = Math.round(dailyGoal * pct)

    const result = composeSlot({
      mealTime,
      targetCal,
      dishes,
      extras,
      recentIds,
      dayDatesUsed,
      seed: seed + mealIdx * 17 + dayOffset * 13,
    })

    if (!result || !result.items.length) {
      if (!required) continue
      console.error(`[meal-plan] WARN: no result for required slot ${mealTime}`)
      continue
    }

    dayDatesUsed = result.dayDatesUsed
    plan.push(buildSlotEntry(mealTime, result, targetCal))
  }

  // Emergency fallback for missing required meals
  const presentMeals = new Set(plan.map(p => p.meal_time))
  for (const { time: required, pct } of MEAL_STRUCTURE.filter(m => m.required)) {
    if (presentMeals.has(required)) continue
    console.error(`[meal-plan] EMERGENCY: required meal ${required} missing`)
    const { data: emergency } = await sb
      .from('recipes').select(RECIPE_FIELDS)
      .not('calories', 'is', null).gt('calories', 0)
      .or('recipe_type.is.null,recipe_type.eq.dish')
      .limit(10)
    if (emergency?.length) {
      const pick      = emergency[seed % emergency.length]
      const targetCal = Math.round(dailyGoal * pct)
      plan.push(buildSlotEntry(required, {
        items:    [{ type: 'dish', recipe: pick, portion: 1.0, calories: pick.calories }],
        totalCal: pick.calories,
        shape:    'solo_dish',
      }, targetCal))
    }
  }

  plan.sort((a, b) => MEAL_ORDER.indexOf(a.meal_time) - MEAL_ORDER.indexOf(b.meal_time))

  const total_calories = plan.reduce((sum, p) => sum + (p.actual_calories || 0), 0)

  console.log('[meal-plan] Plan meals:', plan.map(p => p.meal_time))

  const tips = {
    weight:    'ركّز على البروتين في كل وجبة — يساعد على الشبع وحفظ العضل مع الحمية',
    muscle:    'تأكد من الكمية الكافية من السعرات لدعم بناء العضل — خصوصاً بعد التمرين',
    general:   'الأكل المتوازن من مطبخك الخليجي هو أفضل حمية — التزم بالكميات',
    strength:  'السعرات الكافية مع البروتين العالي تدعم مكاسب القوة وتسريع التعافي',
    endurance: 'الكربوهيدرات وقود التحمّل — لا تقلل منها في أيام التمرين الطويل',
  }
  let tip = tips[profile?.goal || 'general'] || tips.general
  if (isPregnant)
    tip = 'أثناء الحمل ركّزي على البروتين والحديد وحمض الفوليك. تجنبي الأسماك النيئة والتونة بكميات كبيرة. استشيري طبيبك دائماً قبل أي تغيير غذائي.'
  else if (conditions.includes('heart'))
    tip = 'ركّز على الدهون الصحية (زيت الزيتون، المكسرات) وتجنب الصوديوم العالي والمقليات — نظام البحر الأبيض المتوسط مثالي لصحة القلب.'
  else if (conditions.includes('hypertension'))
    tip = 'قلل الملح والمواد المصنّعة. أكثر من الخضار والبوتاسيوم (موز، أفوكادو). تجنب الأكل الجاهز والمخللات.'
  else if (conditions.includes('asthma'))
    tip = 'تجنب الأكل الثقيل قبل التمرين بأقل من ساعتين. الأطعمة المضادة للالتهاب كالزنجبيل والكركم مفيدة.'

  return res.json({
    date:             new Date().toISOString().split('T')[0],
    daily_goal:       dailyGoal,
    target_breakdown,
    total_calories,
    total_protein:    proteinTotal,
    plan,
    tip,
  })
}
