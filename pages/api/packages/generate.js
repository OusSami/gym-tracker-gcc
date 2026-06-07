/**
 * POST /api/packages/generate
 * Generates a 21/30-day program roadmap LOCALLY (no AI for structure = never fails)
 * AI is only used for names/taglines — daily workouts generated separately per day.
 */
import { supabaseAdmin } from '../../../lib/supabase'
import { logApiUsage } from '../../../lib/logApiUsage'

// Local template generator — never fails, fully deterministic
function buildRoadmap(profile, totalDays) {
  const goal = profile.goal || 'weight'
  const conditions = profile.health_conditions || []
  const isPregnant  = conditions.includes('pregnancy')
  const hasHeart    = conditions.includes('heart') || conditions.includes('hypertension')
  const hasKnee     = conditions.includes('knee_pain')
  const hasBack     = conditions.includes('back_pain')
  const hasShoulder = conditions.includes('shoulder_pain')

  const daysPerWeek = parseInt(profile.days_per_week) || 3
  const sessionMin = parseInt(profile.session_minutes) || 30
  const calorieTarget = parseInt(profile.calorie_target) || 1800
  const proteinTarget = Math.round((parseFloat(profile.weight_kg) || 75) * 1.6)

  const GOALS = {
    weight:  { name:'برنامج حرق الدهون', tagline:'كل يوم خطوة نحو جسمك الجديد', nutrition:'عجز سعرات مع بروتين عالٍ' },
    muscle:  { name:'برنامج بناء العضل',  tagline:'بناء عضل حقيقي بخطة مدروسة',  nutrition:'فائض سعرات مع بروتين عالٍ' },
    general: { name:'برنامج اللياقة',     tagline:'صحة وحيوية في كل يوم',         nutrition:'توازن غذائي مع أكل خليجي صحي' },
  }
  const g = { ...(GOALS[goal] || GOALS.weight) }

  // Override program identity for medical conditions
  if (isPregnant) {
    g.name = 'برنامج اللياقة الآمنة للحمل'
    g.tagline = 'صحتك وصحة طفلك هي الأولوية دائماً'
    g.nutrition = 'تغذية كافية ومتوازنة — لا حمية أثناء الحمل'
  } else if (hasHeart) {
    g.name = 'برنامج اللياقة القلبية'
    g.tagline = 'تمارين معتدلة ومستدامة لقلب صحي'
    g.nutrition = 'نظام غذائي منخفض الصوديوم والدهون المشبعة'
  }

  const weeks = Math.ceil(totalDays / 7)

  // Week themes adapt to medical conditions
  const WEEK_THEMES = isPregnant ? [
    { week:1, theme:'البداية الآمنة',       focus:'تمارين خفيفة تناسب مرحلة الحمل',    intensity:3, key_objective:'راحتك وأمانك فوق كل شيء' },
    { week:2, theme:'الاستمرار بلطف',       focus:'تقوية العضلات بحركات آمنة',          intensity:3, key_objective:'استمعي لجسمك — توقفي فوراً عند أي ألم' },
    { week:3, theme:'التقوية الخفيفة',      focus:'تمارين التنفس والتقوية المعتدلة',    intensity:4, key_objective:'التدرج الآمن والاستمتاع بالحركة' },
    { week:4, theme:'النشاط المريح',        focus:'الحفاظ على اللياقة والراحة المتوازنة', intensity:4, key_objective:'السلامة والاستمرارية مع الراحة الكافية' },
  ] : hasHeart ? [
    { week:1, theme:'بناء الأساس',          focus:'تمارين هوائية خفيفة وتعلم التنفس',   intensity:3, key_objective:'إتمام كل تمرين بدون إجهاد الجهاز القلبي' },
    { week:2, theme:'بناء الزخم',           focus:'زيادة تدريجية في المدة لا الشدة',    intensity:4, key_objective:'الاستمرار — الانتظام أهم من الشدة' },
    { week:3, theme:'تقوية القلب',          focus:'تمارين هوائية مستدامة',               intensity:5, key_objective:'تجاوز حدودك بحذر وأمان' },
    { week:4, theme:'اللياقة المستدامة',    focus:'الحفاظ على المستوى والتعافي الجيد', intensity:5, key_objective:'إتمام البرنامج بصحة وثقة' },
  ] : [
    { week:1, theme:'بناء الأساس',      focus:'تعلم الحركات وبناء العادة',     intensity:4, key_objective:'إتمام كل تمرين بشكل صحيح' },
    { week:2, theme:'بناء الزخم',       focus:'زيادة الحجم والثبات',           intensity:5, key_objective:'الاستمرار بدون انقطاع' },
    { week:3, theme:'رفع الشدة',        focus:'تحديات أكبر ونتائج أوضح',       intensity:6, key_objective:'تجاوز حدودك بأمان' },
    { week:4, theme:'ذروة التحول',      focus:'أقصى جهد والاحتفال بالنتائج',   intensity:7, key_objective:'إتمام البرنامج بقوة' },
  ]

  // Muscle combos avoid problem areas
  const MUSCLE_COMBOS = hasKnee
    ? [['البطن','الجانبين'], ['الصدر والكتفين'], ['الجسم العلوي'], ['البطن','الظهر'], ['الجسم كامل']]
    : hasShoulder
    ? [['البطن','الظهر'], ['الأرجل','المؤخرة'], ['الجانبين','البطن'], ['الجسم السفلي'], ['الجسم كامل']]
    : isPregnant
    ? [['الحمل'], ['الحمل'], ['الحمل'], ['الحمل'], ['الحمل']]
    : [
        ['البطن','الظهر السفلي'],
        ['الأرجل','المؤخرة'],
        ['الصدر','الكتفين'],
        ['البطن','الجانبين'],
        ['الجسم كامل'],
      ]

  // Condition-specific coach tips
  const conditionTips = []
  if (isPregnant) conditionTips.push('استشيري طبيبك قبل ومع أي تمرين خلال الحمل', 'توقفي فوراً عند أي ألم أو دوار أو ضيق')
  if (hasHeart)   conditionTips.push('راقبي نبضك — لا تتجاوزي 70% من أقصى معدل', 'استشر طبيبك عن المستوى المناسب لك')
  if (hasKnee)    conditionTips.push('تجنب الجلوس العميق والقفز', 'ضع كمادة باردة بعد التمرين إذا كان هناك تورم')
  if (hasBack)    conditionTips.push('ركّز على تقوية عضلات البطن لحماية الظهر', 'لا تقم بتمارين الانحناء الحاد')
  if (hasShoulder) conditionTips.push('تجنب رفع الأوزان فوق مستوى الكتف', 'الإحماء الجيد للكتف ضروري قبل كل تمرين')

  const TIPS = [
    'اشرب كوب ماء قبل البداية', 'ركّز على التنفس الصحيح', 'جودة الحركة أهم من السرعة',
    'الراحة بين المجموعات 30-60 ثانية', 'استمع لجسمك وتوقف عند الألم الحاد',
    'الاستمرارية هي المفتاح', 'سجّل وزنك الأسبوع هذا', 'الأكل الصح 70% من النتيجة',
    ...conditionTips,
  ]

  const DAILY_FOCUS = [
    'اليوم اللي يبني العادة', 'استمر — جسمك يتأقلم', 'كل مجموعة تقربك من الهدف',
    'اليوم أصعب — وهذا مقصود', 'جسمك أقوى مما تظن', 'ركز على الأداء الصحيح',
    'الراحة جزء من البرنامج', 'عد وأنت أقوى من أمس', 'اليوم تكتب صفحة جديدة',
  ]

  // Build day-by-day schedule
  const days = []
  let trainDay = 0
  for (let d = 1; d <= totalDays; d++) {
    const weekNum = Math.ceil(d / 7)
    const week = WEEK_THEMES[Math.min(weekNum - 1, WEEK_THEMES.length - 1)]
    const dayOfWeek = ((d - 1) % 7)
    const isTrainDay = dayOfWeek < daysPerWeek
    const comboIdx = trainDay % MUSCLE_COMBOS.length
    const tipIdx = (d - 1) % TIPS.length
    const focusIdx = (d - 1) % DAILY_FOCUS.length

    // Cap intensity and volume for medical conditions
    const maxIntensity = isPregnant ? 4 : hasHeart ? 5 : 10
    const cappedIntensity = Math.min(week.intensity, maxIntensity)
    const baseSets = goal === 'weight' ? 12 + (weekNum * 2) : 10 + (weekNum * 2)
    const cappedSets = isPregnant ? Math.min(baseSets, 12) : hasHeart ? Math.min(baseSets, 14) : baseSets

    if (isTrainDay) {
      trainDay++
      days.push({
        day: d,
        day_type: 'تمرين',
        muscles_focus: MUSCLE_COMBOS[comboIdx],
        session_type: isPregnant ? 'تمرين آمن للحمل' : hasHeart ? 'هوائي معتدل' : goal === 'muscle' ? 'قوة' : goal === 'weight' ? 'حرق دهون' : 'لياقة',
        intensity_target: cappedIntensity,
        sets_target: cappedSets,
        reps_range: isPregnant ? '10-15' : goal === 'muscle' ? '8-12' : '15-20',
        estimated_duration_min: isPregnant ? Math.min(sessionMin, 30) : sessionMin,
        calorie_target: calorieTarget,
        protein_target_g: proteinTarget,
        daily_focus: DAILY_FOCUS[focusIdx],
        coach_tip: TIPS[tipIdx],
      })
    } else {
      days.push({
        day: d,
        day_type: d % 7 === 6 ? 'نشاط خفيف' : 'راحة',
        muscles_focus: [],
        intensity_target: 1,
        sets_target: 0,
        reps_range: '',
        estimated_duration_min: d % 7 === 6 ? 20 : 0,
        calorie_target: calorieTarget,
        protein_target_g: proteinTarget,
        daily_focus: d % 7 === 6 ? 'مشي 20 دقيقة أو تمديد خفيف' : 'يوم راحة — جسمك يبني نفسه',
        coach_tip: d % 7 === 6 ? 'المشي الخفيف يسرّع حرق الدهون' : 'النوم الجيد يضاعف نتائجك',
      })
    }
  }

  const healthNotices = []
  if (isPregnant)  healthNotices.push('⚠️ هذا البرنامج معدّل خصيصاً للحمل. استشيري طبيبك قبل البدء ومع كل أسبوع.')
  if (hasHeart)    healthNotices.push('⚠️ راقب نبضك أثناء التمرين. توقف فوراً عند أي ضغط في الصدر أو دوار.')
  if (hasKnee)     healthNotices.push('⚠️ تمارين الأرجل معدّلة لحماية الركبة. تجنب أي حركة تُسبب ألماً حاداً.')
  if (hasBack)     healthNotices.push('⚠️ تمارين الظهر معدّلة. توقف فوراً عند الألم الحاد أسفل الظهر.')
  if (hasShoulder) healthNotices.push('⚠️ تمارين الجزء العلوي معدّلة. لا ترفع الثقل فوق مستوى الكتف دون إذن طبيب.')

  return {
    program_name: g.name,
    program_tagline: g.tagline,
    nutrition_approach: g.nutrition,
    calorie_note: `هدفك ${calorieTarget} سعرة يومياً`,
    weekly_overview: WEEK_THEMES.slice(0, weeks),
    health_notices: healthNotices,
    days,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { userId, packageId, packageName, totalDays, profile } = req.body
    if (!userId || !profile) return res.status(400).json({ error: 'Missing fields' })

    const sb = supabaseAdmin()

    // Pause existing active program
    await sb.from('user_programs')
      .update({ status: 'paused' })
      .eq('user_id', userId)
      .eq('status', 'active')

    // Build roadmap locally — instant, never fails
    const days = totalDays || 21
    const roadmap = buildRoadmap(profile, days)

    const endDate = new Date()
    endDate.setDate(endDate.getDate() + days - 1)

    const { data: program, error } = await sb.from('user_programs').insert({
      user_id: userId,
      package_id: packageId || 'transform',
      package_name: packageName || roadmap.program_name,
      total_days: days,
      current_day: 1,
      status: 'active',
      roadmap,
      end_date: endDate.toISOString().split('T')[0],
    }).select().single()

    if (error) {
      console.error('DB insert error:', error)
      return res.status(500).json({ error: 'تعذر حفظ البرنامج: ' + error.message })
    }

    // Insert day records
    const dayRows = roadmap.days.map((d, i) => {
      const date = new Date(); date.setDate(date.getDate() + i)
      return {
        program_id: program.id,
        user_id: userId,
        day_number: i + 1,
        planned_date: date.toISOString().split('T')[0],
        roadmap_target: d,
      }
    })

    const { error: daysError } = await sb.from('program_days').insert(dayRows)
    if (daysError) console.error('Days insert error:', daysError)

    // Log (no API cost — local generation)
    logApiUsage(userId, 'program_gen', 0, 0)

    return res.json({ program, roadmap })
  } catch (e) {
    console.error('generate handler crash:', e)
    return res.status(500).json({ error: 'خطأ في الخادم: ' + (e?.message || e) })
  }
}
