/**
 * GET /api/packages/meal-plan?userId=xxx&day=N
 * Returns a daily meal plan picked from public.recipes.
 * day=0..6 selects different recipes each day of the week.
 *
 * Calorie targeting: each slot gets a % of the user's daily goal.
 * Required meals (الفطور, الغداء, العشاء) use a 5-tier fallback so they
 * are NEVER skipped. Only وجبة خفيفة is optional.
 */
import { supabaseAdmin }     from '../../../lib/supabase'
import { calcNutrientGoals } from '../../../lib/nutrition'

// ── Meal structure ────────────────────────────────────────────────────────────
const MEAL_STRUCTURE = [
  {
    time:       'الفطور',
    pct:        0.25,
    required:   true,
    categories: ['فطور'],
  },
  {
    time:       'الغداء',
    pct:        0.35,
    required:   true,
    categories: ['أرز ومجبوس', 'دجاج', 'لحم', 'سمك ومأكولات بحرية', 'أطباق خليجية'],
  },
  {
    time:       'وجبة خفيفة',
    pct:        0.15,
    required:   false,
    categories: ['حلويات', 'مقبلات', 'سلطة', 'مشروبات'],
  },
  {
    time:       'العشاء',
    pct:        0.25,
    required:   true,
    categories: ['دجاج', 'لحم', 'سمك ومأكولات بحرية', 'شوربة', 'سلطة', 'أرز ومجبوس'],
  },
]

const MEAL_ORDER = MEAL_STRUCTURE.map(m => m.time)

// Profile goal → calcCalorieGoal goal key
const GOAL_MAP = {
  weight:    'weight_loss',
  muscle:    'muscle',
  strength:  'strength',
  endurance: 'endurance',
  general:   'general',
}

const RECIPE_FIELDS = 'id, name, category, calories, protein_g, carbs_g, fat_g, image_url, servings'

// categories can be a string or array; minCal/maxCal are optional
async function queryRecipes(sb, categories, minCal, maxCal) {
  const cats = Array.isArray(categories) ? categories : [categories]
  let q = sb.from('recipes').select(RECIPE_FIELDS)
    .in('category', cats)
    .not('calories', 'is', null)
    .gt('calories', 0)
    .or('recipe_type.is.null,recipe_type.eq.dish')
    .order('id')
  if (minCal != null) q = q.gte('calories', minCal)
  if (maxCal != null) q = q.lte('calories', maxCal)
  const { data } = await q
  return data || []
}

function buildMealEntry(mealTime, recipe, targetCal) {
  return {
    meal_time: mealTime,
    food: {
      name_ar:      recipe.name,
      calories:     recipe.calories,
      protein_g:    recipe.protein_g  || 0,
      carbs_g:      recipe.carbs_g    || 0,
      fat_g:        recipe.fat_g      || 0,
      image_url:    recipe.image_url  || null,
      portion_desc: recipe.servings   || 'حصة واحدة',
      category:     recipe.category,
      recipe_id:    recipe.id,
    },
    actual_calories: recipe.calories,
    target_calories: targetCal,
    protein_g:  recipe.protein_g  || 0,
    carbs_g:    recipe.carbs_g    || 0,
    fat_g:      recipe.fat_g      || 0,
  }
}

export default async function handler(req, res) {
  const { userId, day } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })
  const dayOffset = parseInt(day || '0', 10)

  const sb = supabaseAdmin()

  // Full profile needed for calcNutrientGoals fallback
  const { data: profile } = await sb
    .from('profiles')
    .select('calorie_target, weight_kg, height_cm, birthday, fitness_level, goal, sex, unit_system, health_conditions')
    .eq('id', userId)
    .single()

  const conditions   = profile?.health_conditions || []
  const isPregnant   = conditions.includes('pregnancy')
  const weight       = profile?.weight_kg || 75
  const proteinTotal = Math.round(weight * 1.6)

  // Resolve daily calorie goal: stored target → computed via nutrition lib → 2000 default
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

  const seed = Math.floor(Date.now() / 86400000) // changes daily
  const plan = []

  // ── Main loop — 5-tier fallback per slot ─────────────────────────────────
  for (let mealIdx = 0; mealIdx < MEAL_STRUCTURE.length; mealIdx++) {
    const { time: mealTime, pct, required, categories } = MEAL_STRUCTURE[mealIdx]

    const targetCal = Math.round(dailyGoal * pct)
    const min30     = Math.round(targetCal * 0.70)
    const max30     = Math.round(targetCal * 1.30)
    const min50     = Math.round(targetCal * 0.50)
    const max50     = Math.round(targetCal * 1.50)

    // Rotate category by seed+day+meal for variety
    const primaryCat = categories[(seed + mealIdx + dayOffset) % categories.length]

    // Tier 1: ±30% in rotated category
    let candidates = await queryRecipes(sb, primaryCat, min30, max30)
    // Tier 2: ±50% in rotated category
    if (!candidates.length) candidates = await queryRecipes(sb, primaryCat, min50, max50)
    // Tier 3: any calories in rotated category
    if (!candidates.length) candidates = await queryRecipes(sb, primaryCat, null, null)
    // Tier 4: ±50% across all categories for this meal slot
    if (!candidates.length) candidates = await queryRecipes(sb, categories, min50, max50)
    // Tier 5: absolute emergency — any recipe with calories > 0
    if (!candidates.length) {
      const { data: any } = await sb.from('recipes').select(RECIPE_FIELDS)
        .not('calories', 'is', null).gt('calories', 0)
        .or('recipe_type.is.null,recipe_type.eq.dish')
        .limit(50)
      candidates = any || []
    }

    if (!candidates.length) {
      if (!required) continue  // وجبة خفيفة — safe to skip
      // Required meal with zero candidates is unexpected; skip here and catch in validation
      console.error(`[meal-plan] WARN: no candidates for required meal ${mealTime}`)
      continue
    }

    const idx    = (seed + dayOffset * 13 + mealIdx * 7) % candidates.length
    const recipe = candidates[idx]
    plan.push(buildMealEntry(mealTime, recipe, targetCal))
  }

  // ── Validation — ensure all required meals are present ───────────────────
  const presentMeals = new Set(plan.map(p => p.meal_time))
  const requiredMeals = MEAL_STRUCTURE.filter(m => m.required).map(m => m.time)

  for (const required of requiredMeals) {
    if (presentMeals.has(required)) continue

    console.error(`[meal-plan] EMERGENCY: required meal ${required} missing — using fallback`)

    const { data: emergency } = await sb
      .from('recipes')
      .select(RECIPE_FIELDS)
      .not('calories', 'is', null)
      .gt('calories', 0)
      .or('recipe_type.is.null,recipe_type.eq.dish')
      .limit(10)

    if (emergency?.length) {
      const pick       = emergency[(seed + dayOffset) % emergency.length]
      const mealMeta   = MEAL_STRUCTURE.find(m => m.time === required)
      const targetCal  = Math.round(dailyGoal * (mealMeta?.pct || 0.25))
      plan.push(buildMealEntry(required, pick, targetCal))
    }
  }

  // Re-sort after validation
  plan.sort((a, b) => MEAL_ORDER.indexOf(a.meal_time) - MEAL_ORDER.indexOf(b.meal_time))

  const total_calories = plan.reduce((sum, item) => sum + (item.actual_calories || 0), 0)

  console.log('[meal-plan] Plan meals:', plan.map(p => p.meal_time))

  // ── Tip ──────────────────────────────────────────────────────────────────
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
