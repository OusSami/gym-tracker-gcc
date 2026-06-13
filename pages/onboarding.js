import { useState } from 'react'
import { useRouter } from 'next/router'

import { getContent } from '../lib/content'

const G = '#111111', F = "'Tajawal',sans-serif"

// Deurenberg formula — BMI-based body fat estimation
function calcBMI(weight, height) {
  const h = height / 100
  return Math.round((weight / (h * h)) * 10) / 10
}
function calcBF(bmi, age, sex) {
  const bf = sex === 'female'
    ? (1.20 * bmi) + (0.23 * age) - 5.4
    : (1.20 * bmi) + (0.23 * age) - 16.2
  return Math.max(5, Math.min(60, Math.round(bf * 10) / 10))
}
function bmiCategory(bmi) {
  if (bmi < 18.5) return { ar: 'نقص الوزن', color: '#3b82f6' }
  if (bmi < 25)   return { ar: 'وزن طبيعي',  color: '#22c55e' }
  if (bmi < 30)   return { ar: 'وزن زائد',   color: '#f97316' }
  return              { ar: 'سمنة',          color: '#ef4444' }
}
function calorieTarget(weight, height, age, sex, goal) {
  // Mifflin-St Jeor BMR
  const bmr = sex === 'female'
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5
  const tdee = bmr * 1.2 // sedentary (our avatar)
  if (goal === 'lose') return Math.round(tdee - 400)
  if (goal === 'muscle') return Math.round(tdee + 200)
  return Math.round(tdee - 200)
}

// SVG Body Silhouettes
function SilhouetteMale({ filled }) {
  return (
    <svg viewBox="0 0 80 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:52,height:92}}>
      <ellipse cx="40" cy="18" rx="13" ry="14" fill={filled?G+'88':'rgba(0,0,0,0.12)'}/>
      <path d="M25 32 Q18 42 18 65 L25 65 L25 105 L35 105 L35 70 L45 70 L45 105 L55 105 L55 65 L62 65 Q62 42 55 32 Q47 28 40 28 Q33 28 25 32Z" fill={filled?G+'88':'rgba(0,0,0,0.12)'}/>
    </svg>
  )
}
function SilhouetteMaleBelly({ filled }) {
  return (
    <svg viewBox="0 0 90 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:60,height:92}}>
      <ellipse cx="45" cy="18" rx="14" ry="14" fill={filled?G+'88':'rgba(0,0,0,0.12)'}/>
      <path d="M28 32 Q18 42 16 58 Q14 72 20 78 Q26 84 45 84 Q64 84 70 78 Q76 72 74 58 Q72 42 62 32 Q53 28 45 28 Q37 28 28 32Z" fill={filled?G+'88':'rgba(0,0,0,0.12)'}/>
      <path d="M20 78 L22 105 L33 105 L34 75" fill={filled?G+'88':'rgba(0,0,0,0.12)'}/>
      <path d="M70 78 L68 105 L57 105 L56 75" fill={filled?G+'88':'rgba(0,0,0,0.12)'}/>
    </svg>
  )
}
function SilhouetteFemale({ filled }) {
  return (
    <svg viewBox="0 0 80 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:52,height:92}}>
      <ellipse cx="40" cy="17" rx="12" ry="13" fill={filled?G+'88':'rgba(0,0,0,0.12)'}/>
      <path d="M27 30 Q20 40 20 55 Q20 62 27 66 Q34 70 40 70 Q46 70 53 66 Q60 62 60 55 Q60 40 53 30 Q46 26 40 26 Q34 26 27 30Z" fill={filled?G+'88':'rgba(0,0,0,0.12)'}/>
      <path d="M24 66 Q18 72 18 82 Q18 92 28 95 Q34 97 40 97 Q46 97 52 95 Q62 92 62 82 Q62 72 56 66" fill={filled?G+'88':'rgba(0,0,0,0.12)'}/>
      <path d="M28 95 L26 110 L36 110 L38 80" fill={filled?G+'88':'rgba(0,0,0,0.12)'}/>
      <path d="M52 95 L54 110 L44 110 L42 80" fill={filled?G+'88':'rgba(0,0,0,0.12)'}/>
    </svg>
  )
}

