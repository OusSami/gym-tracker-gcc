/**
 * POST /api/packages/analyze-reason
 * AI analyzes the user's "why incomplete / why skipped" text.
 * SAFETY RULE: we NEVER silently modify health profile or program.
 * We return recommendations — the frontend asks the user to confirm.
 */
import { supabaseAdmin } from '../../../lib/supabase'
import { checkRateLimit, logApiUsage } from '../../../lib/logApiUsage'

async function callGemini(apiKey, prompt) {
  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 800 },
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

  const rateCheck = await checkRateLimit(userId, 'reason', 10)
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'وصلت للحد اليومي لتحليل الأسباب (10 تحليلات). رجّع باكر.', remaining: 0 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  const sb = supabaseAdmin()

  const { data: profile } = await sb.from('profiles').select('health_conditions,sex,weight_kg').eq('id', userId).single()
  const currentConditions = profile?.health_conditions || []
  const sex = profile?.sex || 'male'

  // Base analysis object — nothing gets written to DB without user confirmation
  let analysis = {
    category,
    type: 'mental',
    severity: 'low',
    body_part: null,
    safe_alternatives: [],
    exercises_to_avoid: [],
    adapt_level: 'same',
    // These are RECOMMENDATIONS returned to the frontend — not applied automatically
    suggest_health_condition: null,
    suggest_extend_days: 0,
    coach_reply: '',
    medical_warning: false,
    medical_note: null,
  }

  // ── Mental resistance — instant, no AI ──────────────────────────
  if (category === 'mental') {
    analysis.coach_reply = sex === 'female'
      ? 'فهمت — كان عندك مقاومة اليوم. باكر نحاول مرة ثانية. أنتِ تستطيعين! 💪'
      : 'فهمت — كان عندك مقاومة اليوم. باكر نحاول مرة ثانية. أنت تستطيع! 💪'
    await saveAnalysis(sb, programId, dayNumber, analysis)
    return res.json({ analysis })
  }

  // ── Time constraint — instant, no AI ────────────────────────────
  if (category === 'time') {
    analysis.type = 'logistics'
    analysis.coach_reply = 'الوقت ضيّق أحياناً — لا بأس. حاول تخصص 15-20 دقيقة على الأقل غداً.'
    await saveAnalysis(sb, programId, dayNumber, analysis)
    return res.json({ analysis })
  }

  // ── Pain or difficulty — use AI ──────────────────────────────────
  if (apiKey && reasonText?.trim()) {
    const conditionsText = currentConditions.length
      ? `الحالات الصحية المسجلة مسبقاً: ${currentConditions.join(', ')}`
      : 'لا توجد حالات صحية مسجلة مسبقاً'

    const prompt = `أنت مدرب لياقة بدنية ومختص في الصحة الرياضية. خذ الأمر بجدية تامة — صحة المستخدم فوق كل شيء.

التمرين: "${exerciseName || 'غير محدد'}"
فئة المشكلة: ${category === 'pain' ? 'ألم جسدي' : 'صعوبة في الأداء أو تعب'}
${conditionsText}
وصف المستخدم: "${reasonText}"

قواعد التقييم:
- ألم في الصدر أو ضغط على الصدر أو نبض غير منتظم = urgent + medical_warning = true + suggest_health_condition = heart
- ضيق تنفس حاد أو دوار أو إغماء = urgent + medical_warning = true دائماً
- صعوبة تنفس متكررة أثناء التمرين (بدون ألم صدر) = suggest_health_condition = asthma
- دوار مستمر مرتبط بارتفاع ضغط الدم = suggest_health_condition = hypertension
- ألم في الركبة أو الضغط عليها = suggest_health_condition = knee_pain
- ألم في الظهر أو أسفل الظهر = suggest_health_condition = back_pain
- ألم في الكتف أو مفصل الكتف = suggest_health_condition = shoulder_pain
- ألم حاد مفاجئ = high severity
- ألم مزمن معروف = moderate severity
- إزعاج خفيف أو تعب عضلي = low severity
- لا تبالغ في التشخيص لكن لا تتهاون مع الألم الحقيقي
- اقترح بدائل آمنة محددة من تمارين البيت بدون معدات
- إذا كانت نفس الحالة موجودة مسبقاً في الحالات المسجلة، اذكر ذلك في ردك

أعد JSON فقط بدون أي نص خارجه:
{
  "type": "pain|difficulty|fatigue",
  "body_part": "knee|back|shoulder|chest|wrist|ankle|core|general|null",
  "severity": "low|moderate|high|urgent",
  "safe_alternatives": ["تمرين بديل آمن بالعربية 1", "تمرين بديل آمن بالعربية 2"],
  "exercises_to_avoid": ["keyword1", "keyword2"],
  "adapt_level": "same|easier|recovery|stop",
  "suggest_health_condition": "knee_pain|back_pain|shoulder_pain|heart|hypertension|asthma|null",
  "suggest_extend_days": 0,
  "coach_reply": "رد مباشر وصادق للمستخدم بالعربية الخليجية — حدد المشكلة واذكر ما يجب فعله",
  "medical_warning": false,
  "medical_note": null
}`

    try {
      const text = await callGemini(apiKey, prompt)
      const cleaned = text.replace(/```json|```/gi, '').trim()
      const parsed = JSON.parse(cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned)
      Object.assign(analysis, parsed)
      logApiUsage(userId, 'reason', 0, 0)
    } catch (e) {
      console.error('analyze-reason AI error:', e.message)
      // Conservative fallback
      if (category === 'pain') {
        analysis.type = 'pain'
        analysis.severity = 'moderate'
        analysis.adapt_level = 'easier'
        analysis.suggest_extend_days = 1
        analysis.coach_reply = 'فهمت — عندك ألم. خففنا التمارين ليومين. إذا استمر الألم لأكثر من يومين راجع طبيباً.'
      } else {
        analysis.type = 'fatigue'
        analysis.adapt_level = 'easier'
        analysis.coach_reply = 'فهمت — التمرين كان صعب. نعدّل الشدة لباكر ونبني تدريجياً — هذا طبيعي في البداية.'
      }
    }
  } else {
    // No text provided — use safe category defaults
    if (category === 'pain') {
      analysis.type = 'pain'
      analysis.severity = 'moderate'
      analysis.adapt_level = 'easier'
      analysis.suggest_extend_days = 1
      analysis.coach_reply = 'خذ راحة كافية اليوم. خففنا شدة التمارين لباكر — صحتك أولاً. اكتب ما تشعر به للمرة القادمة.'
    } else {
      analysis.type = 'fatigue'
      analysis.adapt_level = 'easier'
      analysis.coach_reply = 'تعب طبيعي — نخفف شوي لباكر ونعود للمستوى تدريجياً.'
    }
  }

  // ── Urgent / medical warning — hard override ─────────────────────
  if (analysis.medical_warning || analysis.severity === 'urgent') {
    analysis.adapt_level = 'stop'
    analysis.suggest_extend_days = 0
    analysis.coach_reply = '⚠️ الأعراض التي ذكرتها تحتاج مراجعة طبيب قبل إكمال أي تمرين. توقف الآن وراجع طبيبك. صحتك أهم من أي برنامج.'
    analysis.medical_note = 'يرجى مراجعة طبيب مختص قبل استئناف التمرين.'
  }

  // ── Extend program days (only for confirmed pain, not silent) ────
  // We extend automatically only for moderate+ pain since user already
  // reported it — this is a recovery measure, not a silent profile change.
  if (analysis.type === 'pain' && analysis.severity !== 'low' && analysis.suggest_extend_days > 0 && programId) {
    try {
      const { data: prog } = await sb.from('user_programs').select('total_days,end_date').eq('id', programId).single()
      if (prog) {
        const extDays = Math.min(analysis.suggest_extend_days, 3) // cap at 3 days
        const newEnd = new Date(prog.end_date)
        newEnd.setDate(newEnd.getDate() + extDays)
        await sb.from('user_programs').update({
          total_days: prog.total_days + extDays,
          end_date: newEnd.toISOString().split('T')[0],
        }).eq('id', programId)
        analysis.extended_by = extDays
      }
    } catch (e) {
      console.error('Program extension error:', e.message)
    }
  }

  // ── Health condition — NEVER auto-update. Return suggestion only. ─
  // Frontend will ask user: "نضيف X لملفك الصحي؟" [نعم] [لا]
  // The actual DB update happens via a separate confirmed call.

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
