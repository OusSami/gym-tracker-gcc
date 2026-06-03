/**
 * Gender-aware content library
 * Usage: getContent(sex) where sex = 'male' | 'female'
 */

const CONTENT = {
  goals: {
    male: [
      { id:'muscle',    icon:'💪', label:'زيادة الكتلة العضلية',      sub:'بناء عضل واضح ومتناسق' },
      { id:'weight',    icon:'🔥', label:'خفض نسبة الدهون',           sub:'حرق الدهون وتعريف الجسم' },
      { id:'strength',  icon:'🏋️', label:'زيادة القوة',               sub:'ارفع أكثر وأنجز أكثر' },
      { id:'endurance', icon:'⚡', label:'تحسين الأداء الرياضي',      sub:'تحمل أعلى وكفاءة أفضل' },
      { id:'general',   icon:'🌿', label:'نمط حياة صحي',              sub:'توازن وصحة شاملة' },
    ],
    female: [
      { id:'general',   icon:'✨', label:'تحسين القوام',               sub:'جسم ممشوق ومتناسق' },
      { id:'weight',    icon:'💖', label:'خسارة الدهون',               sub:'حرق دهون بطريقة صحية' },
      { id:'muscle',    icon:'🌿', label:'نمط حياة صحي',              sub:'توازن وصحة شاملة' },
      { id:'strength',  icon:'💪', label:'جسم أقوى وأكثر نشاطاً',    sub:'قوة وحيوية كل يوم' },
    ],
  },

  bodyAnalysis: {
    male:   'شوف نقاط القوة وفرص التطور.',
    female: 'تعرّفي على جسمكِ بشكل أفضل وتابعي تقدمكِ.',
  },

  achievements: {
    male: [
      { icon:'🔥', text:'30 يوم من الالتزام' },
      { icon:'🔥', text:'قوة أكبر' },
      { icon:'🔥', text:'تقدم واضح' },
    ],
    female: [
      { icon:'🌸', text:'30 يوم من الاستمرار' },
      { icon:'🌸', text:'خطوة جديدة نحو هدفك' },
      { icon:'🌸', text:'تقدم يستحق الفخر' },
    ],
  },

  // Home screen Islamic phrases — { ar: Quranic text, male: subtitle, female: subtitle }
  homePhrases: [
    {
      ar:     'وَأَنْ لَيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَى',
      male:   'جهدك اليوم يصنع نتيجة الغد بمشيئة الله.',
      female: 'كل خطوة اليوم تقربكِ من هدفكِ بإذن الله.',
    },
    {
      ar:     'فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللَّهِ',
      male:   'استعن بالله... ثم ابذل السبب.',
      female: 'ابدئي بخطوة، وتوكلي على الله.',
    },
    {
      ar:     'وَقُلِ اعْمَلُوا فَسَيَرَى اللَّهُ عَمَلَكُمْ',
      male:   'ابدأ العمل واترك النتائج لله.',
      female: 'اعملي اليوم، واتركي النتائج لله.',
    },
    {
      ar:     'أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
      male:   'الاستمرار هو سر النتيجة.',
      female: 'الاستمرار هو سر التقدم.',
    },
  ],

  // Workout start phrases
  workoutStart: [
    {
      ar:     'المُؤْمِنُ القَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللهِ مِنَ المُؤْمِنِ الضَّعِيفِ',
      male:   'قوِّ عزيمتك وسمِّ الله وابدأ.',
      female: 'قوِّ عزيمتكِ وسمِّ الله وابدئي.',
    },
    {
      ar:     'بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ',
      male:   'ابدأ تمرينك باسم الله.',
      female: 'ابدئي تمرينكِ باسم الله.',
    },
    {
      ar:     'احْرِصْ عَلَى مَا يَنْفَعُكَ وَاسْتَعِنْ بِاللهِ',
      male:   'ابدأ تمرينك وخذ بالأسباب.',
      female: 'ابدئي تمرينكِ وخذي بالأسباب.',
    },
  ],

  // Progress screen phrases
  progressPhrases: [
    {
      ar:     'أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
      male:   'الاستمرار هو سر النتيجة.',
      female: 'الاستمرار هو سر التقدم.',
    },
    {
      ar:     'مَنْ جَدَّ وَجَدَ، وَمَنْ صَبَرَ ظَفَرَ',
      male:   'الإنجاز يبدأ بالالتزام.',
      female: 'كل إنجاز يبدأ بالاستمرار.',
    },
    {
      ar:     'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ',
      male:   'اصبر على الطريق... فالنتائج تحتاج وقت.',
      female: 'اصبري على الطريق... فالنتائج تحتاج وقت.',
    },
  ],

  // Nutrition screen phrases
  nutritionPhrases: [
    {
      ar:     'اجْعَلْ سَعْيَكَ لِلهِ وَالنَّتِيجَةُ تَأْتِي بِإِذْنِ اللهِ',
      male:   'بِسْمِ اللَّهِ، توكلنا على الله.',
      female: 'بِسْمِ اللَّهِ، توكلنا على الله.',
    },
    {
      ar:     'احْرِصْ عَلَى مَا يَنْفَعُكَ وَاسْتَعِنْ بِاللهِ',
      male:   'اختر ما ينفعك وخذ بالأسباب.',
      female: 'اختاري ما ينفعكِ وخذي بالأسباب.',
    },
  ],
}

/**
 * Returns gender-appropriate content
 * @param {'male'|'female'} sex
 */
export function getContent(sex) {
  const s = sex === 'female' ? 'female' : 'male'
  return {
    goals:            CONTENT.goals[s],
    bodyAnalysis:     CONTENT.bodyAnalysis[s],
    achievements:     CONTENT.achievements[s],
    homePhrases:      CONTENT.homePhrases.map(p => ({ ar: p.ar, sub: p[s] })),
    workoutStart:     CONTENT.workoutStart.map(p => ({ ar: p.ar, sub: p[s] })),
    progressPhrases:  CONTENT.progressPhrases.map(p => ({ ar: p.ar, sub: p[s] })),
    nutritionPhrases: CONTENT.nutritionPhrases.map(p => ({ ar: p.ar, sub: p[s] })),
  }
}

/**
 * Random phrase from array with day-based seed (consistent per day)
 */
export function getDailyPhrase(phrases) {
  const seed = Math.floor(Date.now() / 86400000)
  return phrases[seed % phrases.length]
}
