import { logApiUsage, checkRateLimit, RATE_LIMITS } from '../../lib/logApiUsage'
import { supabaseAdmin } from '../../lib/supabase'
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } }

async function callGemini(apiKey, text) {
  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 3000,  }
      })
    }
  )
  const data = await r.json()
  if (!r.ok || data.error) throw new Error(data?.error?.message || 'HTTP ' + r.status)
  return data?.candidates?.[0]?.content?.parts?.filter(p => p.text && !p.thought).map(p => p.text).join('') || ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { sessionId, userId, exercises, muscles, duration } = req.body
  if (!sessionId || !exercises?.length) return res.status(400).json({ error: 'Missing data' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' })

  const exSummary = exercises.map(ex => {
    const totalVol = ex.sets.reduce((a, s) => a + s.weight * s.reps, 0)
    const maxW = Math.max(...ex.sets.map(s => s.weight))
    return '- ' + ex.name + ' (' + ex.muscle + '): ' + ex.sets.length + ' sets, max ' + maxW + 'kg, volume ' + Math.round(totalVol) + 'kg'
  }).join('\n')

  const muscleExercises = {}
  exercises.forEach(ex => {
    if (!muscleExercises[ex.muscle]) muscleExercises[ex.muscle] = []
    muscleExercises[ex.muscle].push(ex.name)
  })

  const coverageEntries = muscles.map(m => {
    return '"' + m + '": { "exercises_done": ' + JSON.stringify(muscleExercises[m] || []) + ', "coverage_score": 1-10, "note": "ملاحظة مختصرة" }'
  }).join(',\n    ')

  const prompt = [
    'أنت مدرب لياقة بدنية خبير. مهمتك تحليل جلسة تمرين مكتملة وتقديم تقرير شامل باللغة العربية الخليجية.',
    'اكتب التقرير بأسلوب محترف ومحفّز — كأنك مدرب شخصي يتحدث مع رياضي يريد تغيير جسمه.',
    '',
    'تفاصيل الجلسة:',
    '- العضلات المستهدفة: ' + muscles.join(', '),
    '- المدة: ' + Math.round((duration || 0) / 60) + ' دقيقة',
    '- التمارين المنجزة:',
    exSummary,
    '',
    'أعد ONLY كائن JSON خام بدون markdown أو backticks:',
    '{',
    '  "overall_rating": 1-10,',
    '  "intensity_score": 1-10,',
    '  "volume_score": 1-10,',
    '  "balance_score": 1-10,',
    '  "summary": "تقييم شامل للجلسة بـ 2-3 جمل بالعربية",',
    '  "what_went_well": ["شيء سويته ممتاز 1", "شيء ممتاز 2"],  // وش سويت ممتاز اليوم؟',
    '  "what_to_improve": ["شيء يحتاج تركيز أكثر 1", "شيء 2"],  // وش يحتاج تركيز أكثر؟',
    '  "missing_exercises": ["تمرين مقترح إن وجد"],  // تمرين مقترح',
    '  "muscle_coverage": {',
    '    ' + coverageEntries,
    '  },',
    '  "next_session_tips": ["توصية 1", "توصية 2"],  // وش ننصحك فيه للجلسة الجاية؟',
    '  "estimated_calories": number',
    '}',
    '',
    'مهم: كل النصوص بالعربية الخليجية. أسماء التمارين تبقى بالإنجليزية. مصطلحات: الدهون المشبعة، المتعددة غير المشبعة، الأحادية غير المشبعة، زيادة الكتلة العضلية، خفض الدهون وتحسين القوام، رفع التحمل، تحسين اللياقة.',
  ].join('\n')

  let raw, report
  try {
    raw = await callGemini(apiKey, prompt)
    const cleaned = raw.replace(/```json|```/gi, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    report = JSON.parse(match ? match[0] : cleaned)
  } catch(e) {
    return res.status(500).json({ error: 'AI parse error: ' + (raw || '').slice(0, 150) })
  }

  const sb = supabaseAdmin()
  await sb.from('sessions').update({ ai_report: report }).eq('id', sessionId)

  return res.status(200).json({ report })
}
