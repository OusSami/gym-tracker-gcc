import { supabaseAdmin } from '../../../lib/supabase'

// Complete home exercise library (no equipment)
const EXERCISES = {
  'البطن': [
    {name:'كرانش | Crunch',        sets:3,reps:'15-20',rest:45,tip:'ارفع الكتفين فقط، ظهرك لا يكتمل رفعه'},
    {name:'بلانك | Plank',         sets:3,reps:'30 ثانية',rest:45,tip:'ظهرك مستقيم، شد البطن طوال الوقت'},
    {name:'رفع الساقين | Leg Raise',sets:3,reps:'12-15',rest:45,tip:'ظهرك ثابت على الأرض'},
    {name:'جبل تسلق | Mountain Climber',sets:3,reps:'20 ثانية',rest:40,tip:'الحركة سريعة، البطن مشدود'},
    {name:'كرانش جانبي | Side Crunch',sets:3,reps:'15 لكل جانب',rest:40,tip:'دوّر الجذع نحو الركبة'},
    {name:'V-Up | في ريفيرس',       sets:3,reps:'10-12',rest:50,tip:'ارفع الجذع والساقين في نفس الوقت'},
  ],
  'الأرجل': [
    {name:'قرفصاء | Squat',        sets:3,reps:'15-20',rest:60,tip:'ركبتك لا تتجاوز أصابع قدمك'},
    {name:'طعنة أمامية | Lunge',   sets:3,reps:'12 لكل ساق',rest:60,tip:'ظهرك مستقيم، الركبة الخلفية قريبة من الأرض'},
    {name:'جسر الأرداف | Glute Bridge',sets:3,reps:'15-20',rest:45,tip:'اضغط المؤخرة في الأعلى وثبّت ثانيتين'},
    {name:'قرفصاء قفز | Jump Squat',sets:3,reps:'10-12',rest:60,tip:'اهبط بلطف على الكعبين'},
    {name:'كيك باك | Donkey Kick', sets:3,reps:'15 لكل ساق',rest:40,tip:'ثبّت الورك، حرّك الساق فقط'},
  ],
  'الجسم كامل': [
    {name:'بيربي | Burpee',        sets:3,reps:'8-10',rest:60,tip:'اجمع بين القفز والضغط بحركة سلسة'},
    {name:'قفز النجمة | Jumping Jack',sets:3,reps:'30 ثانية',rest:40,tip:'حافظ على إيقاع ثابت'},
    {name:'ركض في المكان | High Knee',sets:3,reps:'30 ثانية',rest:40,tip:'الركبة ترتفع لمستوى الخصر'},
    {name:'بيربي بدون قفز | Modified Burpee',sets:3,reps:'10-12',rest:60,tip:'أبطأ وأكثر تحكماً من البيربي العادي'},
  ],
  'الصدر والكتفين': [
    {name:'ضغط | Push Up',         sets:3,reps:'10-15',rest:60,tip:'جسمك مستقيم من الرأس للكعب'},
    {name:'ضغط معدّل | Knee Push Up',sets:3,reps:'12-15',rest:60,tip:'مناسب للمبتدئين، نفس الحركة لكن على الركبتين'},
    {name:'ضغط واسع | Wide Push Up',sets:3,reps:'10-12',rest:60,tip:'يدي واسعتان يركّز على الصدر'},
    {name:'ضغط مثلث | Diamond Push Up',sets:3,reps:'8-10',rest:60,tip:'يدان متقاربتان يركّز على الثلاثي'},
  ],
  'الظهر': [
    {name:'سوبرمان | Superman',    sets:3,reps:'12-15',rest:45,tip:'ارفع الذراعين والساقين معاً، ثبّت ثانيتين'},
    {name:'سحب بالتعليق | Table Row',sets:3,reps:'10-12',rest:60,tip:'استخدم طاولة ثابتة وشد نفسك للأعلى'},
    {name:'امتداد الظهر | Back Extension',sets:3,reps:'15',rest:45,tip:'بطنك على الأرض، ارفع الجزء العلوي فقط'},
  ],
}

