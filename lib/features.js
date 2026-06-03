/**
 * GYM TRACKER GCC — Feature Flag System
 * Change one line to lock/unlock any feature.
 * 'free' | 'premium' | 'coming_soon'
 */
export const FEATURES = {
  // ── FREE FOREVER ─────────────────────────────────────
  workout_tracking:    'free',
  exercise_library:    'free',
  meal_logging:        'free',
  weight_tracking:     'free',
  templates:           'free',
  basic_dashboard:     'free',

  // ── PREMIUM (subscription) ───────────────────────────
  packages:            'premium',
  ai_programs:         'premium',
  ai_meal_plans:       'premium',
  body_analysis:       'free',       // free now → can lock later
  advanced_analytics:  'premium',
  coach_chat:          'premium',
  ramadan_pack:        'premium',

  // ── COMING SOON ──────────────────────────────────────
  community:           'coming_soon',
  referral:            'coming_soon',
}

export const FEATURE_LABELS = {
  packages:           'الباقات والبرامج',
  ai_programs:        'البرامج التكيفية',
  ai_meal_plans:      'خطط التغذية الذكية',
  body_analysis:      'تحليل الجسم',
  advanced_analytics: 'التحليل المتقدم',
  coach_chat:         'المدرب الذكي',
  ramadan_pack:       'باقة رمضان',
  community:          'المجتمع',
  referral:           'نظام الإحالة',
}
