/**
 * GET /api/packages/meal-plan?userId=xxx&day=N
 * Returns a daily meal plan picked from public.recipes
 * day=0..6 selects different recipes each day of the week.
 *
 * Each meal slot targets a calorie band derived from the user's daily goal:
 *   الفطور      25 %
 *   الغداء      35 %
 *   وجبة خفيفة 15 %
 *   العشاء      25 %
 * Selection widens tolerance (±30 % → ±50 % → any) if no candidates found.
 */
import { supabaseAdmin }     from '../../../lib/supabase'
import { calcNutrientGoals } from '../../../lib/nutrition'

const MEAL_CATEGORY_MAP = {
  'الفطور':      ['فطور', 'أطباق خليجية'],
  'الغداء':      ['أرز ومجبوس', 'دجاج', 'لحم', 'سمك ومأكولات بحرية', 'أطباق خليجية'],
  'وجبة خفيفة': ['حلويات', 'مقبلات', 'سلطة'],
  'العشاء':      ['دجاج', 'لحم', 'سمك ومأكولات بحرية', 'شوربة', 'سلطة', 'أرز ومجبوس'],
}

const MEAL_ORDER = ['الفطور', 'الغداء', 'وجبة خفيفة', 'العشاء']

const MEAL_DISTRIBUTION = {
  'الفطور':      0.25,
  'الغداء':      0.35,
  'وجبة خفيفة': 0.15,
  'العشاء':      0.25,
}

// Profile goal → calcCalorieGoal goal key
const GOAL_MAP = {
  weight:    'weight_loss',
  muscle:    'muscle',
  strength:  'strength',
  endurance: 'endurance',
  general:   'general',
}

const RECIPE_FIELDS = 'id, name, category, calories, protein_g, carbs_g, fat_g, image_url, servings'

async function queryRecipes(sb, category, minCal, maxCal) {
  let q = sb.from('recipes').select(RECIPE_FIELDS).eq('category', category)
    .not('calories', 'is', null).gt('calories', 0).order('id')
  if (minCal != null) q = q.gte('calories', minCal)
  if (maxCal != null) q = q.lte('calories', maxCal)
  const { data } = await q
  return data || []
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

  const conditions  = profile?.health_conditions || []
  const isPregnant  = conditions.includes('pregnancy')
  const weight      = profile?.weight_kg || 75
  const proteinTotal = Math.round(weight * 1.6)

  // Resolve daily calorie goal: stored target → computed via nutrition lib → 2000 default
  let dailyGoal = profile?.calorie_target
  if (!dailyGoal || dailyGoal <= 0) {
    const mapped = { ...profile, goal: GOAL_MAP[profile?.goal] || 'general' }
    dailyGoal = calcNutrientGoals(mapped).calories
  }
  dailyGoal = dailyGoal || 2000

  const target_breakdown = {
    'فطور':   Math.round(dailyGoal * MEAL_DISTRIBUTION['الفطور']),
    'غداء':   Math.round(dailyGoal * MEAL_DISTRIBUTION['الغداء']),
    'خفيفة':  Math.round(dailyGoal * MEAL_DISTRIBUTION['وجبة خفيفة']),
    'عشاء':   Math.round(dailyGoal * MEAL_DISTRIBUTION['العشاء']),
  }

  const seed = Math.floor(Date.now() / 86400000) // changes daily
  const plan = []

  for (let mealTimeIdx = 0; mealTimeIdx < MEAL_ORDER.length; mealTimeIdx++) {
    const mealTime       = MEAL_ORDER[mealTimeIdx]
    const mealCategories = MEAL_CATEGORY_MAP[mealTime]
    const categoryToUse  = mealCategories[
      (seed + mealTimeIdx + dayOffset) % mealCategories.length
    ]

    const targetCal = Math.round(dailyGoal * MEAL_DISTRIBUTION[mealTime])
    const min30     = Math.round(targetCal * 0.70)
    const max30     = Math.round(targetCal * 1.30)
    const min50     = Math.round(targetCal * 0.50)
    const max50     = Math.round(targetCal * 1.50)

    // Try ±30 %, then ±50 %, then any with calories > 0
    let candidates = await queryRecipes(sb, categoryToUse, min30, max30)
    if (!candidates.length) candidates = await queryRecipes(sb, categoryToUse, min50, max50)
    if (!candidates.length) candidates = await queryRecipes(sb, categoryToUse, null, null)
    if (!candidates.length) continue

    const idx    = (seed + dayOffset * 13 + mealTimeIdx * 7) % candidates.length
    const recipe = candidates[idx]

    plan.push({
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
    })
  }

  plan.sort((a, b) => MEAL_ORDER.indexOf(a.meal_time) - MEAL_ORDER.indexOf(b.meal_time))

  const total_calories = plan.reduce((sum, item) => sum + (item.actual_calories || 0), 0)

  // Tip based on goal — overridden by health conditions when present
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