const WARMUP = [
  {name:'رقبة وكتفين | Neck Rolls',  duration_seconds:30, instructions:'دوّر رقبتك ببطء'},
  {name:'تدوير الذراعين | Arm Circles', duration_seconds:30, instructions:'دوائر كبيرة للأمام والخلف'},
  {name:'تدوير الخصر | Hip Circles',  duration_seconds:30, instructions:'دوائر بالخصر يميناً ويساراً'},
  {name:'قرفصاء خفيف | Air Squat',   duration_seconds:40, instructions:'10 قرفصاءات بطيئة للإحماء'},
  {name:'ركض خفيف | Light Jog',      duration_seconds:60, instructions:'اركض في المكان بهدوء'},
]

const COOLDOWN = [
  {name:'تمديد البطن | Cobra Stretch',  duration_seconds:30, target:'البطن والظهر السفلي'},
  {name:'تمديد الأرجل | Hamstring',     duration_seconds:30, target:'أوتار الركبة'},
  {name:'تمديد الكتفين | Shoulder',     duration_seconds:30, target:'الكتفين والصدر'},
  {name:'وضع الطفل | Child Pose',       duration_seconds:40, target:'الظهر والكتفين'},
]

const COACH_MSGS = {
  high:      'طاقتك عالية اليوم — استغلها! كل مجموعة بجهد كامل.',
  normal:    'استمر بالوتيرة الصحيحة. الاستمرارية تصنع الفرق.',
  low:       'جسمك تعبان — أكمل بلطف. نصف تمرين أفضل من لا شيء.',
  missed:    'عدت! اليوم نبدأ من حيث توقفنا. مجهود متوسط يكفي.',
  completed: 'ممتاز! واصل نفس المستوى أو أكثر اليوم.',
}

