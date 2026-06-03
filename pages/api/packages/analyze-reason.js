/**
 * POST /api/packages/analyze-reason
 * AI analyzes the user's "why incomplete" text
 * Returns structured adaptation + updates profile health conditions if pain detected
 */
import { supabaseAdmin } from '../../../lib/supabase'

async function callGemini(apiKey, prompt) {
  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 600 }
      })
    }
  )
  const data = await r.json()
  if (!r.ok) throw new Error(data?.error?.message || 'HTTP ' + r.status)
  const parts = data?.candidates?.[0]?.content?.parts || []
  return parts.filter(p => p.text && !p.thought).map(p => p.text).join('')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, programId, dayNumber, category, reasonText, exerciseName } = req.body
  if (!userId || !category) return res.status(400).json({ error: 'Missing fields' })

  const apiKey = process.env.GEMINI_API_KEY
  const sb = supabaseAdmin()

  // Get current health conditions
  const { data: profile } = await sb.from('profiles').select('health_conditions,sex').eq('id', userId).single()
  const currentConditions = profile?.health_conditions || []
  const sex = profile?.sex || 'male'

  let analysis = {
    category,
    type: 'mental',
    severity: 'low',
    body_part: null,
    remove_exercises: [],
    adapt_level: 'same',
    extend_program: false,
    extension_days: 0,
    new_health_condition: null,
    coach_reply: '',
    update_health_profile: false,
  }

  // Pure mental resistance — no AI needed
  if (category === 'mental') {
    analysis.type = 'mental'
    analysis.adapt_level = 'same'
    analysis.coach_reply = sex === 'female'
      ? 'فهمت — كان عندك مقاومة اليوم. باكر نحاول مرة ثانية بنفس الهدف. أنتِ تستطيعين! 💪'
      : 'فهمت — كان عندك مقاومة اليوم. باكر نحاول مرة ثانية بنفس الهدف. أنت تستطيع! 💪'
    analysis.extend_program = false
    // Save and return immediately
    await saveAnalysis(sb, programId, dayNumber, analysis)
    return res.json({ analysis })
  }

  // Time issue — no AI needed
  if (category === 'time') {
    analysis.type = 'logistics'
    analysis.adapt_level = 'same'
    analysis.coach_reply = 'الوقت ضيّق أحياناً — غداً نكمل. حاول تخصص 20 دقيقة على الأقل.'
    await saveAnalysis(sb, programId, dayNumber, analysis)
    return res.json({ analysis })
  }

  // Pain or difficulty — use AI to understand what happened
  if (apiKey && reasonText?.trim()) {
    const prompt = `أنت مدرب لياقة بدنية ومختص في الصحة الرياضية.

المستخدم لم يكمل تمرين "${exerciseName || 'التمرين'}" وأعطى هذا السبب:
الفئة: ${category === 'pain' ? 'ألم' : 'صعوبة في الأداء'}
الوصف: "${reasonText}"

حلل هذا الوصف وأعد JSON بدون أي نص خارجه:
{
  "type": "pain|difficulty|fatigue",
  "body_part": "knee|back|shoulder|chest|wrist|ankle|general|null",
  "severity": "low|moderate|high|urgent",
  "remove_exercises": ["keywords to filter - e.g: squat, lunge, jump"],
  "adapt_level": "same|easier|recovery|stop",
  "extend_program": true/false,
  "extension_days": 0,
  "new_health_condition": "knee_pain|back_pain|shoulder_pain|null",
  "update_health_profile": true/false,
  "coach_reply": "رد المدرب للمستخدم بالعربية الخليجية — مختصر ومحدد",
  "medical_warning": true/false
}`

    try {
      const text = await callGemini(apiKey, prompt)
      const cleaned = text.replace(/```json|```/gi, '').trim()
      const parsed = JSON.parse(cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned)
      Object.assign(analysis, parsed)
    } catch(e) {
      // Fallback analysis
      analysis.type = category === 'pain' ? 'pain' : 'difficulty'
      analysis.adapt_level = category === 'pain' ? 'easier' : 'same'
      analysis.coach_reply = category === 'pain'
        ? 'فهمت — عندك ألم. خففنا التمارين لليومين الجايين. إذا استمر الألم راجع الطبيب.'
        : 'فهمت — التمرين كان صعب. نعدّل الشدة لباكر ونبني تدريجياً.'
    }
  } else {
    // No text — use category defaults
    if (category === 'pain') {
      analysis.type = 'pain'
      analysis.adapt_level = 'easier'
      analysis.coach_reply = 'خذ راحة كافية. خففنا شدة التمارين لباكر — صحتك أولاً.'
      analysis.extend_program = true
      analysis.extension_days = 1
    } else {
      analysis.type = 'fatigue'
      analysis.adapt_level = 'easier'
      analysis.coach_reply = 'تعب طبيعي — نخفف شوي لباكر ونعود للمستوى.'
    }
  }

  // Medical warning — urgent cases
  if (analysis.medical_warning || analysis.severity === 'urgent') {
    analysis.adapt_level = 'stop'
    analysis.coach_reply = '⚠️ الأعراض اللي ذكرتها تحتاج مراجعة طبيب قبل إكمال التمرين. صحتك أهم من أي برنامج.'
    analysis.update_health_profile = true
  }

  // Update health profile if new condition detected
  if (analysis.update_health_profile && analysis.new_health_condition) {
    const updated = [...new Set([...currentConditions, analysis.new_health_condition])]
    await sb.from('profiles').update({ health_conditions: updated }).eq('id', userId)
  }

  // Extend program if needed
  if (analysis.extend_program && analysis.extension_days > 0 && programId) {
    const { data: prog } = await sb.from('user_programs').select('total_days,end_date').eq('id', programId).single()
    if (prog) {
      const newEnd = new Date(prog.end_date)
      newEnd.setDate(newEnd.getDate() + analysis.extension_days)
      await sb.from('user_programs').update({
        total_days: prog.total_days + analysis.extension_days,
        end_date: newEnd.toISOString().split('T')[0],
      }).eq('id', programId)
    }
  }

  await saveAnalysis(sb, programId, dayNumber, analysis)
  return res.json({ analysis })
}

async function saveAnalysis(sb, programId, dayNumber, analysis) {
  if (!programId || !dayNumber) return
  await sb.from('program_days')
    .update({ incomplete_reason: analysis })
    .eq('program_id', programId)
    .eq('day_number', dayNumber)
}
