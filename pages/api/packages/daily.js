import { supabaseAdmin } from '../../../lib/supabase'

// ── Exercise library ───────────────────────────────────────────────
// Names always "عربي | English" so keyword filtering works on both.
const EXERCISES = {
  'البطن': [
    {name:'كرانش | Crunch',                sets:3,reps:'15-20',rest:45,tip:'ارفع الكتفين فقط، لا تشد رقبتك'},
    {name:'بلانك | Plank',                 sets:3,reps:'30 ثانية',rest:45,tip:'ظهرك مستقيم، شد البطن طوال الوقت'},
    {name:'رفع الساقين | Leg Raise',       sets:3,reps:'12-15',rest:45,tip:'ظهرك ثابت تماماً على الأرض'},
    {name:'جبل تسلق | Mountain Climber',   sets:3,reps:'20 ثانية',rest:40,tip:'الحركة سريعة والبطن مشدود'},
    {name:'كرانش جانبي | Side Crunch',     sets:3,reps:'15 لكل جانب',rest:40,tip:'دوّر الجذع نحو الركبة'},
    {name:'بلانك جانبي | Side Plank',      sets:3,reps:'20 ثانية لكل جانب',rest:40,tip:'جسمك مستقيم كخط'},
    {name:'كرانش عكسي | Reverse Crunch',   sets:3,reps:'12-15',rest:45,tip:'ارفع الحوض نحو الصدر'},
    {name:'دراجة | Bicycle Crunch',        sets:3,reps:'20 ثانية',rest:40,tip:'الكوع يلمس الركبة المعاكسة'},
    {name:'في أب | V-Up',                  sets:3,reps:'10-12',rest:50,tip:'ارفع الجذع والساقين في نفس الوقت'},
    {name:'ميت باق | Dead Bug',            sets:3,reps:'10 لكل جانب',rest:40,tip:'ظهرك ثابت على الأرض، تحرك ببطء'},
  ],
  'الأرجل': [
    {name:'قرفصاء | Squat',                sets:3,reps:'15-20',rest:60,tip:'ركبتك لا تتجاوز أصابع قدمك'},
    {name:'طعنة أمامية | Lunge',           sets:3,reps:'12 لكل ساق',rest:60,tip:'ظهرك مستقيم، الركبة الخلفية قريبة من الأرض'},
    {name:'جسر الأرداف | Glute Bridge',    sets:3,reps:'15-20',rest:45,tip:'اضغط المؤخرة في الأعلى وثبّت ثانيتين'},
    {name:'كيك باك | Donkey Kick',         sets:3,reps:'15 لكل ساق',rest:40,tip:'ثبّت الورك، حرّك الساق فقط'},
    {name:'رفع الكعب | Calf Raise',        sets:3,reps:'20-25',rest:30,tip:'ارفع ببطء وانزل ببطء'},
    {name:'قرفصاء سومو | Sumo Squat',      sets:3,reps:'15',rest:50,tip:'قدماك متباعدتان، أصابعك للخارج'},
    {name:'طعنة جانبية | Side Lunge',      sets:3,reps:'12 لكل ساق',rest:50,tip:'الساق المستقيمة تبقى ثابتة'},
    {name:'جسر أحادي | Single Leg Bridge', sets:3,reps:'12 لكل ساق',rest:45,tip:'ارفع ساقاً واحدة وحافظ على التوازن'},
    {name:'قرفصاء قفز | Jump Squat',       sets:3,reps:'10-12',rest:60,tip:'اهبط بلطف على الكعبين مع ثني الركبتين'},
  ],
  'الجسم كامل': [
    {name:'بيربي | Burpee',                sets:3,reps:'8-10',rest:60,tip:'اجمع بين القفز والضغط بحركة سلسة'},
    {name:'قفز النجمة | Jumping Jack',     sets:3,reps:'30 ثانية',rest:40,tip:'حافظ على إيقاع ثابت'},
    {name:'ركض في المكان | High Knee',     sets:3,reps:'30 ثانية',rest:40,tip:'الركبة ترتفع لمستوى الخصر'},
    {name:'بيربي معدّل | Modified Burpee', sets:3,reps:'10-12',rest:60,tip:'بدون قفز — أبطأ وأكثر تحكماً'},
    {name:'تمرين الدب | Bear Crawl',       sets:3,reps:'20 ثانية',rest:45,tip:'حافظ على ظهر مسطح موازٍ للأرض'},
    {name:'ضغط قفز | Plyometric Push Up',  sets:3,reps:'8-10',rest:60,tip:'ادفع يديك عن الأرض بقوة'},
  ],
  'الصدر والكتفين': [
    {name:'ضغط | Push Up',                 sets:3,reps:'10-15',rest:60,tip:'جسمك مستقيم من الرأس للكعب'},
    {name:'ضغط معدّل | Modified Push Up',  sets:3,reps:'12-15',rest:60,tip:'على الركبتين — مناسب للمبتدئين'},
    {name:'ضغط واسع | Wide Push Up',       sets:3,reps:'10-12',rest:60,tip:'يدان واسعتان يركّز على الصدر'},
    {name:'ضغط مثلث | Diamond Push Up',    sets:3,reps:'8-10',rest:60,tip:'يدان متقاربتان يركّز على الثلاثي'},
    {name:'ضغط انحداري | Decline Push Up', sets:3,reps:'10-12',rest:60,tip:'قدماك مرفوعتان يركّز على الصدر العلوي'},
    {name:'بايك بوش أب | Pike Push Up',    sets:3,reps:'10-12',rest:60,tip:'جسمك بزاوية V يركّز على الكتفين'},
  ],
  'الظهر': [
    {name:'سوبرمان | Superman',            sets:3,reps:'12-15',rest:45,tip:'ارفع ذراعيك وساقيك معاً، ثبّت ثانيتين'},
    {name:'سحب بالطاولة | Table Row',      sets:3,reps:'10-12',rest:60,tip:'استخدم طاولة ثابتة وشد نفسك للأعلى'},
    {name:'بيرد دوج | Bird Dog',           sets:3,reps:'12 لكل جانب',rest:40,tip:'ذراع وساق معاكسة في نفس الوقت'},
    {name:'سوبرمان أحادي | Single Superman',sets:3,reps:'12 لكل جانب',rest:40,tip:'ارفع ذراعاً واحدة وساقاً معاكسة'},
  ],
  'المؤخرة': [
    {name:'جسر الأرداف | Glute Bridge',    sets:3,reps:'15-20',rest:45,tip:'اضغط المؤخرة في الأعلى'},
    {name:'رفع الورك | Hip Thrust',        sets:3,reps:'15-20',rest:45,tip:'ظهرك على الأرض، ارفع الحوض عالياً'},
    {name:'كيك باك | Donkey Kick',         sets:3,reps:'15 لكل ساق',rest:40,tip:'ثبّت الورك، حرّك الساق فقط'},
    {name:'قرفصاء سومو | Sumo Squat',      sets:3,reps:'15',rest:50,tip:'تركيز على المؤخرة والداخلية'},
    {name:'جسر أحادي | Single Leg Bridge', sets:3,reps:'12 لكل ساق',rest:45,tip:'تحدٍّ للتوازن والمؤخرة'},
    {name:'طعنة خلفية | Reverse Lunge',    sets:3,reps:'12 لكل ساق',rest:50,tip:'اخطُ للخلف، ركبة خلفية قريبة من الأرض'},
  ],
  'الجانبين': [
    {name:'كرانش جانبي | Side Crunch',     sets:3,reps:'15 لكل جانب',rest:40,tip:'دوّر الجذع نحو الركبة'},
    {name:'بلانك جانبي | Side Plank',      sets:3,reps:'20 ثانية لكل جانب',rest:40,tip:'جسمك مستقيم'},
    {name:'طعنة جانبية | Side Lunge',      sets:3,reps:'12 لكل ساق',rest:50,tip:'اضغط المؤخرة والداخلية'},
    {name:'رفع الورك الجانبي | Clamshell', sets:3,reps:'15 لكل جانب',rest:35,tip:'استلقِ جانباً وارفع الركبة العليا'},
  ],
}

