/**
 * Adaptation Engine — reads real performance data, produces ActionSignal
 * Pure local logic — no AI, no network, instant
 */

// Exercises to remove per health condition
export const HEALTH_EXERCISE_FILTERS = {
  'knee_pain':     ['squat','lunge','jump','burpee','kick','step'],
  'back_pain':     ['crunch','sit_up','deadlift','leg_raise','superman'],
  'shoulder_pain': ['push_up','overhead','press','shoulder'],
  'heart':         [], // handled at risk_level — program blocked
  'hypertension':  ['burpee','jump','high_intensity'],
  'diabetes':      [], // handled in meals, not exercises
  'pregnancy':     [], // blocked at risk_level
  'asthma':        ['burpee','jump','high_intensity','sprint'],
}

export const HEALTH_RISK_LEVEL = {
  'heart':      'blocked',
  'pregnancy':  'blocked',
  'hypertension': 'moderate',
  'diabetes':   'moderate',
  'knee_pain':  'moderate',
  'back_pain':  'moderate',
  'shoulder_pain': 'low',
  'asthma':     'low',
}

/**
 * Calculate compliance rate from actual_logs
 */
function calcCompliance(actualLogs) {
  if (!actualLogs?.length) return null
  let actual = 0, target = 0
  actualLogs.forEach(ex => {
    const t = parseInt(ex.targetReps?.split('-')[0] || 10)
    ex.sets?.forEach(s => { actual += s.reps || 0; target += t })
  })
  return target > 0 ? Math.round((actual / target) * 100) : null
}

/**
 * Main adaptation analysis
 * @param {Array} recentDays - last 5 program_days records
 * @param {Array} healthConditions - from profile.health_conditions
 * @returns AdaptationSignal
 */
export function analyzePerformance(recentDays = [], healthConditions = []) {
  // Compliance over recent days
  const complianceScores = recentDays
    .filter(d => d.actual_logs)
    .map(d => calcCompliance(d.actual_logs))
    .filter(Boolean)

  const avgCompliance = complianceScores.length
    ? Math.round(complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length)
    : null

  // Missed days
  const missedDays = recentDays.filter(d => d.checkin_status === 'missed').length
  const missedRate  = recentDays.length > 0 ? missedDays / recentDays.length : 0

  // Pain flags from incomplete reasons
  const painFlags = []
  recentDays.forEach(d => {
    const analysis = d.incomplete_reason?.ai_analysis
    if (analysis?.body_part) painFlags.push(analysis.body_part)
    if (analysis?.remove_exercises) painFlags.push(...analysis.remove_exercises)
  })

  // Exercises to block from health conditions
  const blockedKeywords = []
  healthConditions.forEach(cond => {
    const filters = HEALTH_EXERCISE_FILTERS[cond] || []
    blockedKeywords.push(...filters)
  })

  // Determine adaptation level
  let level = 'same'
  let intensityMod = 0    // -2 to +2
  let repsMod = 0          // percentage modifier
  let extensionDays = 0
  let reason = ''

  if (missedRate >= 0.6) {
    level = 'recovery'
    intensityMod = -2
    repsMod = -0.3
    extensionDays = Math.min(missedDays, 3)
    reason = 'غياب متكرر — جلسة تعافٍ تدريجية'
  } else if (avgCompliance !== null && avgCompliance < 60) {
    level = 'easier'
    intensityMod = -1
    repsMod = -0.2
    extensionDays = 1
    reason = `الأداء ${avgCompliance}% من الهدف — نعدّل الشدة`
  } else if (avgCompliance !== null && avgCompliance >= 95 && missedRate === 0) {
    level = 'harder'
    intensityMod = 1
    repsMod = 0.1
    extensionDays = 0
    reason = `أداء ${avgCompliance}% — جاهز للمستوى الجاي`
  } else {
    reason = avgCompliance ? `الأداء ${avgCompliance}% — استمر` : 'استمر على نفس المستوى'
  }

  return {
    level,
    intensityMod,
    repsMod,
    extensionDays,
    reason,
    avgCompliance,
    missedDays,
    painFlags: [...new Set(painFlags)],
    blockedKeywords: [...new Set(blockedKeywords)],
  }
}

/**
 * Apply adaptation signal to a workout's exercises
 */
export function applyAdaptation(exercises, signal, healthConditions = []) {
  if (!exercises?.length || !signal) return exercises

  return exercises
    // Remove blocked exercises
    .filter(ex => {
      const name = ex.name?.toLowerCase() || ''
      return !signal.blockedKeywords.some(kw => name.includes(kw))
        && !signal.painFlags.some(kw => name.includes(kw))
    })
    // Adjust sets/reps
    .map(ex => {
      if (signal.level === 'same') return ex
      const newSets = Math.max(1, Math.round(ex.sets * (1 + signal.intensityMod * 0.1)))
      const baseReps = parseInt(ex.reps?.split('-')[0] || 10)
      const newReps  = Math.max(5, Math.round(baseReps * (1 + signal.repsMod)))
      return {
        ...ex,
        sets: newSets,
        reps: signal.level === 'harder'
          ? `${newReps}-${newReps + 4}`
          : signal.level === 'easier' || signal.level === 'recovery'
            ? `${newReps}-${newReps + 3}`
            : ex.reps
      }
    })
}

/**
 * Meal plan modifications for health conditions
 */
export function getMealFilters(healthConditions = []) {
  const filters = {
    avoidCategories: [],
    preferCategories: [],
    maxSodiumMg: null,
    maxSugarG: null,
    minFiberG: null,
    note: null,
  }

  if (healthConditions.includes('diabetes')) {
    filters.avoidCategories.push('حلويات')
    filters.maxSugarG = 10
    filters.preferCategories.push('بروتين', 'خضار', 'بقوليات')
    filters.note = 'وجبات منخفضة السكر ومتوازنة لمرضى السكري'
  }

  if (healthConditions.includes('cholesterol')) {
    filters.avoidCategories.push('وجبات سريعة')
    filters.preferCategories.push('سمك', 'خضار', 'مكسرات')
    filters.note = 'تقليل الدهون المشبعة وزيادة الألياف والأوميغا-3'
  }

  if (healthConditions.includes('hypertension')) {
    filters.maxSodiumMg = 600
    filters.preferCategories.push('خضار', 'فواكه')
    filters.note = 'صوديوم منخفض — ابتعد عن الأكل المالح والمعلب'
  }

  return filters
}
