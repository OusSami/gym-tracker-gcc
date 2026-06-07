import { supabaseAdmin } from '../../../lib/supabase'
import { EXERCISE_DB } from '../../../lib/exercise-data'

// Build lookup: lowercase English name → EXERCISE_DB entry
// EXERCISE_DB names are "English | Arabic"; daily.js exercise names are "Arabic | English"
const DB_BY_ENG = new Map()
EXERCISE_DB.forEach(e => {
  const eng = (e.name.split('|')[0] || e.name).toLowerCase().trim()
  DB_BY_ENG.set(eng, e)
})

// ── Exercise library ───────────────────────────────────────────────
// Names always "عربي | English" so keyword filtering works on both.
// level: 'beginner' = suitable for 30-40yo who never trained
//        'intermediate' = requires some base fitness
//        'advanced' = requires existing training background
const EXERCISES = {
  'البطن': [
    {name:'لمس الكعب | Heel Touch',        sets:3,reps:'20 لكل جانب',rest:35,level:'beginner',    tip:'استلقِ وانزل يدك ببطء نحو كعبك'},
    {name:'كرانش جانبي | Side Crunch',     sets:3,reps:'15 لكل جانب',rest:40,level:'beginner',    tip:'دوّر الجذع نحو الركبة'},
    {name:'ميت باق | Dead Bug',            sets:3,reps:'10 لكل جانب',rest:40,level:'beginner',    tip:'ظهرك ثابت على الأرض، تحرك ببطء'},
    {name:'كرانش | Crunch',                sets:3,reps:'15-20',       rest:45,level:'beginner',    tip:'ارفع الكتفين فقط، لا تشد رقبتك'},
    {name:'كرانش عكسي | Reverse Crunch',   sets:3,reps:'12-15',       rest:45,level:'intermediate',tip:'ارفع الحوض نحو الصدر'},
    {name:'دراجة | Bicycle Crunch',        sets:3,reps:'20 ثانية',    rest:40,level:'intermediate',tip:'الكوع يلمس الركبة المعاكسة'},
    {name:'بلانك | Plank',                 sets:3,reps:'20-30 ثانية', rest:45,level:'intermediate',tip:'ظهرك مستقيم، شد البطن طوال الوقت'},
    {name:'بلانك جانبي | Side Plank',      sets:3,reps:'20 ثانية لكل جانب',rest:40,level:'intermediate',tip:'جسمك مستقيم كخط'},
    {name:'رفع الساقين | Leg Raise',       sets:3,reps:'12-15',       rest:45,level:'intermediate',tip:'ظهرك ثابت تماماً على الأرض'},
    {name:'جبل تسلق | Mountain Climber',   sets:3,reps:'20 ثانية',    rest:40,level:'intermediate',tip:'الحركة سريعة والبطن مشدود'},
    {name:'في أب | V-Up',                  sets:3,reps:'10-12',       rest:50,level:'advanced',    tip:'ارفع الجذع والساقين في نفس الوقت'},
  ],
  'الأرجل': [
    {name:'قرفصاء بالكرسي | Chair Squat',  sets:3,reps:'12-15',rest:45,level:'beginner',    tip:'انزل ببطء كأنك ستجلس على الكرسي ثم قف'},
    {name:'جسر الأرداف | Glute Bridge',    sets:3,reps:'15-20',rest:45,level:'beginner',    tip:'اضغط المؤخرة في الأعلى وثبّت ثانيتين'},
    {name:'كيك باك | Donkey Kick',         sets:3,reps:'15 لكل ساق',rest:40,level:'beginner',tip:'ثبّت الورك، حرّك الساق فقط'},
    {name:'رفع الكعب | Calf Raise',        sets:3,reps:'20-25',rest:30,level:'beginner',    tip:'ارفع ببطء وانزل ببطء'},
    {name:'قرفصاء | Squat',                sets:3,reps:'15-20',rest:60,level:'beginner',    tip:'ركبتك لا تتجاوز أصابع قدمك'},
    {name:'قرفصاء سومو | Sumo Squat',      sets:3,reps:'15',   rest:50,level:'beginner',    tip:'قدماك متباعدتان، أصابعك للخارج'},
    {name:'طعنة أمامية | Lunge',           sets:3,reps:'12 لكل ساق',rest:60,level:'intermediate',tip:'ظهرك مستقيم، الركبة الخلفية قريبة من الأرض'},
    {name:'طعنة جانبية | Side Lunge',      sets:3,reps:'12 لكل ساق',rest:50,level:'intermediate',tip:'الساق المستقيمة تبقى ثابتة'},
    {name:'جسر أحادي | Single Leg Bridge', sets:3,reps:'12 لكل ساق',rest:45,level:'intermediate',tip:'ارفع ساقاً واحدة وحافظ على التوازن'},
    {name:'قرفصاء قفز | Jump Squat',       sets:3,reps:'10-12',rest:60,level:'advanced',    tip:'اهبط بلطف على الكعبين مع ثني الركبتين'},
  ],
  'الجسم كامل': [
    {name:'مشي في المكان | March In Place', sets:3,reps:'45 ثانية',rest:30,level:'beginner',    tip:'ارفع ركبتيك ببطء ومنتظم وحرّك ذراعيك'},
    {name:'بيربي معدّل | Modified Burpee',  sets:3,reps:'10-12',   rest:60,level:'intermediate',tip:'بدون قفز — أبطأ وأكثر تحكماً'},
    {name:'قفز النجمة | Jumping Jack',      sets:3,reps:'30 ثانية', rest:40,level:'intermediate',tip:'حافظ على إيقاع ثابت'},
    {name:'ركض في المكان | High Knee',      sets:3,reps:'30 ثانية', rest:40,level:'intermediate',tip:'الركبة ترتفع لمستوى الخصر'},
    {name:'تمرين الدب | Bear Crawl',        sets:3,reps:'20 ثانية', rest:45,level:'intermediate',tip:'حافظ على ظهر مسطح موازٍ للأرض'},
    {name:'بيربي | Burpee',                 sets:3,reps:'8-10',     rest:60,level:'advanced',    tip:'اجمع بين القفز والضغط بحركة سلسة'},
    {name:'ضغط قفز | Plyometric Push Up',   sets:3,reps:'8-10',     rest:60,level:'advanced',    tip:'ادفع يديك عن الأرض بقوة'},
  ],
  'الصدر والكتفين': [
    {name:'ضغط الجدار | Wall Push Up',      sets:3,reps:'12-15',rest:45,level:'beginner',    tip:'وجهك للجدار وجسمك مائل، ادفع وارجع'},
    {name:'ضغط معدّل | Modified Push Up',   sets:3,reps:'12-15',rest:60,level:'beginner',    tip:'على الركبتين — مناسب للمبتدئين'},
    {name:'ضغط | Push Up',                  sets:3,reps:'10-15',rest:60,level:'intermediate',tip:'جسمك مستقيم من الرأس للكعب'},
    {name:'ضغط واسع | Wide Push Up',        sets:3,reps:'10-12',rest:60,level:'intermediate',tip:'يدان واسعتان يركّز على الصدر'},
    {name:'بايك بوش أب | Pike Push Up',     sets:3,reps:'10-12',rest:60,level:'intermediate',tip:'جسمك بزاوية V يركّز على الكتفين'},
    {name:'ضغط مثلث | Diamond Push Up',     sets:3,reps:'8-10', rest:60,level:'advanced',    tip:'يدان متقاربتان يركّز على الثلاثي'},
    {name:'ضغط انحداري | Decline Push Up',  sets:3,reps:'10-12',rest:60,level:'advanced',    tip:'قدماك مرفوعتان يركّز على الصدر العلوي'},
  ],
  'الظهر': [
    {name:'سوبرمان | Superman',             sets:3,reps:'12-15',         rest:45,level:'beginner',    tip:'ارفع ذراعيك وساقيك معاً، ثبّت ثانيتين'},
    {name:'بيرد دوج | Bird Dog',            sets:3,reps:'12 لكل جانب',  rest:40,level:'beginner',    tip:'ذراع وساق معاكسة في نفس الوقت'},
    {name:'سوبرمان أحادي | Single Superman',sets:3,reps:'12 لكل جانب',  rest:40,level:'beginner',    tip:'ارفع ذراعاً واحدة وساقاً معاكسة'},
    {name:'سحب بالطاولة | Table Row',       sets:3,reps:'10-12',         rest:60,level:'intermediate',tip:'استخدم طاولة ثابتة وشد نفسك للأعلى'},
  ],
  'المؤخرة': [
    {name:'جسر الأرداف | Glute Bridge',    sets:3,reps:'15-20',       rest:45,level:'beginner',    tip:'اضغط المؤخرة في الأعلى'},
    {name:'كيك باك | Donkey Kick',         sets:3,reps:'15 لكل ساق', rest:40,level:'beginner',    tip:'ثبّت الورك، حرّك الساق فقط'},
    {name:'قرفصاء سومو | Sumo Squat',      sets:3,reps:'15',          rest:50,level:'beginner',    tip:'تركيز على المؤخرة والداخلية'},
    {name:'رفع الورك | Hip Thrust',        sets:3,reps:'15-20',       rest:45,level:'intermediate',tip:'ظهرك على الأرض، ارفع الحوض عالياً'},
    {name:'جسر أحادي | Single Leg Bridge', sets:3,reps:'12 لكل ساق', rest:45,level:'intermediate',tip:'تحدٍّ للتوازن والمؤخرة'},
    {name:'طعنة خلفية | Reverse Lunge',    sets:3,reps:'12 لكل ساق', rest:50,level:'intermediate',tip:'اخطُ للخلف، ركبة خلفية قريبة من الأرض'},
  ],
  'الجانبين': [
    {name:'كرانش جانبي | Side Crunch',     sets:3,reps:'15 لكل جانب',      rest:40,level:'beginner',    tip:'دوّر الجذع نحو الركبة'},
    {name:'رفع الورك الجانبي | Clamshell', sets:3,reps:'15 لكل جانب',      rest:35,level:'beginner',    tip:'استلقِ جانباً وارفع الركبة العليا'},
    {name:'بلانك جانبي | Side Plank',      sets:3,reps:'20 ثانية لكل جانب',rest:40,level:'intermediate',tip:'جسمك مستقيم'},
    {name:'طعنة جانبية | Side Lunge',      sets:3,reps:'12 لكل ساق',       rest:50,level:'intermediate',tip:'اضغط المؤخرة والداخلية'},
  ],
}