// ── Warmup (will be filtered by conditions) ───────────────────────
const WARMUP_ALL = [
  {name:'رقبة وكتفين | Neck Rolls',     duration_seconds:30, instructions:'دوّر رقبتك ببطء يميناً ويساراً'},
  {name:'تدوير الذراعين | Arm Circles', duration_seconds:30, instructions:'دوائر كبيرة للأمام والخلف'},
  {name:'تدوير الخصر | Hip Circles',    duration_seconds:30, instructions:'دوائر بالخصر يميناً ويساراً'},
  {name:'قرفصاء خفيف | Air Squat',     duration_seconds:40, instructions:'10 قرفصاءات بطيئة للإحماء'},
  {name:'ركض خفيف | Light March',      duration_seconds:60, instructions:'ارفع ركبتيك ببطء في مكانك'},
  {name:'مط الجانب | Side Stretch',    duration_seconds:30, instructions:'مدّ يديك للأعلى وانحنِ يميناً ويساراً'},
]

const COOLDOWN = [
  {name:'تمديد البطن | Cobra Stretch', duration_seconds:35, target:'البطن والظهر السفلي'},
  {name:'تمديد الأرجل | Hamstring',    duration_seconds:35, target:'أوتار الركبة'},
  {name:'تمديد الكتفين | Shoulder',    duration_seconds:30, target:'الكتفين والصدر'},
  {name:'وضع الطفل | Child Pose',      duration_seconds:45, target:'الظهر الكامل والكتفين'},
  {name:'تمديد الأرداف | Pigeon Pose', duration_seconds:30, target:'الأرداف والوركين'},
]

