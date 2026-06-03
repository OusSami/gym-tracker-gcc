/**
 * US Navy Body Fat Formula
 * Accurate to ±3% — no photo required
 * All inputs in centimeters, height in cm
 */

/**
 * @param {Object} p
 * @param {number} p.waist   - waist at navel (cm)
 * @param {number} p.neck    - just below larynx (cm)
 * @param {number} p.hips    - widest point, women only (cm)
 * @param {number} p.height  - standing height (cm)
 * @param {'male'|'female'} p.sex
 * @param {number} p.weight  - kg
 * @returns {{ bf: number, lean: number, fat: number, category: string, categoryAr: string, color: string }}
 */
export function calcBodyFat({ waist, neck, hips, height, sex, weight }) {
  let bf
  if (sex === 'male') {
    bf = 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(height) + 36.76
  } else {
    bf = 163.205 * Math.log10(waist + hips - neck) - 97.684 * Math.log10(height) - 78.387
  }
  bf = Math.max(3, Math.min(60, Math.round(bf * 10) / 10))
  const fat  = Math.round(weight * bf / 100 * 10) / 10
  const lean = Math.round((weight - fat) * 10) / 10

  const { cat, catAr, color } = getCategory(bf, sex)
  return { bf, lean, fat, category: cat, categoryAr: catAr, color }
}

function getCategory(bf, sex) {
  if (sex === 'male') {
    if (bf < 6)  return { cat: 'Essential',   catAr: 'دهون أساسية',    color: '#3b82f6' }
    if (bf < 14) return { cat: 'Athletes',    catAr: 'مستوى رياضي',    color: '#22c55e' }
    if (bf < 18) return { cat: 'Fitness',     catAr: 'مستوى لياقة',    color: '#CBA23B' }
    if (bf < 25) return { cat: 'Acceptable',  catAr: 'مقبول',          color: '#f97316' }
    return              { cat: 'Obese',       catAr: 'زيادة دهون',      color: '#ef4444' }
  } else {
    if (bf < 14) return { cat: 'Essential',   catAr: 'دهون أساسية',    color: '#3b82f6' }
    if (bf < 21) return { cat: 'Athletes',    catAr: 'مستوى رياضي',    color: '#22c55e' }
    if (bf < 25) return { cat: 'Fitness',     catAr: 'مستوى لياقة',    color: '#CBA23B' }
    if (bf < 32) return { cat: 'Acceptable',  catAr: 'مقبول',          color: '#f97316' }
    return              { cat: 'Obese',       catAr: 'زيادة دهون',      color: '#ef4444' }
  }
}

/**
 * Package recommendation based on BF%, goal, level
 */
export function recommendPackage({ bf, goal, level, sex }) {
  // Beginners always start with foundations
  if (level === 'مبتدئ - بدأت مؤخراً' || level === 'beginner') {
    return {
      id: 'foundations_21',
      name: 'باقة الأساسيات',
      days: 21,
      description: 'نبني الأساس الصح أولاً — تمرين وتغذية وعادة يومية.',
      focus: 'البداية الصحيحة',
      intensity: 'خفيف إلى متوسط',
      color: '#3b82f6',
      icon: '🏗️',
      why: 'مستواك الحالي يتطلب بناء الأساس قبل أي برنامج متخصص.'
    }
  }

  const highBF = sex === 'male' ? bf > 20 : bf > 28
  const lowBF  = sex === 'male' ? bf < 12 : bf < 18

  if (goal === 'أبي أبني عضل أكثر' || goal === 'muscle') {
    if (highBF) return {
      id: 'cut_then_build_21',
      name: 'باقة حرق وبناء',
      days: 21, description: 'نخفض الدهون أولاً ثم نبني العضلات — النسب الحالية تتطلب ذلك.',
      focus: 'تعريف + قوة', intensity: 'عالي', color: '#f97316', icon: '🔥',
      why: `نسبة دهونك ${bf}% — نخفضها أولاً لتظهر العضلات بشكل أوضح.`
    }
    return {
      id: 'muscle_build_21',
      name: 'باقة بناء الكتلة',
      days: 21, description: 'برنامج مخصص لزيادة الكتلة العضلية مع التحكم في الدهون.',
      focus: 'حجم + قوة', intensity: 'عالي', color: '#CBA23B', icon: '💪',
      why: `نسبة دهونك ${bf}% مثالية لبناء العضلات الآن.`
    }
  }

  if (goal === 'أبي أنزل دهون وأشد جسمي' || goal === 'weight') {
    if (highBF) return {
      id: 'fat_loss_30',
      name: 'باقة التحول الجذري',
      days: 30, description: 'برنامج حرق دهون مكثف مع الحفاظ على الكتلة العضلية.',
      focus: 'حرق دهون', intensity: 'عالي إلى متوسط', color: '#ef4444', icon: '🔥',
      why: `نسبة دهونك ${bf}% — 30 يوم لنتيجة حقيقية وملموسة.`
    }
    return {
      id: 'shred_21',
      name: 'باقة التعريف',
      days: 21, description: 'تعريف الجسم وشد العضلات مع حرق الدهون الزائدة.',
      focus: 'تعريف + شد', intensity: 'متوسط إلى عالي', color: '#22c55e', icon: '⚡',
      why: `نسبة دهونك ${bf}% — مثالي لبرنامج التعريف.`
    }
  }

  if (goal === 'أبي أزيد قوتي وأرفع أكثر' || goal === 'strength') {
    return {
      id: 'strength_21',
      name: 'باقة القوة',
      days: 21, description: 'رفع أثقال، تكرارات منخفضة، حمل تصاعدي. نتيجة مضمونة.',
      focus: 'قوة + أداء', intensity: 'عالي', color: '#a855f7', icon: '🏋️',
      why: 'هدفك واضح — نبني القوة من الأساس بشكل منهجي.'
    }
  }

  if (goal === 'أبي أرفع تحملي وأداءي' || goal === 'endurance') {
    return {
      id: 'endurance_21',
      name: 'باقة التحمل',
      days: 21, description: 'بناء اللياقة القلبية والتحمل العضلي. جسم لا يتعب.',
      focus: 'تحمل + لياقة قلبية', intensity: 'متوسط', color: '#06b6d4', icon: '❤️',
      why: 'تحسين التحمل يتطلب تدرجاً ومنهجية — وهذا بالضبط ما نبنيه.'
    }
  }

  // Default
  return {
    id: 'general_fitness_21',
    name: 'باقة اللياقة الشاملة',
    days: 21, description: 'برنامج متوازن يجمع القوة والتحمل والتغذية الصحيحة.',
    focus: 'لياقة شاملة', intensity: 'متوسط', color: '#CBA23B', icon: '⚡',
    why: 'برنامج متوازن يناسب هدفك الحالي.'
  }
}