// ── Warmup (will be filtered by conditions) ───────────────────────
const WARMUP_ALL = [
  {
    name:'رقبة وكتفين | Neck Rolls', duration_seconds:30,
    imageKey:'w-shoulder-swing', target:'الرقبة · الكتفين',
    instructions:'دوّر رقبتك ببطء يميناً ويساراً',
    steps:['قف أو اجلس بوضع مستقيم','أمِل رأسك ببطء نحو اليمين','دوّره للأمام ثم لليسار','٥ دوائر كاملة ثم عكس الاتجاه'],
    femaleSteps:['قفي أو اجلسي بوضع مستقيم','أميلي رأسك ببطء نحو اليمين','دوّريه للأمام ثم لليسار','٥ دوائر كاملة ثم عكسي الاتجاه'],
  },
  {
    name:'تدوير الذراعين | Arm Circles', duration_seconds:30,
    imageKey:'w-arm-circles', target:'الكتفين · الذراعين',
    instructions:'دوائر كبيرة للأمام والخلف',
    steps:['ابسط ذراعيك للجانبين على مستوى الكتف','ابدأ بدوائر صغيرة وكبّرها تدريجياً','١٠ دوائر للأمام ثم ١٠ للخلف','حافظ على الكتفين مسترخيين'],
    femaleSteps:['ابسطي ذراعيكِ للجانبين على مستوى الكتف','ابدئي بدوائر صغيرة وكبّريها تدريجياً','١٠ دوائر للأمام ثم ١٠ للخلف','حافظي على الكتفين مسترخيين'],
  },
  {
    name:'تدوير الخصر | Hip Circles', duration_seconds:30,
    imageKey:null, target:'الخصر · الوركين',
    instructions:'دوائر بالخصر يميناً ويساراً',
    steps:['قف مع مسافة الكتفين بين قدميك','ضع يديك على خصرك','دوّر الخصر بدوائر كبيرة يميناً','١٠ دوائر ثم عكس الاتجاه'],
    femaleSteps:['قفي مع مسافة الكتفين بين قدميكِ','ضعي يديكِ على خصركِ','دوّري الخصر بدوائر كبيرة يميناً','١٠ دوائر ثم عكسي الاتجاه'],
  },
  {
    name:'قرفصاء خفيف | Air Squat', duration_seconds:40,
    imageKey:'w-slow-squat', target:'الأرجل · المؤخرة',
    instructions:'١٠ قرفصاءات بطيئة للإحماء',
    steps:['قف مع مسافة الكتفين بين قدميك','أخفض نفسك ببطء حتى تكون الفخذان موازيين للأرض','أبقِ ظهرك مستقيماً والصدر مرتفعاً','ارجع للوقوف ببطء — ١٠ تكرارات'],
    femaleSteps:['قفي مع مسافة الكتفين بين قدميكِ','أخفضي نفسكِ ببطء حتى تكون الفخذان موازيتين للأرض','أبقي ظهركِ مستقيماً والصدر مرتفعاً','ارجعي للوقوف ببطء — ١٠ تكرارات'],
  },
  {
    name:'ركض خفيف | Light March', duration_seconds:60,
    imageKey:'w-march-in-place', target:'الجسم كامل · القلب',
    instructions:'ارفع ركبتيك ببطء في مكانك',
    steps:['قف بوضع مستقيم مع إرخاء الكتفين','ارفع ركبتك اليمنى ببطء حتى مستوى الخصر','بدّل مع الركبة اليسرى بإيقاع هادئ','حرّك ذراعيك بشكل طبيعي مع الحركة'],
    femaleSteps:['قفي بوضع مستقيم مع إرخاء الكتفين','ارفعي ركبتكِ اليمنى ببطء حتى مستوى الخصر','بدّلي مع الركبة اليسرى بإيقاع هادئ','حرّكي ذراعيكِ بشكل طبيعي مع الحركة'],
  },
  {
    name:'مط الجانب | Side Stretch', duration_seconds:30,
    imageKey:null, target:'الجانبين · الظهر',
    instructions:'مدّ يديك للأعلى وانحنِ يميناً ويساراً',
    steps:['قف مستقيماً مع قدمين متباعدتين','ارفع يدك اليمنى للأعلى','انحنِ ببطء نحو اليسار حتى تشعر بالمط','عد واكرر الجانب الآخر — ٣ مرات لكل جانب'],
    femaleSteps:['قفي منتصبةً مع قدمين متباعدتين','ارفعي يدكِ اليمنى للأعلى','انحني ببطء نحو اليسار حتى تحسّي بالمط','عودي وكرّري الجانب الآخر — ٣ مرات لكل جانب'],
  },
]