// ── Health condition → blocked exercise keywords ──────────────────
// Uses English keywords (always present in exercise name after "|")
// and Arabic keywords. ALWAYS use spaces, not underscores.
const HEALTH_EXCLUDE = {
  knee_pain:     ['squat', 'lunge', 'jump', 'burpee', 'donkey kick', 'high knee', 'side lunge', 'reverse lunge', 'box'],
  back_pain:     ['crunch', 'sit up', 'leg raise', 'superman', 'dead bug', 'v-up', 'bicycle', 'reverse crunch', 'mountain climber'],
  shoulder_pain: ['push up', 'push-up', 'overhead', 'press', 'pike', 'decline', 'diamond', 'table row', 'plank', 'plyometric push'],
  hypertension:  ['burpee', 'jump', 'high knee', 'plyometric', 'bear crawl', 'box'],
  asthma:        ['burpee', 'jump squat', 'high knee', 'plyometric', 'box'],
  pregnancy:     ['crunch', 'plank', 'jump', 'burpee', 'v-up', 'reverse crunch', 'bicycle', 'leg raise', 'superman', 'mountain climber', 'dead bug'],
  heart:         ['burpee', 'jump', 'plyometric', 'high knee', 'bear crawl', 'box'],
  diabetes:      [], // no exclusions — just reduce session duration
}

// ── Warmup exercises to skip per condition ────────────────────────
const WARMUP_EXCLUDE = {
  knee_pain:     ['squat', 'lunge'],
  shoulder_pain: ['arm circle'],
  back_pain:     [],
  pregnancy:     ['squat'],
  heart:         [],
  hypertension:  [],
}

// ── Weekly progressive overload table ────────────────────────────
// Each week gets a multiplier for sets, and a rep modifier
const WEEKLY_PROGRESSION = [
  { setsMulti: 0.67, repsVariant: 'light',   note: 'تعلّم الحركات بشكل صحيح' },   // week 1
  { setsMulti: 0.83, repsVariant: 'normal',  note: 'بناء العادة والاستمرارية' },   // week 2
  { setsMulti: 1.0,  repsVariant: 'normal',  note: 'الأداء بالكامل' },             // week 3
  { setsMulti: 1.17, repsVariant: 'heavy',   note: 'رفع الشدة والتحدي' },          // week 4+
]

