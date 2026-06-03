/**
 * GET /api/packages/meal-plan?userId=xxx
 * Returns culturally appropriate GCC daily meal plan
 * Breakfast = Arabic breakfast foods only
 * Lunch = main meal (rice dishes, proteins)
 * Dinner = light evening meal
 * Snack = dates, nuts, fruits
 */
import { supabaseAdmin } from '../../../lib/supabase'

// Culturally appropriate categories per meal time
const MEAL_STRUCTURE = {
  'الفطور': {
    weight: 0.25,
    categories: ['فطور', 'بيض', 'بقوليات'],
    keywords: ['بيض', 'فول', 'حمص', 'جبنة', 'لبن', 'خبز', 'تمر', 'عسل', 'زيتون'],
    fallbackNames: ['بيض مسلوق مع خبز', 'فول بالزيت والليمون', 'جبنة بيضاء مع خبز', 'لبن مع تمر'],
    fallbackCals: [320, 380, 290, 200],
  },
  'الغداء': {
    weight: 0.40,
    categories: ['أطباق رئيسية', 'بروتين', 'أرز', 'دجاج', 'لحم'],
    keywords: ['كبسة', 'مندي', 'دجاج', 'لحم', 'أرز', 'سمك', 'مرق'],
    fallbackNames: ['كبسة دجاج', 'مندي لحم مع رز', 'دجاج مشوي مع رز بسمتي', 'سمك مشوي مع خضار'],
    fallbackCals: [650, 720, 580, 480],
  },
  'وجبة خفيفة': {
    weight: 0.10,
    categories: ['فواكه', 'مكسرات', 'وجبات خفيفة'],
    keywords: ['تمر', 'مكسرات', 'فاكهة', 'موز', 'تفاح', 'لوز'],
    fallbackNames: ['تمر مجدول (3 حبات)', 'مكسرات مشكلة', 'تفاحة مع لوز', 'موزة مع لبن'],
    fallbackCals: [120, 150, 130, 140],
  },
  'العشاء': {
    weight: 0.25,
    categories: ['شوربة', 'خفيف', 'بروتين', 'خضار'],
    keywords: ['شوربة', 'سلطة', 'خضار', 'دجاج خفيف', 'تونة', 'لبن'],
    fallbackNames: ['شوربة عدس', 'سلطة دجاج مشوي', 'بيض مع خضار مشوية', 'تونة مع خبز أسمر'],
    fallbackCals: [280, 320, 290, 260],
  },
}

// Protein per meal (rough guide)
const PROTEIN_DIST = { 'الفطور': 0.20, 'الغداء': 0.40, 'وجبة خفيفة': 0.05, 'العشاء': 0.35 }

export default async function handler(req, res) {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const sb = supabaseAdmin()

  // Get user data
  const { data: profile } = await sb
    .from('profiles')
    .select('calorie_target, weight_kg, goal, health_conditions, sex')
    .eq('id', userId)
    .single()

  const baseCals  = profile?.calorie_target || 1800
  // Gradual deficit: Week 1 = maintenance, Week 2 = -150, Week 3+ = -300
  const { data: prog } = await sb.from('user_programs')
    .select('current_day').eq('user_id', userId).eq('status','active').single()
  const weekNum = prog?.current_day ? Math.ceil(prog.current_day / 7) : 1
  const deficit = weekNum === 1 ? 0 : weekNum === 2 ? 150 : 300
  const totalCals = Math.max(1200, baseCals - deficit)
  const weight       = profile?.weight_kg || 75
  const proteinTotal = Math.round(weight * 1.6)
  const conditions   = profile?.health_conditions || []

  const plan = []
  const seed = Math.floor(Date.now() / 86400000) // changes daily

  for (const [mealTime, config] of Object.entries(MEAL_STRUCTURE)) {
    const targetCals = Math.round(totalCals * config.weight)
    const targetProtein = Math.round(proteinTotal * PROTEIN_DIST[mealTime])

    // Try to find a food from the GCC database matching this meal's categories
    let found = null
    for (const cat of config.categories) {
      const { data: foods } = await sb
        .from('gcc_foods')
        .select('id,name_ar,name_en,calories,protein_g,carbs_g,fat_g,serving_desc_ar,serving_size_g,category')
        .ilike('category', '%' + cat + '%')
        .gte('calories', targetCals * 0.5)
        .lte('calories', targetCals * 1.5)
        .limit(15)

      if (foods?.length) {
        // Pick by daily seed for variety
        const idx = (seed + plan.length * 7 + Object.keys(MEAL_STRUCTURE).indexOf(mealTime)) % foods.length

        // Apply health filters
        let candidates = foods
        if (conditions.includes('diabetes'))    candidates = foods.filter(f => (f.carbs_g || 0) <= 40)
        if (conditions.includes('cholesterol')) candidates = foods.filter(f => (f.fat_g || 0) <= 10)
        if (conditions.includes('hypertension')) candidates = foods.filter(f => !f.name_ar?.includes('مملح'))
        if (!candidates.length) candidates = foods

        found = candidates[idx % candidates.length]
        break
      }
    }

    if (found) {
      // Adjust portion to hit calorie target
      const mult = Math.round((targetCals / found.calories) * 10) / 10
      const portionG = Math.round((found.serving_size_g || 200) * mult)

      plan.push({
        meal_time: mealTime,
        food: {
          ...found,
          portion_desc: portionG > 300 ? portionG + 'g (حصة كبيرة)' : portionG > 150 ? portionG + 'g' : portionG + 'g (حصة صغيرة)',
        },
        target_calories: targetCals,
        actual_calories: Math.round(found.calories * mult),
        protein_g: Math.round((found.protein_g || 0) * mult),
        carbs_g:   Math.round((found.carbs_g   || 0) * mult),
        fat_g:     Math.round((found.fat_g     || 0) * mult),
      })
    } else {
      // Cultural fallback — always appropriate per meal time
      const idx = seed % config.fallbackNames.length
      const fbCals = config.fallbackCals[idx]
      const mult = targetCals / fbCals

      plan.push({
        meal_time: mealTime,
        food: {
          name_ar: config.fallbackNames[idx],
          calories: fbCals,
          portion_desc: 'حصة عادية',
          category: config.categories[0],
        },
        target_calories: targetCals,
        actual_calories: Math.round(fbCals * mult),
        protein_g: Math.round(targetProtein),
        carbs_g:   Math.round(targetCals * 0.45 / 4),
        fat_g:     Math.round(targetCals * 0.25 / 9),
      })
    }
  }

  // Tip based on goal
  const tips = {
    weight: 'ركّز على البروتين في كل وجبة — يساعد على الشبع وحفظ العضل مع الحمية',
    muscle: 'تأكد من الكمية الكافية من السعرات لدعم بناء العضل — خصوصاً بعد التمرين',
    general: 'الأكل المتوازن من مطبخك الخليجي هو أفضل حمية — التزم بالكميات',
  }

  return res.json({
    date: new Date().toISOString().split('T')[0],
    total_calories: totalCals,
    total_protein: proteinTotal,
    plan,
    tip: tips[profile?.goal || 'general'],
  })
}