const BODY_SHAPES_M = [
  { id:'slim',   label:'رشيق',        desc:'بطن مسطح', bfMod:-4 },
  { id:'normal', label:'طبيعي',       desc:'بطن خفيفة', bfMod:0 },
  { id:'belly',  label:'بطن واضحة',   desc:'خصر ممتلئ', bfMod:5 },
  { id:'obese',  label:'وزن زائد كبير', desc:'بطن كبيرة', bfMod:10 },
]
const BODY_SHAPES_F = [
  { id:'slim',   label:'رشيقة',       desc:'جسم نحيف', bfMod:-4 },
  { id:'normal', label:'طبيعية',      desc:'وزن مناسب', bfMod:0 },
  { id:'belly',  label:'بطن واضحة',   desc:'خصر ممتلئ', bfMod:5 },
  { id:'obese',  label:'وزن زائد',    desc:'بطن كبيرة', bfMod:10 },
]

const HEALTH_OPTIONS = [
  { id:'none',          icon:'✅', label:'لا أعاني من أي مشكلة صحية', risk:'normal', single:true },
  { id:'knee_pain',     icon:'🦵', label:'آلام الركبة أو المفاصل',   risk:'moderate' },
  { id:'back_pain',     icon:'🔙', label:'آلام الظهر أو العمود الفقري', risk:'moderate' },
  { id:'shoulder_pain', icon:'💪', label:'مشكلة في الكتف أو الذراع', risk:'low' },
  { id:'diabetes',      icon:'🩸', label:'السكري',                   risk:'moderate' },
  { id:'cholesterol',   icon:'❤️', label:'الكوليسترول المرتفع',      risk:'moderate' },
  { id:'hypertension',  icon:'🫀', label:'ضغط الدم المرتفع',         risk:'moderate' },
  { id:'heart',         icon:'⚠️', label:'مشاكل في القلب أو الشرايين', risk:'blocked' },
  { id:'asthma',        icon:'🫁', label:'الربو أو مشاكل التنفس',    risk:'low' },
  { id:'pregnancy',     icon:'🤱', label:'الحمل',                    risk:'blocked' },
]