const COOLDOWN = [
  {
    name:'تمديد البطن | Cobra Stretch', duration_seconds:35,
    imageKey:'w-cat-cow', target:'البطن · الظهر السفلي',
    instructions:'استلقِ وارفع صدرك للأعلى',
    steps:['استلقِ على بطنك مع وضع يديك أسفل كتفيك','ارفع صدرك للأعلى ببطء مع تمديد الظهر','حافظ على الحوض في الأرض','ابقَ ٥ ثوانٍ ثم خفّض واكرر'],
    femaleSteps:['استلقي على بطنكِ مع وضع يديكِ أسفل كتفيكِ','ارفعي صدركِ للأعلى ببطء مع تمديد الظهر','حافظي على الحوض في الأرض','ابقي ٥ ثوانٍ ثم خفّضي وكرّري'],
  },
  {
    name:'تمديد الأرجل | Hamstring Stretch', duration_seconds:35,
    imageKey:'w-pelvic-tilt', target:'أوتار الركبة · الفخذين',
    instructions:'مدّ ساقيك وانحنِ للأمام',
    steps:['اجلس على الأرض مع مد ساقيك للأمام','انحنِ ببطء نحو قدميك دون تقوس الركبة','حافظ على الظهر مستقيماً','ابقَ في هذا الوضع ١٠ ثوانٍ وكرر'],
    femaleSteps:['اجلسي على الأرض مع مدّ ساقيكِ للأمام','انحني ببطء نحو قدميكِ دون تقوّس الركبة','حافظي على الظهر مستقيماً','ابقي في هذا الوضع ١٠ ثوانٍ وكرّري'],
  },
  {
    name:'تمديد الكتفين | Shoulder Stretch', duration_seconds:30,
    imageKey:'w-shoulder-swing', target:'الكتفين · الصدر',
    instructions:'شبّك يديك خلف ظهرك وارفعهما',
    steps:['قف مستقيماً وشبّك أصابع يديك خلف ظهرك','ارفع يديك ببطء حتى تشعر بتمديد في الصدر','أبقِ الذقن مرتفعاً والكتفين متراجعين','ابقَ ١٠ ثوانٍ ثم أرخِ واكرر'],
    femaleSteps:['قفي منتصبةً وشبّكي أصابع يديكِ خلف ظهركِ','ارفعي يديكِ ببطء حتى تحسّي بتمديد في الصدر','أبقي الذقن مرتفعاً والكتفين متراجعين','ابقي ١٠ ثوانٍ ثم أرخي وكرّري'],
  },
  {
    name:'وضع الطفل | Child Pose', duration_seconds:45,
    imageKey:'w-bird-dog', target:'الظهر الكامل · الكتفين',
    instructions:'اجلس على كعبيك ومدّ يديك للأمام',
    steps:['ابدأ في وضع الركوع على ركبتيك','اجلس للخلف على كعبيك','مدّ يديك للأمام واخفض جبهتك للأرض','تنفس ببطء وابقَ في هذا الوضع'],
    femaleSteps:['ابدئي في وضع الركوع على ركبتيكِ','اجلسي للخلف على كعبيكِ','مدّي يديكِ للأمام واخفضي جبهتكِ للأرض','تنفّسي ببطء وابقي في هذا الوضع'],
  },
  {
    name:'تمديد الأرداف | Glute Stretch', duration_seconds:30,
    imageKey:'w-glute-bridge', target:'الأرداف · الوركين',
    instructions:'استلقِ وضع ساقك على ركبتك',
    steps:['استلقِ على ظهرك وثنِ ركبتيك','ضع كاحل ساقك اليمنى على ركبتك اليسرى','شبّك يديك خلف فخذك اليسرى واسحب','ابقَ ١٠ ثوانٍ ثم غيّر الجانب'],
    femaleSteps:['استلقي على ظهركِ وثني ركبتيكِ','ضعي كاحل ساقكِ اليمنى على ركبتكِ اليسرى','شبّكي يديكِ خلف فخذكِ اليسرى واسحبي','ابقي ١٠ ثوانٍ ثم غيّري الجانب'],
  },
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

// ── Exercise metadata: image key + step-by-step instructions ─────────
// Keys are lowercase English substrings that match the English part of "عربي | English" names.
const EXERCISE_META = {
  // ── Core ────────────────────────────────────────────────────────────
  'heel touch':       { imageKey:'h-crunch',
    steps:      ['استلقِ على ظهرك وثنِ ركبتيك مع ثبات القدمين','يداك ممدودتان على جانبي جسمك','شد البطن وانزل يدك اليمنى نحو كعبك الأيمن','ارجع للوسط وكرر اليسار — هذا تكرار واحد'],
    femaleSteps:['استلقي على ظهركِ وثني ركبتيكِ مع ثبات القدمين','يداكِ ممدودتان على جانبي جسمكِ','شدّي البطن وانزلي يدكِ اليمنى نحو كعبكِ الأيمن','ارجعي للوسط وكرّري اليسار — هذا تكرار واحد'] },
  'reverse crunch':   { imageKey:'h-crunch',
    steps:      ['استلقِ مع وضع يديك أسفل الظهر','ثنِ ركبتيك وارفعهما نحو صدرك','ارفع الحوض عن الأرض','انزل ببطء وكرر'],
    femaleSteps:['استلقي مع وضع يديكِ أسفل الظهر','ثني ركبتيكِ وارفعيهما نحو صدركِ','ارفعي الحوض عن الأرض','انزلي ببطء وكرّري'] },
  'side crunch':      { imageKey:'h-crunch',
    steps:      ['استلقِ مع إمالة الركبتين لأحد الجانبين','يد واحدة خلف الرأس والأخرى على البطن','ارفع الجذع نحو الركبة المثنية','انزل ببطء وكرر ثم غيّر الجانب'],
    femaleSteps:['استلقي مع إمالة الركبتين لأحد الجانبين','يد واحدة خلف الرأس والأخرى على البطن','ارفعي الجذع نحو الركبة المثنية','انزلي ببطء وكرّري ثم غيّري الجانب'] },
  'crunch':           { imageKey:'h-crunch',
    steps:      ['استلقِ وثنِ ركبتيك مع وضع يديك خلف رأسك','شد عضلات البطن وارفع الكتفين فقط','لا تشد رقبتك بيديك','انزل ببطء وكرر'],
    femaleSteps:['استلقي وثني ركبتيكِ مع وضع يديكِ خلف رأسكِ','شدّي عضلات البطن وارفعي الكتفين فقط','لا تشدّي رقبتكِ بيديكِ','انزلي ببطء وكرّري'] },
  'bicycle':          { imageKey:'h-bicycle-crunch',
    steps:      ['استلقِ وضع يديك خلف رأسك','ارفع كتفيك عن الأرض','اجلب كوعك الأيمن نحو ركبتك اليسرى','بدّل الجانبين بحركة دراجة منتظمة'],
    femaleSteps:['استلقي وضعي يديكِ خلف رأسكِ','ارفعي كتفيكِ عن الأرض','اجلبي كوعكِ الأيمن نحو ركبتكِ اليسرى','بدّلي الجانبين بحركة دراجة منتظمة'] },
  'v-up':             { imageKey:'h-leg-raise-floor',
    steps:      ['استلقِ مع مد الذراعين للخلف','ارفع ذراعيك وساقيك معاً في نفس الوقت','حاول لمس قدميك بيديك','انزل ببطء وكرر'],
    femaleSteps:['استلقي مع مدّ الذراعين للخلف','ارفعي ذراعيكِ وساقيكِ معاً في نفس الوقت','حاولي لمس قدميكِ بيديكِ','انزلي ببطء وكرّري'] },
  'leg raise':        { imageKey:'h-leg-raise-floor',
    steps:      ['استلقِ على ظهرك مع وضع يديك أسفل الظهر','أبقِ الساقين مستقيمتين ومتلاصقتين','ارفعهما حتى 90 درجة ببطء','انزل ببطء دون لمس الأرض'],
    femaleSteps:['استلقي على ظهركِ مع وضع يديكِ أسفل الظهر','أبقي الساقين مستقيمتين ومتلاصقتين','ارفعيهما حتى 90 درجة ببطء','انزلي ببطء دون لمس الأرض'] },
  'dead bug':         { imageKey:'w-dead-bug',
    steps:      ['استلقِ مع رفع ذراعيك للأعلى','ركبتاك مرفوعتان بزاوية 90 درجة','مدّ ذراعك اليمنى وساقك اليسرى ببطء','عد للبداية وكرر الجانب الآخر'],
    femaleSteps:['استلقي مع رفع ذراعيكِ للأعلى','ركبتاكِ مرفوعتان بزاوية 90 درجة','مدّي ذراعكِ اليمنى وساقكِ اليسرى ببطء','عودي للبداية وكرّري الجانب الآخر'] },
  'mountain climber': { imageKey:'h-mountain-climber',
    steps:      ['ابدأ في وضع البلانك العالي على اليدين','اجلب ركبتك اليمنى بسرعة نحو صدرك','مدّها للخلف وبدّل مع اليسرى','حافظ على ظهر مسطح طوال التمرين'],
    femaleSteps:['ابدئي في وضع البلانك العالي على اليدين','اجلبي ركبتكِ اليمنى بسرعة نحو صدركِ','مدّيها للخلف وبدّلي مع اليسرى','حافظي على ظهر مسطح طوال التمرين'] },
  'side plank':       { imageKey:'h-plank',
    steps:      ['استلقِ على الجانب وارفع جسمك على المرفق','جسمك مستقيم كخط من الرأس للكعبين','شد الجانب وحافظ على التوازن','تنفس بانتظام ولا تنهار الوركين'],
    femaleSteps:['استلقي على الجانب وارفعي جسمكِ على المرفق','جسمكِ مستقيم كخط من الرأس للكعبين','شدّي الجانب وحافظي على التوازن','تنفّسي بانتظام ولا تنهاري الوركين'] },
  'plank':            { imageKey:'h-plank',
    steps:      ['ابدأ على المرفقين أو اليدين','المرفقان أسفل الكتفين مباشرة','جسمك مستقيم من الرأس للكعبين','شد البطن وتنفس بانتظام'],
    femaleSteps:['ابدئي على المرفقين أو اليدين','المرفقان أسفل الكتفين مباشرة','جسمكِ مستقيم من الرأس للكعبين','شدّي البطن وتنفّسي بانتظام'] },
  'russian twist':    { imageKey:'h-russian-twist-home',
    steps:      ['اجلس مع ثني ركبتيك قليلاً ورفع الصدر','أمسك ثقلاً أو شبّك يديك','دوّر الجذع يميناً','دوّر يساراً — هذا تكرار واحد'],
    femaleSteps:['اجلسي مع ثني ركبتيكِ قليلاً ورفع الصدر','أمسكي ثقلاً أو شبّكي يديكِ','دوّري الجذع يميناً','دوّري يساراً — هذا تكرار واحد'] },
  // ── Lower body ──────────────────────────────────────────────────────
  'chair squat':      { imageKey:'h-squat',
    steps:      ['قف أمام كرسي بالقدمين بعرض الكتفين','أخفض نفسك ببطء كأنك ستجلس عليه','الْمس الكرسي بخفة دون أن تجلس تماماً','ادفع بالكعبين وارجع للوقوف'],
    femaleSteps:['قفي أمام كرسي بالقدمين بعرض الكتفين','أخفضي نفسكِ ببطء كأنكِ ستجلسين عليه','المسي الكرسي بخفة دون أن تجلسي تماماً','ادفعي بالكعبين وارجعي للوقوف'] },
  'sumo squat':       { imageKey:'h-squat',
    steps:      ['قف مع تباعد القدمين أكثر من الكتفين','أصابع القدم للخارج بزاوية 45 درجة','أخفض نفسك ببطء مع الظهر المستقيم','اضغط الداخلية والمؤخرة عند الصعود'],
    femaleSteps:['قفي مع تباعد القدمين أكثر من الكتفين','أصابع القدم للخارج بزاوية 45 درجة','أخفضي نفسكِ ببطء مع الظهر المستقيم','اضغطي الداخلية والمؤخرة عند الصعود'] },
  'jump squat':       { imageKey:'h-squat',
    steps:      ['قف مع مسافة الكتفين بين قدميك','انزل في وضع القرفصاء','اقفز للأعلى بقوة','اهبط بلطف على الكعبين مع ثني الركبتين'],
    femaleSteps:['قفي مع مسافة الكتفين بين قدميكِ','انزلي في وضع القرفصاء','اقفزي للأعلى بقوة','اهبطي بلطف على الكعبين مع ثني الركبتين'] },
  'squat':            { imageKey:'h-squat',
    steps:      ['قف مع مسافة الكتفين بين قدميك','أخفض نفسك ببطء حتى تتوازى الفخذان مع الأرض','ركبتاك في اتجاه أصابع القدم','ادفع بالكعبين وارجع للوقوف'],
    femaleSteps:['قفي مع مسافة الكتفين بين قدميكِ','أخفضي نفسكِ ببطء حتى تتوازى الفخذان مع الأرض','ركبتاكِ في اتجاه أصابع القدم','ادفعي بالكعبين وارجعي للوقوف'] },
  'reverse lunge':    { imageKey:'h-lunge',
    steps:      ['قف مستقيماً','اخطُ خطوة كبيرة للخلف','أخفض الركبة الخلفية نحو الأرض','ادفع للأمام وعد ثم غيّر الساق'],
    femaleSteps:['قفي منتصبةً','اخطي خطوة كبيرة للخلف','أخفضي الركبة الخلفية نحو الأرض','ادفعي للأمام وعودي ثم غيّري الساق'] },
  'side lunge':       { imageKey:'h-side-lunge',
    steps:      ['قف مع تباعد القدمين','اخطُ خطوة كبيرة للجانب الأيمن','أخفض نفسك مع إبقاء الساق الأخرى مستقيمة','ادفع وعد ثم كرر اليسار'],
    femaleSteps:['قفي مع تباعد القدمين','اخطي خطوة كبيرة للجانب الأيمن','أخفضي نفسكِ مع إبقاء الساق الأخرى مستقيمة','ادفعي وعودي ثم كرّري اليسار'] },
  'lunge':            { imageKey:'h-lunge',
    steps:      ['قف مستقيماً مع القدمين معاً','اخطُ خطوة كبيرة للأمام بالقدم اليمنى','أخفض الركبة الخلفية نحو الأرض','ادفع بالقدم الأمامية وعد ثم غيّر الجانب'],
    femaleSteps:['قفي منتصبةً مع القدمين معاً','اخطي خطوة كبيرة للأمام بالقدم اليمنى','أخفضي الركبة الخلفية نحو الأرض','ادفعي بالقدم الأمامية وعودي ثم غيّري الجانب'] },
  'single leg bridge':{ imageKey:'h-glute-bridge',
    steps:      ['استلقِ وثنِ ركبتيك','ارفع قدماً واحدة للأعلى','ارفع الحوض بضغط المؤخرة','انزل ببطء وكرر ثم غيّر الساق'],
    femaleSteps:['استلقي وثني ركبتيكِ','ارفعي قدماً واحدة للأعلى','ارفعي الحوض بضغط المؤخرة','انزلي ببطء وكرّري ثم غيّري الساق'] },
  'hip thrust':       { imageKey:'h-glute-bridge',
    steps:      ['ضع كتفيك على سطح مرتفع','ثنِ ركبتيك مع وضع القدمين على الأرض','ارفع الحوض للأعلى باستخدام المؤخرة','اضغط في الأعلى ثم انزل ببطء'],
    femaleSteps:['ضعي كتفيكِ على سطح مرتفع','ثني ركبتيكِ مع وضع القدمين على الأرض','ارفعي الحوض للأعلى باستخدام المؤخرة','اضغطي في الأعلى ثم انزلي ببطء'] },
  'glute bridge':     { imageKey:'h-glute-bridge',
    steps:      ['استلقِ وثنِ ركبتيك مع ثبات القدمين','ارفع الحوض للأعلى بضغط المؤخرة','ثبّت في الأعلى لثانيتين','انزل ببطء وكرر'],
    femaleSteps:['استلقي وثني ركبتيكِ مع ثبات القدمين','ارفعي الحوض للأعلى بضغط المؤخرة','ثبّتي في الأعلى لثانيتين','انزلي ببطء وكرّري'] },
  'clamshell':        { imageKey:'w-glute-bridge',
    steps:      ['استلقِ على جانبك مع ثني الركبتين بزاوية 90°','ضع قدمك على قدمك (متلاصقتان)','ارفع الركبة العليا دون تحريك القدمين','انزل ببطء وكرر ثم غيّر الجانب'],
    femaleSteps:['استلقي على جانبكِ مع ثني الركبتين بزاوية 90°','ضعي قدمكِ على قدمكِ (متلاصقتان)','ارفعي الركبة العليا دون تحريك القدمين','انزلي ببطء وكرّري ثم غيّري الجانب'] },
  'donkey kick':      { imageKey:'h-donkey-kick',
    steps:      ['ابدأ على الأربع (ركبة ويد)','ثبّت الظهر أفقياً','ارفع ساقك للخلف حتى تتوازى مع الظهر','اضغط المؤخرة ثم انزل وكرر'],
    femaleSteps:['ابدئي على الأربع (ركبة ويد)','ثبّتي الظهر أفقياً','ارفعي ساقكِ للخلف حتى تتوازى مع الظهر','اضغطي المؤخرة ثم انزلي وكرّري'] },
  'calf raise':       { imageKey:'h-calf-raise-home',
    steps:      ['قف مع محاذاة القدمين للكتفين','ارفع كعبيك للأعلى ببطء','ثبّت في الأعلى لثانية','انزل ببطء دون لمس الكعب الأرض'],
    femaleSteps:['قفي مع محاذاة القدمين للكتفين','ارفعي كعبيكِ للأعلى ببطء','ثبّتي في الأعلى لثانية','انزلي ببطء دون لمس الكعب الأرض'] },
  'wall sit':         { imageKey:'h-wall-sit',
    steps:      ['قف بظهرك لجدار ثم انزل ببطء','ساقاك بزاوية 90 درجة وفخذاك موازيان للأرض','ظهرك مسطح على الجدار','ثبّت الوضع وتنفس بانتظام'],
    femaleSteps:['قفي بظهركِ لجدار ثم انزلي ببطء','ساقاكِ بزاوية 90 درجة وفخذاكِ موازيان للأرض','ظهركِ مسطح على الجدار','ثبّتي الوضع وتنفّسي بانتظام'] },
  // ── Upper body ──────────────────────────────────────────────────────
  'wall push':        { imageKey:'w-slow-push-up',
    steps:      ['قف أمام الجدار على مسافة ذراع ممدودة','ضع يديك على الجدار بعرض الكتفين','أخفض صدرك ببطء نحو الجدار مع ثني الكوعين','ادفع بقوة وارجع للوضع الأول'],
    femaleSteps:['قفي أمام الجدار على مسافة ذراع ممدودة','ضعي يديكِ على الجدار بعرض الكتفين','أخفضي صدركِ ببطء نحو الجدار مع ثني الكوعين','ادفعي بقوة وارجعي للوضع الأول'] },
  'modified push':    { imageKey:'w-slow-push-up',
    steps:      ['ابدأ على ركبتيك مع وضع يديك أعرض من الكتفين','جسمك من الركبتين للرأس مستقيم','أخفض صدرك ببطء نحو الأرض','ادفع وارجع — مثالي لبناء القوة تدريجياً'],
    femaleSteps:['ابدئي على ركبتيكِ مع وضع يديكِ أعرض من الكتفين','جسمكِ من الركبتين للرأس مستقيم','أخفضي صدركِ ببطء نحو الأرض','ادفعي وارجعي — مثالي لبناء القوة تدريجياً'] },
  'wide push':        { imageKey:'h-wide-push-up',
    steps:      ['يداك أوسع من العرض العادي بشكل ملحوظ','أصابعك للخارج قليلاً','أخفض الصدر ببطء ويركّز على الصدر الخارجي','ادفع وارفع الجسم'],
    femaleSteps:['يداكِ أوسع من العرض العادي بشكل ملحوظ','أصابعكِ للخارج قليلاً','أخفضي الصدر ببطء — يركّز على الصدر الخارجي','ادفعي وارفعي الجسم'] },
  'diamond push':     { imageKey:'h-diamond-push-up',
    steps:      ['يداك تحت الصدر بشكل مثلث (الإبهامان يلتقيان)','أخفض ببطء حتى تلمس الأرض','ركّز على الإحساس في الثلاثي','ادفع وارجع وظهرك مستقيم'],
    femaleSteps:['يداكِ تحت الصدر بشكل مثلث (الإبهامان يلتقيان)','أخفضي ببطء حتى تلمسي الأرض','ركّزي على الإحساس في الثلاثي','ادفعي وارجعي وظهركِ مستقيم'] },
  'decline push':     { imageKey:'h-decline-push-up',
    steps:      ['ضع قدميك على سطح مرتفع (كرسي أو حافة)','يداك على الأرض في وضع البلانك','أخفض صدرك ببطء نحو الأرض','يركّز على الصدر العلوي والكتفين الأمامية'],
    femaleSteps:['ضعي قدميكِ على سطح مرتفع (كرسي أو حافة)','يداكِ على الأرض في وضع البلانك','أخفضي صدركِ ببطء نحو الأرض','يركّز على الصدر العلوي والكتفين الأمامية'] },
  'pike push':        { imageKey:'h-pike-push-up',
    steps:      ['ضع جسمك بشكل V مقلوب (وركيك عاليان)','يداك أعرض من الكتفين قليلاً','أخفض رأسك بين يديك ببطء','ادفع وركّز على الإحساس في الكتفين'],
    femaleSteps:['ضعي جسمكِ بشكل V مقلوب (وركيكِ عاليان)','يداكِ أعرض من الكتفين قليلاً','أخفضي رأسكِ بين يديكِ ببطء','ادفعي وركّزي على الإحساس في الكتفين'] },
  'push up':          { imageKey:'h-push-up',
    steps:      ['ابدأ في وضع البلانك العالي على اليدين','يداك أعرض من الكتفين قليلاً','أخفض صدرك ببطء نحو الأرض','ادفع وارجع مع إبقاء ظهرك مستقيماً'],
    femaleSteps:['ابدئي في وضع البلانك العالي على اليدين','يداكِ أعرض من الكتفين قليلاً','أخفضي صدركِ ببطء نحو الأرض','ادفعي وارجعي مع إبقاء ظهركِ مستقيماً'] },
  'shoulder tap':     { imageKey:'h-shoulder-tap',
    steps:      ['ابدأ في وضع البلانك العالي','البلانك مستقيم وبطنك مشدود','الم يدك اليمنى كتفك الأيسر','بدّل الجانبين بانتظام دون تأرجح الوركين'],
    femaleSteps:['ابدئي في وضع البلانك العالي','البلانك مستقيم وبطنكِ مشدود','المسي يدكِ اليمنى كتفكِ الأيسر','بدّلي الجانبين بانتظام دون تأرجح الوركين'] },
  // ── Back ────────────────────────────────────────────────────────────
  'single superman':  { imageKey:'h-superman',
    steps:      ['استلقِ على بطنك','ارفع ذراعك اليمنى وساقك اليسرى معاً','ثبّت لثانيتين','انزل وكرر الجانب الآخر'],
    femaleSteps:['استلقي على بطنكِ','ارفعي ذراعكِ اليمنى وساقكِ اليسرى معاً','ثبّتي لثانيتين','انزلي وكرّري الجانب الآخر'] },
  'superman':         { imageKey:'h-superman',
    steps:      ['استلقِ على بطنك مع مد الذراعين للأمام','شد عضلات الظهر وارفع ذراعيك وساقيك معاً','ثبّت لثانيتين وشد المؤخرة','انزل ببطء وكرر'],
    femaleSteps:['استلقي على بطنكِ مع مدّ الذراعين للأمام','شدّي عضلات الظهر وارفعي ذراعيكِ وساقيكِ معاً','ثبّتي لثانيتين وشدّي المؤخرة','انزلي ببطء وكرّري'] },
  'bird dog':         { imageKey:'h-bird-dog',
    steps:      ['ابدأ على الأربع (ركبة ويد) مع ظهر مسطح','مدّ ذراعك اليمنى وساقك اليسرى ببطء','حافظ على الظهر مستقيماً وتجنب الالتواء','عد وكرر الجانب الآخر'],
    femaleSteps:['ابدئي على الأربع (ركبة ويد) مع ظهر مسطح','مدّي ذراعكِ اليمنى وساقكِ اليسرى ببطء','حافظي على الظهر مستقيماً وتجنّبي الالتواء','عودي وكرّري الجانب الآخر'] },
  'bear crawl':       { imageKey:'h-bird-dog',
    steps:      ['ابدأ على الأربع ثم ارفع الركبتين عن الأرض','حافظ على ظهر مسطح موازٍ للأرض','تحرّك للأمام بيد وساق معاكسة','حافظ على البطن مشدوداً'],
    femaleSteps:['ابدئي على الأربع ثم ارفعي الركبتين عن الأرض','حافظي على ظهر مسطح موازٍ للأرض','تحرّكي للأمام بيد وساق معاكسة','حافظي على البطن مشدوداً'] },
  'table row':        { imageKey:'h-chair-dip',
    steps:      ['ضع يديك على حافة طاولة ثابتة من الأسفل','جسمك مستقيم وبطنك للأعلى','اسحب صدرك نحو الطاولة','انزل ببطء وكرر'],
    femaleSteps:['ضعي يديكِ على حافة طاولة ثابتة من الأسفل','جسمكِ مستقيم وبطنكِ للأعلى','اسحبي صدركِ نحو الطاولة','انزلي ببطء وكرّري'] },
  // ── Cardio / full body ───────────────────────────────────────────────
  'march in place':   { imageKey:'w-march-in-place',
    steps:      ['قف مستقيماً مع إرخاء الكتفين','ارفع ركبتك اليمنى لمستوى الخصر','انزل وارفع اليسرى بإيقاع ثابت','حرّك ذراعيك بشكل طبيعي مع الحركة'],
    femaleSteps:['قفي منتصبةً مع إرخاء الكتفين','ارفعي ركبتكِ اليمنى لمستوى الخصر','انزلي وارفعي اليسرى بإيقاع ثابت','حرّكي ذراعيكِ بشكل طبيعي مع الحركة'] },
  'high knee':        { imageKey:'w-high-knees',
    steps:      ['قف مستقيماً مع إرخاء الكتفين','ارفع ركبتك اليمنى لمستوى الخصر','بدّل مع الركبة اليسرى بسرعة','حرّك ذراعيك بشكل طبيعي مع الحركة'],
    femaleSteps:['قفي منتصبةً مع إرخاء الكتفين','ارفعي ركبتكِ اليمنى لمستوى الخصر','بدّلي مع الركبة اليسرى بسرعة','حرّكي ذراعيكِ بشكل طبيعي مع الحركة'] },
  'jumping jack':     { imageKey:'h-jumping-jack',
    steps:      ['قف مع القدمين متلاصقتين والذراعين جانباً','اقفز مع فتح القدمين ورفع اليدين للأعلى','اقفز مرة أخرى وعد للوضع الأول','حافظ على إيقاع ثابت ومنتظم'],
    femaleSteps:['قفي مع القدمين متلاصقتين والذراعين جانباً','اقفزي مع فتح القدمين ورفع اليدين للأعلى','اقفزي مرة أخرى وعودي للوضع الأول','حافظي على إيقاع ثابت ومنتظم'] },
  'modified burpee':  { imageKey:'h-burpee',
    steps:      ['قف ثم انزل على يديك ببطء','أخرج ساقيك للخلف (بدون قفز)','أعد ساقيك للأمام','انهض وارفع يديك للأعلى'],
    femaleSteps:['قفي ثم انزلي على يديكِ ببطء','أخرجي ساقيكِ للخلف (بدون قفز)','أعيدي ساقيكِ للأمام','انهضي وارفعي يديكِ للأعلى'] },
  'burpee':           { imageKey:'h-burpee',
    steps:      ['قف ثم اقفز لأسفل على يديك','مدّ ساقيك للخلف لوضع البلانك','اجلب ساقيك للأمام نحو يديك','انهض واقفز للأعلى بقوة'],
    femaleSteps:['قفي ثم اقفزي لأسفل على يديكِ','مدّي ساقيكِ للخلف لوضع البلانك','اجلبي ساقيكِ للأمام نحو يديكِ','انهضي واقفزي للأعلى بقوة'] },
  'deep breathing':   { imageKey:null,
    steps:      ['اجلس أو قف بوضع مريح','خذ نفساً عميقاً من الأنف (4 ثوانٍ)','ثبّت النفس (2 ثانية)','أخرج الهواء ببطء من الفم (6 ثوانٍ)'],
    femaleSteps:['اجلسي أو قفي بوضع مريح','خذي نفساً عميقاً من الأنف (4 ثوانٍ)','ثبّتي النفس (2 ثانية)','أخرجي الهواء ببطء من الفم (6 ثوانٍ)'] },
}

function enrichExercise(ex, sex = 'male') {
  const engPart = (ex.name.split('|')[1] || ex.name).toLowerCase().trim()

  // Try EXERCISE_DB first (single source of truth — includes female steps)
  const dbEntry = DB_BY_ENG.get(engPart)
    || [...DB_BY_ENG.entries()].find(([k]) => engPart.includes(k) || k.includes(engPart))?.[1]
  if (dbEntry) {
    return {
      ...ex,
      imageKey:    dbEntry.id,
      steps:       dbEntry.steps,
      femaleSteps: dbEntry.female?.steps,
    }
  }

  const meta = Object.entries(EXERCISE_META).find(([k]) => engPart.includes(k))?.[1]

  // Keyword-based image fallback for exercises not in EXERCISE_META
  let fallbackImage = null
  if (!meta?.imageKey) {
    if (engPart.includes('squat') || engPart.includes('lunge'))            fallbackImage = 'h-squat'
    else if (engPart.includes('push'))                                      fallbackImage = 'h-push-up'
    else if (engPart.includes('bridge') || engPart.includes('hip thrust')) fallbackImage = 'h-glute-bridge'
    else if (engPart.includes('plank'))                                     fallbackImage = 'h-plank'
    else if (engPart.includes('crunch') || engPart.includes('sit up'))     fallbackImage = 'h-crunch'
    else if (engPart.includes('leg raise') || engPart.includes('raise'))   fallbackImage = 'h-leg-raise-floor'
    else if (engPart.includes('row') || engPart.includes('pull'))          fallbackImage = 'h-bird-dog'
    else if (engPart.includes('kick') || engPart.includes('donkey'))       fallbackImage = 'h-donkey-kick'
    else if (engPart.includes('jump') || engPart.includes('jack'))         fallbackImage = 'h-jumping-jack'
    else if (engPart.includes('march') || engPart.includes('knee'))        fallbackImage = 'w-high-knees'
    else if (engPart.includes('superman') || engPart.includes('back'))     fallbackImage = 'h-superman'
    else if (engPart.includes('stretch') || engPart.includes('twist'))     fallbackImage = 'w-cat-cow'
  }

  // Keyword-based steps fallback for exercises not in EXERCISE_META
  let fallbackSteps = null
  let fallbackFemaleSteps = null
  if (!meta?.steps) {
    if (engPart.includes('squat')) {
      fallbackSteps =      ['قف مع مسافة الكتفين بين قدميك','أخفض نفسك ببطء مع الظهر المستقيم','ركبتاك في اتجاه أصابع القدم','ادفع بالكعبين وارجع للوقوف']
      fallbackFemaleSteps= ['قفي مع مسافة الكتفين بين قدميكِ','أخفضي نفسكِ ببطء مع الظهر المستقيم','ركبتاكِ في اتجاه أصابع القدم','ادفعي بالكعبين وارجعي للوقوف']
    } else if (engPart.includes('push')) {
      fallbackSteps =      ['ابدأ في وضع البلانك على اليدين','يداك بعرض الكتفين','أخفض صدرك ببطء نحو الأرض','ادفع وارجع مع إبقاء ظهرك مستقيماً']
      fallbackFemaleSteps= ['ابدئي في وضع البلانك على اليدين','يداكِ بعرض الكتفين','أخفضي صدركِ ببطء نحو الأرض','ادفعي وارجعي مع إبقاء ظهركِ مستقيماً']
    } else if (engPart.includes('plank')) {
      fallbackSteps =      ['ابدأ على المرفقين أو اليدين','المرفقان أسفل الكتفين مباشرة','جسمك مستقيم من الرأس للكعبين','شد البطن وتنفس بانتظام']
      fallbackFemaleSteps= ['ابدئي على المرفقين أو اليدين','المرفقان أسفل الكتفين مباشرة','جسمكِ مستقيم من الرأس للكعبين','شدّي البطن وتنفّسي بانتظام']
    } else if (engPart.includes('crunch') || engPart.includes('sit up')) {
      fallbackSteps =      ['استلقِ وثنِ ركبتيك مع يديك خلف رأسك برفق','شد عضلات البطن وارفع الكتفين فقط','لا تشد رقبتك بيديك','انزل ببطء وكرر']
      fallbackFemaleSteps= ['استلقي وثني ركبتيكِ مع يديكِ خلف رأسكِ برفق','شدّي عضلات البطن وارفعي الكتفين فقط','لا تشدّي رقبتكِ بيديكِ','انزلي ببطء وكرّري']
    } else if (engPart.includes('lunge')) {
      fallbackSteps =      ['قف مستقيماً','اخطُ خطوة كبيرة للأمام','أخفض الركبة الخلفية نحو الأرض','ادفع وارجع ثم غيّر الجانب']
      fallbackFemaleSteps= ['قفي منتصبةً','اخطي خطوة كبيرة للأمام','أخفضي الركبة الخلفية نحو الأرض','ادفعي وعودي ثم غيّري الجانب']
    } else if (engPart.includes('bridge') || engPart.includes('glute')) {
      fallbackSteps =      ['استلقِ وثنِ ركبتيك مع ثبات القدمين','ارفع الحوض للأعلى بضغط المؤخرة','ثبّت لثانيتين','انزل ببطء وكرر']
      fallbackFemaleSteps= ['استلقي وثني ركبتيكِ مع ثبات القدمين','ارفعي الحوض للأعلى بضغط المؤخرة','ثبّتي لثانيتين','انزلي ببطء وكرّري']
    } else if (engPart.includes('stretch') || engPart.includes('hold')) {
      fallbackSteps =      ['ضع جسمك في وضع التمديد','تنفس بعمق وأرخِ العضلة','ثبّت الوضع طوال المدة المحددة','انزل ببطء وتنفس بانتظام']
      fallbackFemaleSteps= ['ضعي جسمكِ في وضع التمديد','تنفّسي بعمق وأرخي العضلة','ثبّتي الوضع طوال المدة المحددة','انزلي ببطء وتنفّسي بانتظام']
    } else {
      fallbackSteps =      ['جهّز نفسك وتنفس بانتظام','تحكم بالحركة ولا تتسرع','ركّز على الإحساس في العضلة المستهدفة','أنهِ العدد المطلوب بشكل صحيح']
      fallbackFemaleSteps= ['جهّزي نفسكِ وتنفّسي بانتظام','تحكّمي بالحركة ولا تتسرّعي','ركّزي على الإحساس في العضلة المستهدفة','أنهي العدد المطلوب بشكل صحيح']
    }
  }

  return {
    ...ex,
    imageKey:    meta?.imageKey    ?? fallbackImage,
    steps:       meta?.steps       ?? fallbackSteps,
    femaleSteps: meta?.femaleSteps ?? fallbackFemaleSteps,
  }
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

  // ── Level filter: weeks 1-2 beginners only get beginner-tagged exercises ──
  if (fitnessLevel === 'beginner' && weekNum <= 2) {
    const beginnerPool = exercisePool.filter(ex => !ex.level || ex.level === 'beginner')
    if (beginnerPool.length >= 2) exercisePool = beginnerPool
  }

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

  const exercises = rotatedPool.slice(0, maxExercises).map(ex => enrichExercise({
    ...ex,
    muscle: muscles[0] || 'البطن',
    sets: Math.max(1, Math.round(ex.sets * setsMultiplier)),
    reps: adjustReps(ex.reps, repsVariant, energyLevel),
  }, sex))

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
    sex,
    v: 8, // bump when workout structure changes — triggers cache bust in frontend
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
    // Merge: freshProfile wins for non-null values; client profile fills any gaps
    const mergedProfile = {
      ...profile,
      ...freshProfile,
      sex: freshProfile?.sex || profile?.sex || 'male',
    }

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
