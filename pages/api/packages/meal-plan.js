/**
 * GET /api/packages/meal-plan?userId=xxx&day=N
 * Returns a daily meal plan picked from public.recipes
 * day=0..6 selects different recipes each day of the week
 */
import { supabaseAdmin } from '../../../lib/supabase'

const MEAL_CATEGORY_MAP = {
  'الفطور':      ['فطور', 'أطباق خليجية'],
  'الغداء':      ['أرز ومجبوس', 'دجاج', 'لحم', 'سمك ومأكولات بحرية', 'أطباق خليجية'],
  'وجبة خفيفة': ['حلويات', 'مقبلات', 'سلطة'],
  'العشاء':      ['دجاج', 'لحم', 'سمك ومأكولات بحرية', 'شوربة', 'سلطة', 'أرز ومجبوس'],
}

const MEAL_ORDER = ['الفطور', 'الغداء', 'وجبة خفيفة', 'العشاء']

export default async function handler(req, res) {
  const { userId, day } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })
  const dayOffset = parseInt(day || '0', 10)

  const sb = supabaseAdmin()

  // Fetch profile for tips and protein goal
  const { data: profile } = await sb
    .from('profiles')
    .select('calorie_target, weight_kg, goal, health_conditions, sex')
    .eq('id', userId)
    .single()

  const conditions  = profile?.health_conditions || []
  const isPregnant  = conditions.includes('pregnancy')
  const weight      = profile?.weight_kg || 75
  const proteinTotal = Math.round(weight * 1.6)

  const seed = Math.floor(Date.now() / 86400000) // changes daily
  const plan = []

  for (let mealTimeIdx = 0; mealTimeIdx < MEAL_ORDER.length; mealTimeIdx++) {
    const mealTime      = MEAL_ORDER[mealTimeIdx]
    const mealCategories = MEAL_CATEGORY_MAP[mealTime]
    const categoryToUse  = mealCategories[
      (seed + mealTimeIdx + dayOffset) % mealCategories.length
    ]

    const { data: candidates } = await sb
      .from('recipes')
      .select('id, name, category, calories, protein_g, carbs_g, fat_g, image_url, servings')
      .eq('category', categoryToUse)
      .not('calories', 'is', null)
      .gt('calories', 0)
      .order('id')

    if (!candidates?.length) continue

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
      protein_g:  recipe.protein_g  || 0,
      carbs_g:    recipe.carbs_g    || 0,
      fat_g:      recipe.fat_g      || 0,
    })
  }

  // Total calories = sum of selected recipes
  const total_calories = plan.reduce((sum, item) => sum + (item.actual_calories || 0), 0)

  // Canonical meal order: الفطور → الغداء → وجبة خفيفة → العشاء
  plan.sort((a, b) => MEAL_ORDER.indexOf(a.meal_time) - MEAL_ORDER.indexOf(b.meal_time))

  // Tip based on goal — overridden by health conditions when present
  const tips = {
    weight:  'ركّز على البروتين في كل وجبة — يساعد على الشبع وحفظ العضل مع الحمية',
    muscle:  'تأكد من الكمية الكافية من السعرات لدعم بناء العضل — خصوصاً بعد التمرين',
    general: 'الأكل المتوازن من مطبخك الخليجي هو أفضل حمية — التزم بالكميات',
  }
  let tip = tips[profile?.goal || 'general']
  if (isPregnant)
    tip = 'أثناء الحمل ركّزي على البروتين والحديد وحمض الفوليك. تجنبي الأسماك النيئة والتونة بكميات كبيرة. استشيري طبيبك دائماً قبل أي تغيير غذائي.'
  else if (conditions.includes('heart'))
    tip = 'ركّز على الدهون الصحية (زيت الزيتون، المكسرات) وتجنب الصوديوم العالي والمقليات — نظام البحر الأبيض المتوسط مثالي لصحة القلب.'
  else if (conditions.includes('hypertension'))
    tip = 'قلل الملح والمواد المصنّعة. أكثر من الخضار والبوتاسيوم (موز، أفوكادو). تجنب الأكل الجاهز والمخللات.'
  else if (conditions.includes('asthma'))
    tip = 'تجنب الأكل الثقيل قبل التمرين بأقل من ساعتين. الأطعمة المضادة للالتهاب كالزنجبيل والكركم مفيدة.'

  return res.json({
    date:           new Date().toISOString().split('T')[0],
    total_calories,
    total_protein:  proteinTotal,
    plan,
    tip,
  })
}