const COACH_MSGS = {
  high:      'طاقتك عالية اليوم — استغلها! كل مجموعة بجهد كامل.',
  normal:    'استمر بالوتيرة الصحيحة. الاستمرارية تصنع الفرق.',
  low:       'جسمك تعبان — أكمل بلطف. نصف تمرين أفضل من لا شيء.',
  missed:    'عدت! اليوم نبدأ من حيث توقفنا. مجهود متوسط يكفي.',
  completed: 'ممتاز! واصل نفس المستوى أو أكثر اليوم.',
}

function adjustReps(baseReps, variant, energyLevel) {
  if (typeof baseReps === 'string' && baseReps.includes('ثانية')) {
    if (variant === 'light') return baseReps.replace(/\d+/, n => Math.max(15, Math.round(parseInt(n) * 0.6)))
    if (variant === 'heavy') return baseReps.replace(/\d+/, n => Math.round(parseInt(n) * 1.2))
    if (energyLevel === 'low') return baseReps.replace(/\d+/, n => Math.max(15, Math.round(parseInt(n) * 0.8)))
    return baseReps
  }
  if (variant === 'light') return '8-10'
  if (variant === 'heavy') {
    const [lo, hi] = baseReps.split('-').map(Number)
    if (lo && hi) return `${lo + 2}-${hi + 3}`
    return baseReps
  }
  if (energyLevel === 'low') {
    const [lo, hi] = baseReps.split('-').map(Number)
    if (lo && hi) return `${Math.max(6, lo - 2)}-${Math.max(8, hi - 2)}`
    return baseReps
  }
  return baseReps
}

