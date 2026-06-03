import { logApiUsage, checkRateLimit } from '../../lib/logApiUsage'

const CONTEXT_SYSTEMS = {
  meals: `أنت مختص تغذية خليجي محترف.
مهمتك الوحيدة: مساعدة المستخدم في أسئلة الأكل، السعرات، الوجبات الخليجية، والتغذية الرياضية.
اعرف المطبخ الخليجي جيداً: كبسة، مندي، حمص، شاورما، لبن، تمر، فول — قدّر ماكرواتها بدقة.
إذا سألك عن غير التغذية والأكل، قل فقط: "هذا خارج تخصصي هنا — اسألني عن الأكل والتغذية 🥗"
ردودك مباشرة وعملية، لا تزيد عن 150 كلمة.`,

  program: `أنت مدرب لياقة بدنية متخصص في تمارين البيت وحرق الدهون.
مهمتك الوحيدة: مساعدة المستخدم في أسئلة التمرين، الأداء الصحيح، الإصابات، والبرنامج.
تمارين البيت بدون معدات هي تخصصك الأول — برجل، قرفصاء، بلانك، كرانش، إلخ.
إذا سألك عن غير التمرين واللياقة، قل: "اسألني عن التمرين والأداء هنا 🏋️"
ردودك مباشرة وعملية، لا تزيد عن 150 كلمة.`,

  progress: `أنت محلل أداء رياضي متخصص في تتبع النتائج والتقدم.
مهمتك الوحيدة: مساعدة المستخدم في فهم تقدمه، تفسير أرقامه، وتحسين نتائجه.
اعمل على البيانات المقدمة لك: الوزن، نسبة الدهون، أيام التمرين المكتملة.
إذا سألك عن غير التقدم والنتائج، قل: "هنا نتحدث عن تقدمك وأرقامك 📊"
ردودك تحليلية وتشجيعية، لا تزيد عن 150 كلمة.`,

  default: `أنت مدرب لياقة ومختص تغذية خليجي متمرس.
مهمتك: الإجابة على أسئلة اللياقة، التغذية، والصحة الرياضية للمنطقة الخليجية.
اعرف المطبخ الخليجي وتمارين البيت بدون معدات جيداً.
إذا سألك المستخدم عن أي موضوع آخر، قل: "أنا هنا فقط للياقة والتغذية 💪"
ردودك بالعربية الخليجية المحكية، مباشرة وعملية، لا تزيد عن 150 كلمة.`
}

function buildSystemPrompt(context, userData) {
  const base = CONTEXT_SYSTEMS[context] || CONTEXT_SYSTEMS.default

  if (!userData) return base

  const { weight, height, age, goal, bmi, bf, programDay, programTotal, programName, programPct, calorieTarget, streak } = userData

  const GOAL_AR = { weight:'خسارة الوزن وحرق دهون البطن', muscle:'بناء العضل', general:'تحسين اللياقة العامة' }

  const userBlock = `
بيانات المستخدم الحالية (استخدمها في ردودك بشكل طبيعي):
- الهدف: ${GOAL_AR[goal] || goal || 'غير محدد'}
- الوزن: ${weight ? weight + ' كجم' : 'غير محدد'}
- الطول: ${height ? height + ' سم' : 'غير محدد'}
- BMI: ${bmi || 'غير محسوب'}
- نسبة الدهون التقديرية: ${bf ? bf + '%' : 'غير محسوبة'}
- هدف السعرات اليومي: ${calorieTarget ? calorieTarget + ' سعرة' : 'غير محدد'}
${programName ? `- البرنامج النشط: ${programName} (اليوم ${programDay} من ${programTotal}) — مكتمل ${programPct}%` : ''}
${streak ? `- سلسلة الالتزام: ${streak} يوم متواصل` : ''}

استخدم هذه البيانات لتخصيص ردودك. لا تذكرها كلها مرة واحدة — استخدمها بشكل طبيعي عند الحاجة.`

  return base + userBlock
}

async function callGemini(apiKey, systemPrompt, messages) {
  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        generationConfig: { temperature: 0.4, maxOutputTokens: 500 }
      })
    }
  )
  const data = await r.json()
  if (!r.ok) throw new Error(data?.error?.message || 'HTTP ' + r.status)
  const parts = data?.candidates?.[0]?.content?.parts || []
  const text = parts.filter(p => p.text && !p.thought).map(p => p.text).join('')
  const usage = data?.usageMetadata || {}
  return { text, inputTokens: usage.promptTokenCount || 0, outputTokens: usage.candidatesTokenCount || 0 }
}

export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' })

  if (req.method === 'GET') {
    const { action, userId } = req.query
    if (action === 'usage' && userId) {
      const check = await checkRateLimit(userId, 'coach', 20)
      return res.json({ count: check.used || 0, remaining: check.remaining })
    }
    return res.status(400).json({ error: 'Unknown action' })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, message, context = 'default', userData, history = [] } = req.body
  if (!message || !userId) return res.status(400).json({ error: 'Missing fields' })

  const rateCheck = await checkRateLimit(userId, 'coach', 20)
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'وصلت للحد اليومي (20 رسالة). رجّع باكر 💪', remaining: 0 })
  }

  const systemPrompt = buildSystemPrompt(context, userData)
  const messages = [...history, { role: 'user', content: message }]

  try {
    const { text, inputTokens, outputTokens } = await callGemini(apiKey, systemPrompt, messages)
    logApiUsage(userId, 'coach', inputTokens, outputTokens)
    return res.json({ reply: text, remaining: rateCheck.remaining - 1 })
  } catch(e) {
    return res.status(500).json({ error: 'تعذر الاتصال. حاول مرة ثانية.' })
  }
}
