/**
 * Deep muscle taxonomy — GCC Arabic display
 * Keys stay English for DB compatibility; display is full Arabic
 */
export const MUSCLE_TREE = {
  Chest: {
    color: '#ef4444', icon: '🫁',
    label: 'الصدر',
    subs: ['Upper Chest', 'Mid Chest', 'Lower Chest', 'Inner Chest'],
    subLabels: { 'Upper Chest':'الصدر العلوي', 'Mid Chest':'الصدر الأوسط', 'Lower Chest':'الصدر السفلي', 'Inner Chest':'الصدر الداخلي' }
  },
  Back: {
    color: '#3b82f6', icon: '🔙',
    label: 'الظهر',
    subs: ['Lats', 'Upper Traps', 'Middle Traps', 'Lower Traps', 'Rhomboids', 'Erector Spinae', 'Teres Major'],
    subLabels: { 'Lats':'العضلة العريضة', 'Upper Traps':'شبه المنحرف العلوي', 'Middle Traps':'شبه المنحرف الأوسط', 'Lower Traps':'شبه المنحرف السفلي', 'Rhomboids':'المعيني', 'Erector Spinae':'باسطة العمود الفقري', 'Teres Major':'المدور الكبير' }
  },
  Shoulders: {
    color: '#a855f7', icon: '💪',
    label: 'الأكتاف',
    subs: ['Front Delts', 'Side Delts', 'Rear Delts', 'Rotator Cuff'],
    subLabels: { 'Front Delts':'الدالية الأمامية', 'Side Delts':'الدالية الجانبية', 'Rear Delts':'الدالية الخلفية', 'Rotator Cuff':'الكفة المدوّرة' }
  },
  Arms: {
    color: '#f97316', icon: '💪',
    label: 'الأذرع',
    subs: ['Biceps', 'Triceps', 'Forearms', 'Brachialis', 'Brachioradialis'],
    subLabels: { 'Biceps':'الثنائي', 'Triceps':'الثلاثي', 'Forearms':'الساعد', 'Brachialis':'العضدي', 'Brachioradialis':'العضدي الكعبري' }
  },
  Legs: {
    color: '#22c55e', icon: '🦵',
    label: 'الأرجل',
    subs: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Hip Flexors', 'Adductors', 'Abductors'],
    subLabels: { 'Quads':'الفخذ الأمامي', 'Hamstrings':'أوتار الركبة', 'Glutes':'الأرداف', 'Calves':'الساق', 'Hip Flexors':'قابض الورك', 'Adductors':'مقرّب الفخذ', 'Abductors':'مبعّد الفخذ' }
  },
  Core: {
    color: '#eab308', icon: '🔥',
    label: 'البطن والجذع',
    subs: ['Abs', 'Obliques', 'Lower Back', 'Transverse Abdominis', 'Hip Flexors'],
    subLabels: { 'Abs':'عضلات البطن', 'Obliques':'المائلة', 'Lower Back':'أسفل الظهر', 'Transverse Abdominis':'العضلة المستعرضة', 'Hip Flexors':'قابض الورك' }
  },
  Cardio: {
    color: '#06b6d4', icon: '❤️',
    label: 'الكارديو',
    subs: ['HIIT', 'Steady State', 'Intervals', 'Circuit'],
    subLabels: { 'HIIT':'تمرين متقطع عالي الشدة', 'Steady State':'كارديو ثابت', 'Intervals':'فترات', 'Circuit':'دائري' }
  },
}

export const ALL_MUSCLES_FLAT = Object.entries(MUSCLE_TREE).flatMap(([main, { subs }]) => [
  main,
  ...subs.map(s => `${main} › ${s}`)
])

export const getMuscleGroup = (muscle) => {
  if (!muscle) return 'Other'
  const base = muscle.split(' › ')[0]
  return MUSCLE_TREE[base] ? base : muscle
}

export const getMuscleColor = (muscle) => {
  if (!muscle) return '#6b7280'
  const group = getMuscleGroup(muscle)
  return MUSCLE_TREE[group]?.color || '#6b7280'
}

// Returns Arabic display label for any muscle key
export const displayMuscle = (muscle) => {
  if (!muscle) return ''
  const parts = muscle.split(' › ')
  const group = parts[0]
  const sub = parts[1]
  if (sub) {
    return MUSCLE_TREE[group]?.subLabels?.[sub] || sub
  }
  return MUSCLE_TREE[group]?.label || group
}

