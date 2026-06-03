import { supabaseAdmin } from '../../lib/supabase'

const GEMINI_KEY = process.env.GEMINI_API_KEY

function getPeriodKey(type, from) {
  const d = new Date(from + 'T12:00:00')
  if (type === 'week') return from
  if (type === 'month') return from.slice(0, 7)
  if (type === 'quarter') {
    const q = Math.floor(d.getMonth() / 3) + 1
    return `${d.getFullYear()}-Q${q}`
  }
  if (type === 'halfyear') return `${d.getFullYear()}-H${d.getMonth() < 6 ? 1 : 2}`
  if (type === 'year') return String(d.getFullYear())
  if (type === 'alltime') return 'alltime'
  return from // custom
}

export default async function handler(req, res) {
  const sb = supabaseAdmin()

  if (req.method === 'GET') {
    const { userId, periodType, periodKey } = req.query
    if (!userId) return res.status(400).json({ error: 'Missing userId' })
    let q = sb.from('analysis_reports').select('*').eq('user_id', userId)
    if (periodType) q = q.eq('period_type', periodType)
    if (periodKey) q = q.eq('period_key', periodKey)
    q = q.order('generated_at', { ascending: false })
    const { data } = await q.limit(1).maybeSingle()
    return res.status(200).json({ report: data || null })
  }

  if (req.method !== 'POST') return res.status(405).end()

  const { userId, periodType, periodFrom, periodTo, sessions, meals, weightEntries, profile, force } = req.body
  if (!userId || !periodType || !periodFrom || !periodTo)
    return res.status(400).json({ error: 'Missing params' })

  const periodKey = getPeriodKey(periodType, periodFrom)

  // Check if recent report exists (within 1 hour) unless force=true
  if (!force) {
    const { data: existing } = await sb.from('analysis_reports')
      .select('id, generated_at, report')
      .eq('user_id', userId).eq('period_type', periodType).eq('period_key', periodKey)
      .maybeSingle()
    if (existing) {
      const age = Date.now() - new Date(existing.generated_at).getTime()
      if (age < 3600000) return res.status(200).json({ report: existing.report, cached: true })
    }
  }

  if (!GEMINI_KEY) return res.status(500).json({ error: 'No API key' })

  // Build comprehensive data summary
  const totalSets = sessions.reduce((a, s) => a + (s.exercises?.reduce((b, e) => b + (e.sets?.length || 0), 0) || 0), 0)
  const totalVol = sessions.reduce((a, s) => a + (s.exercises?.reduce((b, e) => b + (e.sets?.reduce((c, st) => c + (st.weight_kg || 0) * (st.reps || 0), 0) || 0), 0) || 0), 0)
  const totalReps = sessions.reduce((a, s) => a + (s.exercises?.reduce((b, e) => b + (e.sets?.reduce((c, st) => c + (st.reps || 0), 0) || 0), 0) || 0), 0)
  
  // Muscle breakdown
  const muscleMap = {}
  sessions.forEach(s => {
    s.exercises?.forEach(ex => {
      const m = ex.muscle || 'Other'
      if (!muscleMap[m]) muscleMap[m] = { sessions: 0, sets: 0, vol: 0, exercises: new Set() }
      muscleMap[m].sets += ex.sets?.length || 0
      muscleMap[m].vol += ex.sets?.reduce((a, st) => a + (st.weight_kg || 0) * (st.reps || 0), 0) || 0
      muscleMap[m].exercises.add(ex.name)
    })
    ;(s.muscles_trained || []).forEach(m => {
      if (!muscleMap[m]) muscleMap[m] = { sessions: 0, sets: 0, vol: 0, exercises: new Set() }
      muscleMap[m].sessions++
    })
  })
  const muscleData = Object.entries(muscleMap).map(([m, d]) => ({
    muscle: m, sessions: d.sessions, sets: d.sets,
    vol: Math.round(d.vol), exercises: [...d.exercises].join(', ')
  })).sort((a, b) => b.sets - a.sets)

  // Personal bests
  const pbs = {}
  sessions.forEach(s => s.exercises?.forEach(ex => {
    ex.sets?.forEach(st => {
      if ((st.weight_kg || 0) > 0) {
        if (!pbs[ex.name] || st.weight_kg > pbs[ex.name]) pbs[ex.name] = st.weight_kg
      }
    })
  }))

  // Nutrition summary
  const mealDays = [...new Set(meals.map(m => m.meal_date || m.created_at?.split('T')[0]))].length || 1
  const totalCals = meals.reduce((a, m) => a + (m.total_calories || 0), 0)
  const totalProtein = meals.reduce((a, m) => a + (m.total_protein_g || 0), 0)
  const totalCarbs = meals.reduce((a, m) => a + (m.total_carbs_g || 0), 0)
  const totalFat = meals.reduce((a, m) => a + (m.total_fat_g || 0), 0)
  const avgCals = Math.round(totalCals / mealDays)
  const avgProtein = Math.round(totalProtein / mealDays)
  const avgCarbs = Math.round(totalCarbs / mealDays)
  const avgFat = Math.round(totalFat / mealDays)

  // Weight trend
  const wEntries = weightEntries.filter(w => w.date >= periodFrom && w.date <= periodTo).sort((a,b) => a.date.localeCompare(b.date))
  const weightChange = wEntries.length >= 2 ? Math.round((wEntries[wEntries.length-1].weight_kg - wEntries[0].weight_kg) * 10) / 10 : null

  const periodLabel = periodType === 'week' ? 'week' : periodType === 'month' ? 'month' : periodType === 'quarter' ? 'quarter' : periodType === 'halfyear' ? '6-month period' : periodType === 'year' ? 'year' : 'period'

  const prompt = `أنت مدرب لياقة بدنية خبير وعالم رياضي متخصص. مهمتك تحليل بيانات الرياضي وتقديم تقرير شامل بالعربية الخليجية الاحترافية.
اكتب بأسلوب مدرب شخصي يفهم أهداف الرياضي ويريد مساعدته على تغيير جسمه وحياته.

الفترة: من ${periodFrom} إلى ${periodTo}
الهدف: ${profile?.goal || 'اللياقة العامة'}
بيانات التدريب:
- عدد الجلسات: ${sessions.length}
- إجمالي المجموعات: ${totalSets}
- إجمالي الحجم: ${Math.round(totalVol)}كغ
- إجمالي التكرارات: ${totalReps}
- متوسط المجموعات للجلسة: ${sessions.length ? Math.round(totalSets/sessions.length) : 0}
تفصيل العضلات: ${JSON.stringify(muscleData.slice(0, 10))}
أفضل الأرقام في هذه الفترة: ${JSON.stringify(Object.entries(pbs).slice(0, 10).map(([n,w]) => n+': '+w+'kg'))}
التغذية (${mealDays} أيام مسجّلة):
- متوسط السعرات: ${avgCals} سعرة/يوم
- متوسط البروتين: ${avgProtein}g/يوم
- متوسط الكارب: ${avgCarbs}g/يوم
- متوسط الدهن: ${avgFat}g/يوم
الوزن: ${weightChange !== null ? (weightChange > 0 ? '+' : '') + weightChange + 'كغ' : 'لا بيانات'}

أعد ONLY كائن JSON خام بدون markdown أو backticks. كل النصوص بالعربية الخليجية. أسماء التمارين تبقى بالإنجليزية:
{
  "overall_score": 1-10,
  "training_score": 1-10,
  "nutrition_score": 1-10,
  "consistency_score": 1-10,
  "summary": "ملخص تنفيذي 3-4 جمل بالعربية عن هذه الفترة",
  "training_analysis": {
    "strengths": ["شيء سوّيته ممتاز 1", "شيء ممتاز 2"],  // وش سوّيت ممتاز؟
    "weaknesses": ["شيء يحتاج تحسين 1", "شيء يحتاج تحسين 2"],  // وش يحتاج تحسين؟
    "muscle_balance": "تعليق مفصّل على توازن العضلات والمجموعات التي أُفرط في تدريبها أو أُهملت",
    "volume_assessment": "هل الحجم مناسب للهدف؟",
    "intensity_assessment": "تعليق على الشدة والتقدم",
    "recommendations": ["توصيتنا لك 1", "توصية 2", "توصية 3"]  // توصيتنا لك
  },
  "nutrition_analysis": {
    "calorie_assessment": "هل السعرات مناسبة للهدف؟",
    "protein_assessment": "هل البروتين كافٍ؟ أعطِ أرقاماً محددة",
    "macro_balance": "تعليق على توزيع الكارب والدهن والبروتين",
    "recommendations": ["توصية غذائية 1", "توصية غذائية 2"]
  },
  "weight_analysis": "تعليق على اتجاه الوزن وما يعنيه للهدف",
  "highlights": ["أبرز إنجاز 1", "أبرز إنجاز 2", "أبرز إنجاز 3"],
  "areas_to_improve": ["مجال تحسين 1", "مجال تحسين 2", "مجال تحسين 3"],
  "next_period_plan": ["أولوية الفترة القادمة 1", "أولوية 2", "أولوية 3"],
  "exercise_recommendations": ["تمرين يجب إضافته أو زيادته 1", "توصية تمرين 2"],
  "recovery_tips": ["نصيحة تعافي 1", "نصيحة تعافي 2"],
  "motivation": "جملة تحفيزية قوية ومخصصة للرياضي بالعربية الخليجية"
}`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 55000)
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 2500, thinkingConfig: { thinkingBudget: 0 } } }) }
    )
    clearTimeout(timer)
    const data = await r.json()
    const raw = (data?.candidates?.[0]?.content?.parts || []).filter(p => p.text && !p.thought).map(p => p.text).join('')
    const match = raw.replace(/```json|```/gi, '').trim().match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON')
    const report = JSON.parse(match[0])

    // Store report
    await sb.from('analysis_reports').upsert({
      user_id: userId, period_type: periodType, period_key: periodKey,
      period_from: periodFrom, period_to: periodTo, report,
      generated_at: new Date().toISOString()
    }, { onConflict: 'user_id,period_type,period_key' })

    return res.status(200).json({ report })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