function buildWorkout(dayTarget, energyLevel, yesterdayStatus, profile, dayNumber) {
  const muscles = dayTarget.muscles_focus || ['البطن', 'الجسم كامل']
  const duration = dayTarget.estimated_duration_min || 30
  const dayNum = dayNumber || dayTarget.day || 1
  const weekNum = Math.ceil(dayNum / 7)

  const age = profile?.birthday
    ? Math.floor((Date.now() - new Date(profile.birthday)) / 31557600000)
    : (profile?.age || 30)
  const healthConditions = Array.isArray(profile?.health_conditions) ? profile.health_conditions : []
  const fitnessLevel = profile?.fitness_level || 'beginner'
  const sex = profile?.sex || 'male'

  // ── Build blocked keyword list ────────────────────────────────
  const blockedTerms = new Set()
  healthConditions.forEach(c => {
    const terms = HEALTH_EXCLUDE[c] || []
    terms.forEach(t => blockedTerms.add(t.toLowerCase()))
  })
  if (age >= 45) {
    ['jump squat', 'burpee', 'jump', 'plyometric', 'box', 'high knee'].forEach(t => blockedTerms.add(t))
  }

  // ── Filter function ───────────────────────────────────────────
  const isBlocked = (ex) => {
    const nameLower = ex.name.toLowerCase()
    for (const term of blockedTerms) {
      if (nameLower.includes(term)) return true
    }
    return false
  }

  // ── Collect exercise pool for target muscles ──────────────────
  let exercisePool = []
  muscles.forEach(m => {
    const key = Object.keys(EXERCISES).find(k => m.includes(k) || k.includes(m)) || 'البطن'
    const pool = (EXERCISES[key] || []).filter(ex => !isBlocked(ex))
    exercisePool.push(...pool)
  })
  // Deduplicate
  exercisePool = exercisePool.filter((ex, idx, arr) => arr.findIndex(e => e.name === ex.name) === idx)

  // Fallback if all blocked by conditions
  if (!exercisePool.length) {
    exercisePool = [
      {name:'مشي في المكان | March In Place', sets:3, reps:'30 ثانية', rest:30, tip:'ارفع ركبتيك ببطء'},
      {name:'تنفس عميق | Deep Breathing',     sets:3, reps:'10',        rest:20, tip:'تنفس من البطن'},
    ]
  }

  // ── Female preference: lower body + core first ───────────────
  if (sex === 'female') {
    const preferred = exercisePool.filter(ex => {
      const n = ex.name.toLowerCase()
      return n.includes('أرداف') || n.includes('glute') || n.includes('قرفصاء') || n.includes('squat')
        || n.includes('بطن') || n.includes('core') || n.includes('جسر') || n.includes('bridge')
        || n.includes('بلانك') || n.includes('plank') || n.includes('كرانش') || n.includes('crunch')
        || n.includes('lunge') || n.includes('طعنة')
    })
    if (preferred.length >= 2) {
      exercisePool = [...preferred, ...exercisePool.filter(e => !preferred.includes(e))]
    }
  }

  // ── Progressive overload: week-based params ───────────────────
  const progressIdx = Math.min(weekNum - 1, WEEKLY_PROGRESSION.length - 1)
  const progress = WEEKLY_PROGRESSION[progressIdx]
  let setsMultiplier = progress.setsMulti
  let repsVariant = progress.repsVariant

  // Energy & continuity adjustments on top of weekly progression
  if (energyLevel === 'low' || yesterdayStatus === 'missed') {
    setsMultiplier = Math.min(setsMultiplier, 0.75)
    repsVariant = 'light'
  } else if (energyLevel === 'high' && weekNum >= 2) {
    setsMultiplier = Math.min(setsMultiplier * 1.1, 1.3)
    if (repsVariant === 'normal') repsVariant = 'heavy'
  }

  // ── Exercise count cap ────────────────────────────────────────
  const isEarly = weekNum === 1 && fitnessLevel === 'beginner'
  const maxExercises = Math.min(
    Math.floor(duration / 5),
    exercisePool.length,
    isEarly ? 5 : 7
  )

  // ── Day-based rotation for variety ───────────────────────────
  // Each day shifts the starting position so exercises vary across sessions
  const rotationOffset = (dayNum - 1) % Math.max(1, exercisePool.length)
  const rotatedPool = [
    ...exercisePool.slice(rotationOffset),
    ...exercisePool.slice(0, rotationOffset),
  ]

  const exercises = rotatedPool.slice(0, maxExercises).map(ex => ({
    ...ex,
    muscle: muscles[0] || 'البطن',
    sets: Math.max(1, Math.round(ex.sets * setsMultiplier)),
    reps: adjustReps(ex.reps, repsVariant, energyLevel),
  }))

  // ── Adapted warmup (respect conditions) ──────────────────────
  const warmupBlockedTerms = new Set()
  healthConditions.forEach(c => {
    const terms = WARMUP_EXCLUDE[c] || []
    terms.forEach(t => warmupBlockedTerms.add(t.toLowerCase()))
  })
  const warmup = WARMUP_ALL
    .filter(w => {
      const n = w.name.toLowerCase()
      for (const t of warmupBlockedTerms) { if (n.includes(t)) return false }
      return true
    })
    .slice(0, 3)

  // ── Adapted cooldown ──────────────────────────────────────────
  const cooldown = COOLDOWN.slice(0, 3)

  // ── Condition-aware session notes ────────────────────────────
  const conditionNotes = []
  if (healthConditions.includes('knee_pain'))     conditionNotes.push('تجنّب أي ضغط على الركبة — توقف فوراً إذا أحسست بألم')
  if (healthConditions.includes('back_pain'))     conditionNotes.push('حافظ على ظهر مستقيم في كل تمرين — توقف إذا أحسست بألم حاد')
  if (healthConditions.includes('shoulder_pain')) conditionNotes.push('البرنامج معدّل لحمايتك — لا تجاهل أي ألم في الكتف')
  if (healthConditions.includes('hypertension'))  conditionNotes.push('راقب نفسك — إذا أحسست بدوار أو صداع توقف فوراً')
  if (healthConditions.includes('heart'))         conditionNotes.push('ابقَ في منطقة الشدة المنخفضة — لا تتجاوز 70% من طاقتك')
  if (healthConditions.includes('asthma'))        conditionNotes.push('ضع البخاخ قريباً — خفّف إذا صعّب التنفس')
  if (healthConditions.includes('pregnancy'))     conditionNotes.push('تمارينك معدّلة للحمل — استشيري طبيبتك دائماً')
  if (healthConditions.includes('diabetes'))      conditionNotes.push('تناول وجبة خفيفة قبل التمرين — راقب مستوى السكر')

  const coachMsg = COACH_MSGS[yesterdayStatus === 'missed' ? 'missed' : energyLevel] || COACH_MSGS.normal
  const adaptNote = healthConditions.length > 0 ? ` | التمرين معدّل حسب حالتك الصحية.` : ''

  const cals = profile?.calorie_target || 1800
  const protein = profile?.weight_kg ? Math.round(profile.weight_kg * 1.6) : 120
  const nutrition = `هدفك اليوم: ${cals} سعرة و ${protein}g بروتين. ركّز على البروتين في وجبة ما بعد التمرين.`

  return {
    day_type: dayTarget.day_type || 'تمرين',
    coach_message: coachMsg + adaptNote,
    week_note: progress.note,
    adapted: energyLevel === 'low' || yesterdayStatus === 'missed' || healthConditions.length > 0,
    adaptation_reason: healthConditions.length > 0
      ? `تم تعديل التمرين لحالتك الصحية: ${healthConditions.join(', ')}`
      : energyLevel === 'low' ? 'طاقة منخفضة — تم تخفيف الشدة'
      : yesterdayStatus === 'missed' ? 'غياب أمس — عودة تدريجية' : '',
    condition_notes: conditionNotes,
    warmup,
    exercises,
    cooldown,
    nutrition_reminder: nutrition,
    estimated_duration_min: duration,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { userId, programId, dayNumber, energyLevel = 'normal', yesterdayStatus = 'completed', profile } = req.body
    if (!userId || !programId) return res.status(400).json({ error: 'Missing fields' })

    const sb = supabaseAdmin()

    // Always fetch fresh profile from DB so health conditions are up-to-date
    const { data: freshProfile } = await sb.from('profiles')
      .select('health_conditions,sex,age,birthday,fitness_level,weight_kg,calorie_target,goal,body_fat_pct')
      .eq('id', userId).single()
    const mergedProfile = { ...profile, ...freshProfile }

    const { data: program } = await sb.from('user_programs').select('roadmap,total_days').eq('id', programId).single()
    if (!program) return res.status(404).json({ error: 'Program not found' })

    const dayTarget = program.roadmap?.days?.[dayNumber - 1] || {}

    if (dayTarget.day_type === 'راحة') {
      const cals = mergedProfile?.calorie_target || 1800
      return res.json({
        workout: {
          day_type: 'راحة',
          coach_message: 'يوم راحة — جسمك يبني نفسه الآن. نم جيداً واشرب ماء كافياً.',
          condition_notes: [],
          warmup: [], exercises: [], cooldown: [],
          nutrition_reminder: `حافظ على ${cals} سعرة اليوم. البروتين مهم حتى في أيام الراحة.`,
          estimated_duration_min: 0,
        }
      })
    }

    const workout = buildWorkout(dayTarget, energyLevel, yesterdayStatus, mergedProfile, dayNumber)

    await sb.from('program_days')
      .update({ daily_workout: workout })
      .eq('program_id', programId)
      .eq('day_number', dayNumber)

    return res.json({ workout, adapted: workout.adapted })
  } catch (e) {
    console.error('daily handler error:', e)
    return res.status(500).json({ error: 'خطأ في توليد التمرين: ' + (e?.message || e) })
  }
}