function buildWorkout(dayTarget, energyLevel, yesterdayStatus, profile) {
  const muscles = dayTarget.muscles_focus || ['البطن', 'الجسم كامل']
  const duration = dayTarget.estimated_duration_min || 30
  const intensity = dayTarget.intensity_target || 5

  // Profile-based adjustments
  const age = profile?.birthday
    ? Math.floor((Date.now() - new Date(profile.birthday)) / 31557600000)
    : (profile?.age || 35)
  const healthConditions = profile?.health_conditions || []
  const fitnessLevel = profile?.fitness_level || 'beginner'
  const sex = profile?.sex || 'male'
  const dayNum = dayTarget.day || 1
  const weekNum = Math.ceil(dayNum / 7)

  // Keywords to exclude based on health conditions
  const EXCLUDE = {
    knee_pain:     ['squat','lunge','jump','burpee','kick','step'],
    back_pain:     ['crunch','sit_up','deadlift','leg_raise','superman'],
    shoulder_pain: ['push_up','overhead','press'],
    hypertension:  ['burpee','jump','high_intensity'],
    asthma:        ['burpee','jump','sprint'],
    pregnancy:     ['crunch','plank','jump','burpee'],
  }
  const blockedTerms = []
  healthConditions.forEach(c => {
    if (EXCLUDE[c]) blockedTerms.push(...EXCLUDE[c])
  })
  // Age 45+ → no high impact
  if (age >= 45) blockedTerms.push('jump','burpee','sprint')

  // Collect exercises for target muscles
  let exercisePool = []
  muscles.forEach(m => {
    const key = Object.keys(EXERCISES).find(k => m.includes(k) || k.includes(m)) || 'البطن'
    exercisePool.push(...(EXERCISES[key] || []))
  })
  if (!exercisePool.length) exercisePool = [...EXERCISES['البطن'], ...EXERCISES['الجسم كامل']]

  // Filter blocked exercises
  exercisePool = exercisePool.filter(ex => {
    const nameLower = ex.name.toLowerCase()
    return !blockedTerms.some(term => nameLower.includes(term))
  })

  // Fallback if all filtered out
  if (!exercisePool.length) {
    exercisePool = [
      {name:'تنفس عميق | Deep Breathing', sets:2, reps:'10-15', rest:30, tip:'تنفس من البطن ببطء'},
      {name:'مشي في المكان | March', sets:3, reps:'30 ثانية', rest:30, tip:'ارفع ركبتيك ببطء'},
    ]
  }

  // Week 1 beginners: much lighter
  const isWeek1Beginner = weekNum === 1 && fitnessLevel === 'beginner'

  // Energy + yesterday adjustments
  let setsMultiplier = 1
  let repsMultiplier = 1
  if (isWeek1Beginner) { setsMultiplier = 0.6; repsMultiplier = 0.7 }
  else if (energyLevel === 'low' || yesterdayStatus === 'missed') { setsMultiplier = 0.75; repsMultiplier = 0.8 }
  else if (energyLevel === 'high' && weekNum >= 2) { setsMultiplier = 1.15; repsMultiplier = 1.1 }

  // Women: emphasize lower body/core, fewer push types
  const genderPreferred = sex === 'female'
    ? exercisePool.filter(ex => {
        const n = ex.name.toLowerCase()
        return n.includes('أرداف') || n.includes('قرفصاء') || n.includes('بطن') || n.includes('جسر') || n.includes('بلانك') || n.includes('كرانش')
      })
    : []
  // Mix preferred with general
  const finalPool = genderPreferred.length >= 2 ? [...genderPreferred, ...exercisePool.filter(e => !genderPreferred.includes(e))] : exercisePool

  const maxExercises = Math.min(Math.floor(duration / 4), finalPool.length, isWeek1Beginner ? 3 : 6)
  const exercises = finalPool.slice(0, maxExercises).map(ex => ({
    ...ex,
    muscle: muscles[0] || 'البطن',
    sets: Math.max(1, Math.round(ex.sets * setsMultiplier)),
    reps: isWeek1Beginner
      ? (ex.reps.includes('ثانية') ? '15 ثانية' : '8-10')
      : ex.reps,
  }))

  const coachMsg = COACH_MSGS[yesterdayStatus === 'missed' ? 'missed' : energyLevel] || COACH_MSGS.normal

  // Nutrition reminder from profile
  const cals = profile?.calorie_target || 1800
  const protein = profile?.weight_kg ? Math.round(profile.weight_kg * 1.6) : 120
  const nutrition = `هدفك اليوم: ${cals} سعرة و ${protein}g بروتين. ركّز على البروتين في وجبة ما بعد التمرين.`

  return {
    day_type: dayTarget.day_type || 'تمرين',
    coach_message: coachMsg,
    adapted: energyLevel === 'low' || yesterdayStatus === 'missed',
    adaptation_reason: energyLevel === 'low' ? 'طاقة منخفضة — تم تخفيف الشدة' : yesterdayStatus === 'missed' ? 'غياب أمس — عودة تدريجية' : '',
    warmup: WARMUP.slice(0, 3),
    exercises,
    cooldown: COOLDOWN.slice(0, 3),
    nutrition_reminder: nutrition,
    estimated_duration_min: duration,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, programId, dayNumber, energyLevel = 'normal', yesterdayStatus = 'completed', profile } = req.body
  if (!userId || !programId) return res.status(400).json({ error: 'Missing fields' })

  const sb = supabaseAdmin()
  const { data: program } = await sb.from('user_programs').select('roadmap,total_days').eq('id', programId).single()
  if (!program) return res.status(404).json({ error: 'Program not found' })

  const dayTarget = program.roadmap?.days?.[dayNumber - 1] || {}

  // Rest day
  if (dayTarget.day_type === 'راحة') {
    return res.json({
      workout: {
        day_type: 'راحة',
        coach_message: 'يوم راحة — جسمك يبني نفسه الآن. نم جيداً واشرب ماء.',
        warmup: [], exercises: [], cooldown: [],
        nutrition_reminder: `حافظ على ${profile?.calorie_target || 1800} سعرة اليوم. البروتين مهم حتى في أيام الراحة.`,
        estimated_duration_min: 0,
      }
    })
  }

  const workout = buildWorkout(dayTarget, energyLevel, yesterdayStatus, profile)

  // Save to DB
  await sb.from('program_days')
    .update({ daily_workout: workout })
    .eq('program_id', programId)
    .eq('day_number', dayNumber)

  return res.json({ workout, adapted: workout.adapted })
}