export const MUSCLE_ALIASES = {
  'Anterior Deltoid':'Front Delts','Anterior Delt':'Front Delts','Front Deltoid':'Front Delts','Front Delt':'Front Delts',
  'Lateral Deltoid':'Side Delts','Lateral Delt':'Side Delts','Medial Deltoid':'Side Delts','Medial Delt':'Side Delts',
  'Middle Delt':'Side Delts','Middle Deltoid':'Side Delts','Deltoid':'Side Delts','Delts':'Side Delts',
  'Posterior Deltoid':'Rear Delts','Posterior Delt':'Rear Delts','Rear Deltoid':'Rear Delts','Rear Delt':'Rear Delts',
  'Shoulder':'Side Delts',
  'Pectoralis Major':'Mid Chest','Pectoralis Minor':'Upper Chest','Pec':'Mid Chest','Pecs':'Mid Chest',
  'Upper Pec':'Upper Chest','Upper Pecs':'Upper Chest','Upper Pectoralis':'Upper Chest','Clavicular Head':'Upper Chest',
  'Sternal Head':'Mid Chest','Lower Pec':'Lower Chest','Lower Pecs':'Lower Chest','Lower Pectoralis':'Lower Chest',
  'Inner Pec':'Inner Chest','Inner Pecs':'Inner Chest','Chest':'Mid Chest',
  'Latissimus Dorsi':'Lats','Lat':'Lats','Latissimus':'Lats',
  'Trapezius':'Upper Traps','Trap':'Upper Traps','Traps':'Upper Traps','Upper Trapezius':'Upper Traps',
  'Middle Trapezius':'Middle Traps','Mid Traps':'Middle Traps','Lower Trapezius':'Lower Traps',
  'Rhomboid':'Rhomboids','Rhomboid Major':'Rhomboids','Rhomboid Minor':'Rhomboids',
  'Erector':'Erector Spinae','Spinal Erectors':'Erector Spinae','Lower Back':'Erector Spinae',
  'Teres':'Teres Major','Teres Minor':'Teres Major',
  'Biceps Brachii':'Biceps','Bicep':'Biceps','Triceps Brachii':'Triceps','Tricep':'Triceps',
  'Long Head Biceps':'Biceps','Short Head Biceps':'Biceps',
  'Long Head Triceps':'Triceps','Lateral Head Triceps':'Triceps','Medial Head Triceps':'Triceps',
  'Triceps Brachii (Lateral Head)':'Triceps','Triceps Brachii (Long Head)':'Triceps','Triceps Brachii (Medial Head)':'Triceps',
  'Forearm':'Forearms','Forearm Flexors':'Forearms','Forearm Extensors':'Forearms',
  'Wrist Flexors':'Forearms','Wrist Extensors':'Forearms',
  'Quadriceps':'Quads','Quad':'Quads','Vastus Lateralis':'Quads','Vastus Medialis':'Quads',
  'Rectus Femoris':'Quads','Vastus Intermedius':'Quads',
  'Hamstring':'Hamstrings','Biceps Femoris':'Hamstrings','Semitendinosus':'Hamstrings','Semimembranosus':'Hamstrings',
  'Gluteus Maximus':'Glutes','Gluteus Medius':'Glutes','Gluteus Minimus':'Glutes','Glute':'Glutes',
  'Gastrocnemius':'Calves','Soleus':'Calves','Calf':'Calves','Gastrocnemius/Soleus':'Calves',
  'Hip Flexor':'Hip Flexors','Iliopsoas':'Hip Flexors','Psoas':'Hip Flexors',
  'Adductor':'Adductors','Adductor Magnus':'Adductors','Inner Thigh':'Adductors',
  'Abductor':'Abductors','Outer Thigh':'Abductors',
  'Rectus Abdominis':'Abs','Ab':'Abs','Six Pack':'Abs',
  'Oblique':'Obliques','Internal Oblique':'Obliques','External Oblique':'Obliques',
  'TVA':'Transverse Abdominis',
}

export const normalizeMuscle = (raw) => {
  if (!raw) return raw
  const str = String(raw).trim()
  if (str.includes(' › ')) {
    const parts = str.split(' › ')
    const sub = parts[parts.length - 1].trim()
    return normalizeMuscle(sub)
  }
  if (MUSCLE_ALIASES[str]) return MUSCLE_ALIASES[str]
  const lower = str.toLowerCase()
  const aliasKey = Object.keys(MUSCLE_ALIASES).find(k => k.toLowerCase() === lower)
  if (aliasKey) return MUSCLE_ALIASES[aliasKey]
  const allSubs = Object.values(MUSCLE_TREE).flatMap(g => g.subs)
  if (allSubs.includes(str)) return str
  const subMatch = allSubs.find(s => s.toLowerCase() === lower)
  if (subMatch) return subMatch
  if (MUSCLE_TREE[str]) return str
  const groupMatch = Object.keys(MUSCLE_TREE).find(k => k.toLowerCase() === lower)
  if (groupMatch) return groupMatch
  return str
}