export default function Onboarding() {
  const router = useRouter()
  const { userId } = router.query
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [healthConditions, setHealthConditions] = useState([])
  const [form, setForm] = useState({
    sex: '', age: '', weight: '', height: '',
    goal: '', days: 3, time: 30, bodyShape: ''
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const bmi = form.weight && form.height ? calcBMI(+form.weight, +form.height) : null
  const bf  = bmi && form.age && form.sex ? calcBF(bmi, +form.age, form.sex) : null
  const bfFinal = bf && form.bodyShape ? bf + (form.sex==='male'?BODY_SHAPES_M:BODY_SHAPES_F).find(b=>b.id===form.bodyShape)?.bfMod || 0 : bf
  const bmiCat  = bmi ? bmiCategory(bmi) : null
  const calTarget = form.weight && form.height && form.age && form.sex && form.goal
    ? calorieTarget(+form.weight, +form.height, +form.age, form.sex, form.goal)
    : null

  const save = async () => {
    if (!userId) { router.replace('/'); return }
    setSaving(true)
    const goalMap = { lose:'weight', muscle:'muscle', fit:'general' }
    await fetch('/api/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        weight_kg: +form.weight,
        height_cm: +form.height,
        birthday:  new Date(new Date().getFullYear() - +form.age, 0, 1).toISOString().split('T')[0],
        sex: form.sex,
        goal: goalMap[form.goal] || 'general',
        fitness_level: 'beginner',
        body_fat_pct: bfFinal ? Math.max(5, Math.min(60, Math.round(bfFinal))) : null,
        health_conditions: healthConditions.filter(h => h !== 'none'),
        health_risk_level: healthConditions.includes('heart') || healthConditions.includes('pregnancy') ? 'blocked'
          : healthConditions.some(h => ['hypertension','diabetes','knee_pain','back_pain'].includes(h)) ? 'moderate'
          : 'normal',
        body_fat_method: 'bmi',
        body_fat_updated_at: new Date().toISOString(),
        days_per_week: form.days,
        equipment: 'home',
        calorie_target: calTarget,
        onboarded: true,
      })
    })
    setSaving(false)
    router.replace('/')
  }

  const STEPS = [
    // 0 = welcome (no input)
    null,
    // 1 = sex
    { q: 'أنت ...', sub: 'اختر جنسك', done: !!form.sex },
    // 2 = age + weight + height
    { q: 'بياناتك الأساسية', sub: 'الطول، الوزن، العمر', done: form.age && form.weight && form.height && +form.age>10 && +form.weight>20 && +form.height>100 },
    // 3 = goal
    { q: 'ما هو هدفك؟', sub: 'اختر الهدف الأهم لك', done: !!form.goal },
    // 4 = days + time
    { q: 'وقت تمرينك', sub: 'كم يوم وكم دقيقة؟', done: true },
    // 5 = health
    { q: 'صحتك تهمنا', sub: 'اختر كل ما ينطبق عليك', done: true },
    // 6 = body shape
    { q: 'شكل جسمك الحالي', sub: 'اختر الأقرب لشكلك', done: !!form.bodyShape },
    // 7 = result
    null,
  ]

  const maxStep = 7
  const canNext = step === 0 || (STEPS[step]?.done ?? true)

  return (
    <div style={{ minHeight:'100vh', background:'var(--surface)', color:'var(--text-primary)', fontFamily:F, direction:'rtl' }}>
      <style>{`
        * { box-sizing:border-box }
        @keyframes up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .fu { animation:up .35s ease both }
        input:focus { outline:none; border-color:rgba(0,0,0,0.30)!important }
      `}</style>

      <div style={{ maxWidth:430, margin:'0 auto', padding:'0 20px 60px', minHeight:'100vh', display:'flex', flexDirection:'column' }}>

        {/* PROGRESS */}
        {step > 0 && step < maxStep && (
          <div style={{ padding:'20px 0 0', flexShrink:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <button onClick={()=>setStep(s=>s-1)} style={{ background:'none',border:'none',color:'var(--text-secondary)',cursor:'pointer',fontFamily:F,fontSize:'.85rem',padding:'4px 8px' }}>← رجوع</button>
              <div style={{ fontSize:'.72rem', color:'var(--text-secondary)', fontFamily:F }}>{step} من {maxStep-1}</div>
            </div>
            <div style={{ height:4, background:'rgba(0,0,0,0.08)', borderRadius:10, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${(step/(maxStep-1))*100}%`, background:G, borderRadius:10, transition:'width .4s' }}/>
            </div>
          </div>
        )}

        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', paddingTop:step===0?60:32 }}>

          {/* ══ STEP 0: WELCOME ══ */}
          {step === 0 && (
            <div className="fu" style={{ textAlign:'center' }}>
              {/* IMG-PLACEHOLDER: onboarding-welcome · 4:3 · welcome screen lifestyle photo */}
              <div className="img-placeholder" style={{width:'100%',aspectRatio:'4/3',borderRadius:20,marginBottom:24}}/>
              <div style={{ fontSize:'3rem', marginBottom:20 }}>🏆</div>
              <div style={{ fontWeight:900, fontSize:'1.8rem', marginBottom:10, lineHeight:1.2 }}>
                أهلاً في<br/><span style={{ color:G }}>GYM TRACKER GCC</span>
              </div>
              <p style={{ fontSize:'.9rem', color:'var(--text-secondary)', lineHeight:1.8, marginBottom:36, maxWidth:320, margin:'0 auto 36px' }}>
                دقيقتين ونجهّزلك برنامج تمرين وأكل مخصص لجسمك وحياتك في الخليج.
              </p>
              <button onClick={()=>setStep(1)} style={{ width:'100%', background:'#111111', color:'#FFFFFF', border:'none', borderRadius:9999, padding:'17px', fontFamily:F, fontWeight:900, fontSize:'1.05rem', cursor:'pointer', boxShadow:`0 6px 28px rgba(0,0,0,0.15)` }}>
                يلا نبدأ 🔥
              </button>
            </div>
          )}

          {/* ══ STEP 1: SEX ══ */}
          {step === 1 && (
            <div className="fu">
              <h2 style={{ fontSize:'1.3rem', fontWeight:900, marginBottom:6 }}>{STEPS[1].q}</h2>
              <p style={{ fontSize:'.83rem', color:'var(--text-secondary)', marginBottom:28 }}>{STEPS[1].sub}</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {[{id:'male',label:'ذكر',img:'/gender-male.webp'},{id:'female',label:'أنثى',img:'/gender-female.webp'}].map(s=>(
                  <div key={s.id} onClick={()=>{set('sex',s.id); setTimeout(()=>setStep(2),260)}}
                    style={{ border:`2px solid ${form.sex===s.id?'rgba(0,0,0,0.30)':'rgba(0,0,0,0.08)'}`, borderRadius:24, overflow:'hidden', cursor:'pointer', transition:'all .25s', position:'relative', background:'var(--surface)', boxShadow: form.sex===s.id?'0 0 24px rgba(0,0,0,0.10)':'none' }}>
                    <div style={{ position:'relative', aspectRatio:'3/4', overflow:'hidden' }}>
                      <img src={s.img} alt={s.label} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', display:'block', transform: form.sex===s.id?'scale(1.03)':'scale(1)', transition:'transform .25s' }} />
                      <div style={{ position:'absolute', bottom:0, insetInlineStart:0, insetInlineEnd:0, height:'40%', background:'linear-gradient(to top, var(--surface) 20%, transparent)' }} />
                    </div>
                    <div style={{ padding:'4px 16px 16px', fontWeight:800, fontSize:'1.15rem', color:'var(--text-primary)', textAlign:'center', letterSpacing:1 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ STEP 2: AGE + WEIGHT + HEIGHT ══ */}
          {step === 2 && (
            <div className="fu">
              <h2 style={{ fontSize:'1.3rem', fontWeight:900, marginBottom:6 }}>{STEPS[2].q}</h2>
              <p style={{ fontSize:'.83rem', color:'var(--text-secondary)', marginBottom:28 }}>{STEPS[2].sub}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {[
                  { key:'age',    label:'العمر',    placeholder:'مثال: 32', unit:'سنة',  type:'number', min:15, max:80 },
                  { key:'weight', label:'الوزن',    placeholder:'مثال: 95', unit:'كجم',  type:'number', min:30, max:300 },
                  { key:'height', label:'الطول',    placeholder:'مثال: 172', unit:'سم',  type:'number', min:100, max:230 },
                ].map(f=>(
                  <div key={f.key}>
                    <label style={{ display:'block', fontSize:'.78rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:8 }}>{f.label}</label>
                    <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                      <input type={f.type} inputMode="numeric" placeholder={f.placeholder} value={form[f.key]}
                        onChange={e=>set(f.key, e.target.value)}
                        style={{ flex:1, background:'rgba(0,0,0,0.04)', border:`1px solid ${form[f.key]?'rgba(0,0,0,0.18)':'rgba(0,0,0,0.10)'}`, color:'var(--text-primary)', padding:'14px 18px', borderRadius:14, fontFamily:F, fontSize:'1.1rem', fontWeight:700, direction:'ltr', textAlign:'center', transition:'border .2s' }}
                      />
                      <div style={{ fontWeight:700, color:'var(--text-secondary)', minWidth:28, textAlign:'right' }}>{f.unit}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ STEP 3: GOAL ══ */}
          {step === 3 && (
            <div className="fu">
              <h2 style={{ fontSize:'1.3rem', fontWeight:900, marginBottom:6 }}>{STEPS[3].q}</h2>
              <p style={{ fontSize:'.83rem', color:'var(--text-secondary)', marginBottom:28 }}>{STEPS[3].sub}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {(getContent(form.sex || 'male').goals).map(g=>(
                  <div key={g.id} onClick={()=>{set('goal',g.id); setTimeout(()=>setStep(4),260)}}
                    style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 20px', background:form.goal===g.id?'rgba(0,0,0,0.05)':'var(--card)', border:`1px solid ${form.goal===g.id?'rgba(0,0,0,0.18)':'rgba(0,0,0,0.08)'}`, borderRadius:18, cursor:'pointer', transition:'all .2s' }}>
                    <div style={{ fontSize:'1.8rem', flexShrink:0 }}>{g.icon}</div>
                    <div>
                      <div style={{ fontWeight:800, fontSize:'.95rem', color:form.goal===g.id?G:'var(--text-primary)', marginBottom:3 }}>{g.label}</div>
                      <div style={{ fontSize:'.76rem', color:'var(--text-secondary)' }}>{g.sub}</div>
                    </div>
                    {form.goal===g.id && <div style={{ marginInlineEnd:'auto', width:20, height:20, borderRadius:'50%', background:G, display:'flex', alignItems:'center', justifyContent:'center' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg></div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ STEP 4: DAYS + TIME ══ */}
          {step === 4 && (
            <div className="fu">
              <h2 style={{ fontSize:'1.3rem', fontWeight:900, marginBottom:6 }}>{STEPS[4].q}</h2>
              <p style={{ fontSize:'.83rem', color:'var(--text-secondary)', marginBottom:28 }}>{STEPS[4].sub}</p>

              <div style={{ marginBottom:28 }}>
                <div style={{ fontSize:'.78rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:12 }}>كم يوم في الأسبوع؟</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                  {[3,4,5].map(d=>(
                    <div key={d} onClick={()=>set('days',d)}
                      style={{ padding:'16px', textAlign:'center', background:form.days===d?'rgba(0,0,0,0.05)':'var(--card)', border:`1px solid ${form.days===d?'rgba(0,0,0,0.18)':'rgba(0,0,0,0.08)'}`, borderRadius:14, cursor:'pointer', transition:'all .2s' }}>
                      <div style={{ fontWeight:900, fontSize:'1.4rem', color:form.days===d?G:'var(--text-primary)', fontFamily:'monospace', lineHeight:1 }}>{d}</div>
                      <div style={{ fontSize:'.7rem', color:'var(--text-secondary)', marginTop:4 }}>يوم</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize:'.78rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:12 }}>كم دقيقة لكل تمرين؟</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                  {[{v:15,l:'15 دقيقة',s:'سريع'},{v:30,l:'30 دقيقة',s:'متوسط'},{v:45,l:'45 دقيقة',s:'كامل'}].map(t=>(
                    <div key={t.v} onClick={()=>set('time',t.v)}
                      style={{ padding:'16px 10px', textAlign:'center', background:form.time===t.v?'rgba(0,0,0,0.05)':'var(--card)', border:`1px solid ${form.time===t.v?'rgba(0,0,0,0.18)':'rgba(0,0,0,0.08)'}`, borderRadius:14, cursor:'pointer', transition:'all .2s' }}>
                      <div style={{ fontWeight:800, fontSize:'.88rem', color:form.time===t.v?G:'var(--text-primary)' }}>{t.l}</div>
                      <div style={{ fontSize:'.68rem', color:'var(--text-secondary)', marginTop:3 }}>{t.s}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ STEP 5: HEALTH ══ */}
          {step === 5 && (
            <div className="fu">
              <h2 style={{ fontSize:'1.3rem', fontWeight:900, marginBottom:6 }}>صحتك تهمنا 🏥</h2>
              <p style={{ fontSize:'.83rem', color:'var(--text-secondary)', marginBottom:8 }}>اختر كل ما ينطبق عليك — سنعدّل البرنامج والأكل بناءً على وضعك.</p>
              <div style={{ background:'rgba(251,146,60,0.06)', border:'1px solid rgba(251,146,60,0.2)', borderRadius:12, padding:'10px 14px', marginBottom:20, fontSize:'.75rem', color:'rgba(251,146,60,0.8)', lineHeight:1.6 }}>
                ⚠️ هذا التطبيق لأغراض اللياقة العامة فقط وليس بديلاً عن الاستشارة الطبية. استشر طبيبك قبل البدء.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:20 }}>
                {HEALTH_OPTIONS.filter(opt => opt.id !== 'pregnancy' || form.sex === 'female').map(opt => {
                  const selected = healthConditions.includes(opt.id)
                  const isBlocked = opt.risk === 'blocked'
                  return (
                    <div key={opt.id} onClick={() => {
                      if (opt.single) { setHealthConditions(selected ? [] : ['none']); return }
                      if (isBlocked) { setHealthConditions([opt.id]); return }
                      const without = healthConditions.filter(h => h !== 'none' && h !== opt.id)
                      setHealthConditions(selected ? without : [...without, opt.id])
                    }}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', background:selected?(isBlocked?'rgba(239,68,68,0.08)':'rgba(0,0,0,0.05)'):'var(--card)', border:`1px solid ${selected?(isBlocked?'rgba(239,68,68,0.3)':'rgba(0,0,0,0.18)'):'rgba(0,0,0,0.08)'}`, borderRadius:14, cursor:'pointer', transition:'all .15s' }}>
                      <div style={{ fontSize:'1.2rem', flexShrink:0 }}>{opt.icon}</div>
                      <div style={{ flex:1, fontWeight:600, fontSize:'.88rem', color:selected?(isBlocked?'#ef4444':'var(--text-primary)'):'var(--text-primary)' }}>{opt.label}</div>
                      <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${selected?(isBlocked?'#ef4444':'rgba(0,0,0,0.30)'):'rgba(0,0,0,0.15)'}`, background:selected?(isBlocked?'#ef4444':'rgba(0,0,0,0.15)'):'transparent', flexShrink:0 }}/>
                    </div>
                  )
                })}
              </div>
              {/* Blocked condition warning */}
              {(healthConditions.includes('heart') || healthConditions.includes('pregnancy')) && (
                <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:14, padding:'16px', marginBottom:16 }}>
                  <div style={{ fontWeight:800, color:'#ef4444', marginBottom:8 }}>⚠️ مهم جداً</div>
                  <div style={{ fontSize:'.85rem', color:'var(--text-primary)', lineHeight:1.7 }}>
                    {healthConditions.includes('heart')
                      ? 'مشاكل القلب تتطلب إشراف طبي قبل أي تمرين. يرجى استشارة طبيبك أولاً ثم العودة لإكمال التسجيل.'
                      : 'الحمل يتطلب برنامجاً خاصاً بإشراف طبي. يرجى استشارة طبيبك وقابلة معتمدة.'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ STEP 6: BODY SHAPE ══ */}
          {step === 6 && (
            <div className="fu">
              <h2 style={{ fontSize:'1.3rem', fontWeight:900, marginBottom:6 }}>{STEPS[6].q}</h2>
              <p style={{ fontSize:'.83rem', color:'var(--text-secondary)', marginBottom:28 }}>{STEPS[6].sub}</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {(form.sex==='female'?BODY_SHAPES_F:BODY_SHAPES_M).map(b=>(
                  <div key={b.id} onClick={()=>{set('bodyShape',b.id); setTimeout(()=>setStep(7),300)}}
                    style={{ background:'var(--surface)', border:`2px solid ${form.bodyShape===b.id?'rgba(0,0,0,0.30)':'rgba(0,0,0,0.08)'}`, borderRadius:20, overflow:'hidden', cursor:'pointer', transition:'all .25s', boxShadow: form.bodyShape===b.id?'0 0 20px rgba(0,0,0,0.08)':'none' }}>
                    <div style={{ aspectRatio:'1/1', overflow:'hidden', position:'relative' }}>
                      <img
                        src={`/body-shapes/${b.id}-${form.sex === 'female' ? 'female' : 'male'}.webp`}
                        alt={b.label}
                        style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', display:'block', transform: form.bodyShape===b.id?'scale(1.05)':'scale(1)', transition:'transform .25s', opacity: form.bodyShape===b.id ? 1 : 0.75 }}
                      />
                      <div style={{ position:'absolute', bottom:0, insetInlineStart:0, insetInlineEnd:0, height:'35%', background:'linear-gradient(to top, var(--surface) 10%, transparent)' }} />
                    </div>
                    <div style={{ padding:'6px 12px 12px', textAlign:'center' }}>
                      <div style={{ fontWeight:800, fontSize:'.9rem', color:'var(--text-primary)', marginBottom:2 }}>{b.label}</div>
                      <div style={{ fontSize:'.7rem', color:'var(--text-secondary)' }}>{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ STEP 6: RESULT + SAVE ══ */}
          {step === 7 && bmi && (
            <div className="fu">
              <div style={{ textAlign:'center', marginBottom:24 }}>
                <div style={{ fontSize:'1.8rem', marginBottom:10 }}>✅</div>
                <h2 style={{ fontSize:'1.2rem', fontWeight:900, marginBottom:4 }}>ملفك جاهز</h2>
                <p style={{ fontSize:'.82rem', color:'var(--text-secondary)' }}>هذه نتائج تحليلك الأولي</p>
              </div>

              <div style={{ background:'var(--card)', border:'1px solid rgba(0,0,0,0.08)', borderRadius:20, padding:22, marginBottom:20 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[
                    ['مؤشر الكتلة', bmi, bmiCat?.color, bmiCat?.ar],
                    ['نسبة الدهون', (bfFinal||bf)+'%', '#f97316', 'تقدير'],
                    ['هدف السعرات', calTarget, G, 'سعرة/يوم'],
                    ['أيام التمرين', form.days+' أيام', '#3b82f6', `${form.time} دقيقة`],
                  ].map(([l,v,c,s])=>(
                    <div key={l} style={{ background:'rgba(0,0,0,0.04)', borderRadius:14, padding:'14px', textAlign:'center' }}>
                      <div style={{ fontSize:'.65rem', color:'var(--text-secondary)', marginBottom:6, fontFamily:F }}>{l}</div>
                      <div style={{ fontWeight:900, fontSize:'1.2rem', color:c, fontFamily:'monospace', lineHeight:1 }}>{v}</div>
                      <div style={{ fontSize:'.68rem', color:c+'88', marginTop:4, fontFamily:F }}>{s}</div>
                    </div>
                  ))}
                </div>

                {/* Simple projection */}
                {form.goal==='lose' && calTarget && form.weight && (
                  <div style={{ marginTop:16, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:12, padding:'12px 16px', fontSize:'.82rem', color:'var(--text-secondary)', lineHeight:1.7 }}>
                    📈 إذا التزمت بالخطة — <span style={{ color:'#22c55e', fontWeight:700 }}>متوقع تخسر {Math.round(400*30/7700*10)/10} كجم أول شهر</span>
                  </div>
                )}
              </div>

              <button onClick={save} disabled={saving}
                style={{ width:'100%', background:'#111111', color:'#FFFFFF', border:'none', borderRadius:9999, padding:'17px', fontFamily:F, fontWeight:900, fontSize:'1.05rem', cursor:'pointer', boxShadow:`0 6px 28px rgba(0,0,0,0.15)` }}>
                {saving ? 'جاري الحفظ...' : 'ابدأ رحلتي 🚀'}
              </button>
            </div>
          )}
        </div>

        {/* NEXT BUTTON (for steps that need it) */}
        {[2, 4, 5, 6].includes(step) && (
          <div style={{ flexShrink:0, paddingBottom:20 }}>
            <button onClick={()=>setStep(s=>s+1)} disabled={!canNext}
              style={{ width:'100%', background:canNext?'#111111':'rgba(0,0,0,0.06)', color:canNext?'#FFFFFF':'var(--text-secondary)', border:'none', borderRadius:9999, padding:'15px', fontFamily:F, fontWeight:900, fontSize:'.98rem', cursor:canNext?'pointer':'not-allowed', transition:'all .2s', boxShadow:canNext?`0 4px 20px rgba(0,0,0,0.15)`:'none' }}>
              التالي →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
