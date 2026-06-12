import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { calcBodyFat, recommendPackage } from '../lib/bodyFat'

const G = '#111111', F = "'Tajawal',sans-serif"

const BODY_SHAPES = [
  { id:'slim',   icon:'🟡', label:'رشيق / نحيف',   bfMod:-4 },
  { id:'normal', icon:'🟠', label:'طبيعي',           bfMod:0  },
  { id:'belly',  icon:'🔴', label:'بطن واضحة',       bfMod:5  },
  { id:'obese',  icon:'🔴', label:'وزن زائد كبير',   bfMod:10 },
]

// ── SVG MEASUREMENT GUIDES ─────────────────────────────────────────
function NeckGuide() {
  return (
    <svg viewBox="0 0 160 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:140,height:175,display:'block',margin:'0 auto'}}>
      {/* Head */}
      <ellipse cx="80" cy="38" rx="28" ry="32" fill="rgba(0,0,0,0.05)" stroke="rgba(0,0,0,0.20)" strokeWidth="1.5"/>
      {/* Neck */}
      <rect x="66" y="68" width="28" height="36" rx="4" fill="rgba(0,0,0,0.05)" stroke="rgba(0,0,0,0.20)" strokeWidth="1.5"/>
      {/* Shoulders */}
      <path d="M30 104 Q50 95 66 104 L66 130 Q50 125 30 130 Z" fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.10)" strokeWidth="1.5"/>
      <path d="M94 104 Q110 95 130 104 L130 130 Q110 125 94 130 Z" fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.10)" strokeWidth="1.5"/>
      {/* Measurement line - neck */}
      <line x1="50" y1="82" x2="110" y2="82" stroke={G} strokeWidth="2" strokeDasharray="4 3"/>
      <circle cx="50" cy="82" r="3.5" fill={G}/>
      <circle cx="110" cy="82" r="3.5" fill={G}/>
      {/* Label */}
      <text x="80" y="155" textAnchor="middle" fill={G} fontSize="11" fontFamily="Tajawal,sans-serif">محيط العنق</text>
      <text x="80" y="172" textAnchor="middle" fill="rgba(0,0,0,0.35)" fontSize="9" fontFamily="Tajawal,sans-serif">أسفل تفاحة آدم</text>
      {/* Arrow indicating location */}
      <path d="M80 92 L80 78" stroke={G} strokeWidth="1.5" markerEnd="url(#arr)"/>
      <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={G}/></marker></defs>
    </svg>
  )
}

function WaistGuide() {
  return (
    <svg viewBox="0 0 160 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:140,height:195,display:'block',margin:'0 auto'}}>
      {/* Body outline */}
      <path d="M55 20 Q80 15 105 20 L112 60 Q100 55 80 53 Q60 55 48 60 Z" fill="rgba(0,0,0,0.05)" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5"/>
      {/* Torso - narrowing to waist */}
      <path d="M48 60 Q42 80 45 100 Q52 110 80 112 Q108 110 115 100 Q118 80 112 60 Q100 55 80 53 Q60 55 48 60 Z" fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5"/>
      {/* Hips */}
      <path d="M45 100 Q35 115 38 135 Q50 145 80 147 Q110 145 122 135 Q125 115 115 100 Q108 110 80 112 Q52 110 45 100 Z" fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.10)" strokeWidth="1.5"/>
      {/* Navel dot */}
      <circle cx="80" cy="100" r="3" fill="rgba(0,0,0,0.20)"/>
      {/* Measurement line - waist */}
      <line x1="30" y1="88" x2="130" y2="88" stroke={G} strokeWidth="2" strokeDasharray="4 3"/>
      <circle cx="30" cy="88" r="3.5" fill={G}/>
      <circle cx="130" cy="88" r="3.5" fill={G}/>
      {/* Bracket */}
      <path d="M30 84 L30 92" stroke={G} strokeWidth="1.5"/>
      <path d="M130 84 L130 92" stroke={G} strokeWidth="1.5"/>
      {/* Label */}
      <text x="80" y="170" textAnchor="middle" fill={G} fontSize="11" fontFamily="Tajawal,sans-serif">محيط الخصر</text>
      <text x="80" y="187" textAnchor="middle" fill="rgba(0,0,0,0.35)" fontSize="9" fontFamily="Tajawal,sans-serif">عند السرة أو أضيق نقطة</text>
    </svg>
  )
}

function HipsGuide() {
  return (
    <svg viewBox="0 0 160 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:140,height:195,display:'block',margin:'0 auto'}}>
      {/* Torso */}
      <path d="M52 20 Q80 15 108 20 L115 65 Q100 60 80 58 Q60 60 45 65 Z" fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.10)" strokeWidth="1.5"/>
      {/* Waist */}
      <path d="M45 65 Q40 80 44 92 Q55 98 80 100 Q105 98 116 92 Q120 80 115 65 Q100 60 80 58 Q60 60 45 65 Z" fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.08)" strokeWidth="1.5"/>
      {/* Hips - wider */}
      <path d="M44 92 Q28 105 30 130 Q42 148 80 150 Q118 148 130 130 Q132 105 116 92 Q105 98 80 100 Q55 98 44 92 Z" fill="rgba(0,0,0,0.05)" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5"/>
      {/* Measurement line - hips (widest point) */}
      <line x1="20" y1="120" x2="140" y2="120" stroke={G} strokeWidth="2" strokeDasharray="4 3"/>
      <circle cx="20" cy="120" r="3.5" fill={G}/>
      <circle cx="140" cy="120" r="3.5" fill={G}/>
      <path d="M20 116 L20 124" stroke={G} strokeWidth="1.5"/>
      <path d="M140 116 L140 124" stroke={G} strokeWidth="1.5"/>
      {/* Label */}
      <text x="80" y="173" textAnchor="middle" fill={G} fontSize="11" fontFamily="Tajawal,sans-serif">محيط الأرداف</text>
      <text x="80" y="190" textAnchor="middle" fill="rgba(0,0,0,0.35)" fontSize="9" fontFamily="Tajawal,sans-serif">أعرض نقطة في الأرداف</text>
    </svg>
  )
}

// ── RESULT CIRCLE ──────────────────────────────────────────────────
function BFCircle({ bf, color }) {
  const pct = Math.min(100, bf)
  const r = 52, circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width="130" height="130" viewBox="0 0 130 130" style={{display:'block',margin:'0 auto'}}>
      <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth="10"/>
      <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ * 0.25}
        strokeLinecap="round" style={{transition:'stroke-dasharray 1s ease'}}/>
      <text x="65" y="60" textAnchor="middle" fill={color} fontSize="24" fontWeight="900" fontFamily="monospace">{bf}%</text>
      <text x="65" y="78" textAnchor="middle" fill="rgba(0,0,0,0.35)" fontSize="11" fontFamily="Tajawal,sans-serif">نسبة الدهون</text>
    </svg>
  )
}

export default function Assessment() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [track, setTrack] = useState(null)          // null | 'photo' | 'measure'
  const [step, setStep] = useState(0)               // 0=neck 1=waist 2=hips 3=result 4=package
  const [form, setForm] = useState({ neck: '', waist: '', hips: '' })
  const [result, setResult] = useState(null)
  const [pkg, setPkg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/'); return }
      setUser(session.user)
      const r = await fetch(`/api/profile?userId=${session.user.id}`)
      const d = await r.json()
      setProfile(d.profile)
      // Pre-fill if data exists
      if (d.profile?.neck_cm) setForm(f => ({ ...f, neck: d.profile.neck_cm }))
      if (d.profile?.waist_cm) setForm(f => ({ ...f, waist: d.profile.waist_cm }))
      if (d.profile?.hips_cm) setForm(f => ({ ...f, hips: d.profile.hips_cm }))
    })
  }, [])

  const isMale = profile?.sex === 'male' || !profile?.sex
  const weight = parseFloat(profile?.weight_kg) || 75
  const height = parseFloat(profile?.height_cm) || 175

  const calculate = () => {
    const neck  = parseFloat(form.neck)
    const waist = parseFloat(form.waist)
    const hips  = parseFloat(form.hips)
    if (!neck || !waist || (!isMale && !hips)) return

    const res = calcBodyFat({ neck, waist, hips: isMale ? 0 : hips, height, sex: isMale ? 'male' : 'female', weight })
    setResult(res)
    const p = recommendPackage({ bf: res.bf, goal: profile?.goal, level: profile?.fitness_level, sex: isMale ? 'male' : 'female' })
    setPkg(p)
    setStep(3)
  }

  const saveAndContinue = async () => {
    if (!user?.id || !result) return
    setSaving(true)
    // Calculate lean/fat mass
    const bf  = result.bf || 0
    const fatMass  = result.bmi ? Math.round(((profile?.weight_kg||0) * bf / 100) * 10) / 10 : null
    const leanMass = result.bmi && profile?.weight_kg ? Math.round((profile.weight_kg - (fatMass||0)) * 10) / 10 : null
    // Make sure pkg is set from result
    if (!pkg && result.rec) setPkg(result.rec)
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        body_fat_pct:        bf || null,
        lean_mass_kg:        leanMass,
        fat_mass_kg:         fatMass,
        body_fat_method:     'bmi_deurenberg',
        body_fat_updated_at: new Date().toISOString(),
        recommended_package: result.rec?.id || null,
        package_updated_at:  new Date().toISOString(),
      })
    })
    setSaving(false)
    setSaved(true)
    setStep(4)
  }

  const [bodyShape, setBodyShape] = useState(null)

  // curStep removed — using BMI+visual body shape method

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', color: 'var(--text-primary)', direction: 'rtl', fontFamily: F }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} .fu{animation:fadeUp .4s ease both}`}</style>

      {/* TOP BAR */}
      <div style={{ background: 'rgba(244,244,245,0.9)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => track ? (step > 0 ? setStep(s => s - 1) : setTrack(null)) : router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem', padding: '4px 8px', flexShrink: 0 }}>←</button>
        <div style={{ fontWeight: 800, fontSize: '.92rem' }}>تحليل التكوين الجسمي</div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '24px 18px 80px' }}>

        {/* ── TRACK SELECTION (shown when track is null) ── */}
        {!track && (
          <div className="fu">
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div style={{ fontSize:'1.8rem', marginBottom:12 }}>🔍</div>
              <h2 style={{ fontSize:'1.2rem', fontWeight:900, marginBottom:6 }}>كيف تريد التحليل؟</h2>
              <p style={{ fontSize:'.84rem', color:'var(--text-secondary)', lineHeight:1.7 }}>اختر الطريقة الأنسب لك</p>
            </div>

            {/* Photo track */}
            <div onClick={() => router.push('/body')}
              style={{ background:'linear-gradient(135deg,rgba(0,0,0,0.05),rgba(0,0,0,0.03))', border:'1px solid rgba(0,0,0,0.10)', borderRadius:20, padding:22, marginBottom:14, cursor:'pointer', transition:'all .2s' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(0,0,0,0.18)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(0,0,0,0.10)'}>
              <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
                <div style={{ width:52, height:52, borderRadius:14, background:'rgba(0,0,0,0.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.6rem', flexShrink:0 }}>📸</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:6 }}>تحليل بالصورة</div>
                  <div style={{ fontSize:'.82rem', color:'var(--text-secondary)', lineHeight:1.6 }}>التقط صورة وسيحلل الذكاء الاصطناعي تكوين جسمك بدقة عالية.</div>
                  <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                    {['✓ دقة أعلى', '✓ تحليل فوري', '✓ بدون قياسات'].map(t=>(
                      <span key={t} style={{ background:'rgba(0,0,0,0.05)', color:'var(--text-secondary)', padding:'3px 9px', borderRadius:20, fontSize:'.68rem', fontWeight:600 }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* BMI track */}
            <div onClick={() => { setTrack('measure'); setStep(0) }}
              style={{ background:'var(--card)', border:'1px solid rgba(0,0,0,0.08)', borderRadius:20, padding:22, cursor:'pointer', transition:'all .2s' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(0,0,0,0.18)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(0,0,0,0.08)'}>
              <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
                <div style={{ width:52, height:52, borderRadius:14, background:'rgba(59,130,246,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.6rem', flexShrink:0 }}>📐</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:6 }}>تحليل بالمؤشرات</div>
                  <div style={{ fontSize:'.82rem', color:'var(--text-secondary)', lineHeight:1.6 }}>معادلة Deurenberg (BMI + شكل الجسم) — بدون صورة ولا قياسات.</div>
                  <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                    {['✓ بدون صورة', '✓ خصوصية كاملة', '✓ 30 ثانية'].map(t=>(
                      <span key={t} style={{ background:'rgba(59,130,246,0.1)', color:'#3b82f6', padding:'3px 9px', borderRadius:20, fontSize:'.68rem', fontWeight:600 }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {track === 'measure' && step === 0 && (
          <div className="fu">
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ fontSize:'1.6rem', marginBottom:10 }}>📐</div>
              <h2 style={{ fontSize:'1.2rem', fontWeight:900, marginBottom:6 }}>اختر شكل جسمك الحالي</h2>
              <p style={{ fontSize:'.82rem', color:'var(--text-secondary)', lineHeight:1.7 }}>
                نستخدم معادلة Deurenberg العلمية (BMI + شكل الجسم) لتقدير نسبة الدهون.
              </p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
              {BODY_SHAPES.map(s=>(
                <div key={s.id} onClick={()=>setBodyShape(s.id)}
                  style={{ padding:'18px 14px', background:bodyShape===s.id?'rgba(0,0,0,0.05)':'var(--card)', border:`1px solid ${bodyShape===s.id?'rgba(0,0,0,0.18)':'rgba(0,0,0,0.08)'}`, borderRadius:16, cursor:'pointer', textAlign:'center', transition:'all .2s' }}>
                  <div style={{ fontSize:'1.8rem', marginBottom:8 }}>{s.icon}</div>
                  <div style={{ fontWeight:700, fontSize:'.88rem', color:bodyShape===s.id?'var(--text-primary)':'var(--text-primary)' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <button
              disabled={!bodyShape}
              onClick={() => {
                if (!profile?.weight_kg || !profile?.height_cm) return
                const sex = profile.sex || 'male'
                const age = profile.birthday
                  ? Math.floor((Date.now() - new Date(profile.birthday)) / 31557600000)
                  : 35
                const bmi = profile.weight_kg / Math.pow(profile.height_cm / 100, 2)
                const baseBf = sex === 'female'
                  ? (1.20 * bmi) + (0.23 * age) - 5.4
                  : (1.20 * bmi) + (0.23 * age) - 16.2
                const shapeMod = BODY_SHAPES.find(b=>b.id===bodyShape)?.bfMod || 0
                const bf = Math.max(5, Math.min(60, Math.round((baseBf + shapeMod) * 10) / 10))
                const rec = recommendPackage(bf, sex)
                setResult({ bf, bmi: Math.round(bmi * 10)/10, method: 'bmi_deurenberg', rec })
                setStep(3)
              }}
              style={{ width:'100%', background:bodyShape?'#111111':'rgba(0,0,0,0.06)', color:bodyShape?'#FFFFFF':'var(--text-secondary)', border:'none', borderRadius:9999, padding:'15px', fontFamily:"'Tajawal',sans-serif", fontWeight:900, fontSize:'1rem', cursor:bodyShape?'pointer':'not-allowed', transition:'all .2s', boxShadow:bodyShape?'0 4px 20px rgba(0,0,0,0.15)':'none' }}>
              احسب نسبة الدهون ←
            </button>
            {(!profile?.weight_kg || !profile?.height_cm) && (
              <div style={{ marginTop:12, fontSize:'.78rem', color:'#f97316', textAlign:'center' }}>
                ⚠️ يجب إكمال بيانات الطول والوزن في الملف الشخصي أولاً
              </div>
            )}
          </div>
        )}

        {/* ── RESULT ── */}

        {track === 'measure' && step === 3 && result && (
          <div className="fu">
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: 4 }}>نتيجة تحليلك</h2>
              <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>معادلة Deurenberg — دقة ±3%</p>
            </div>

            {/* BF Circle */}
            <div style={{ background: 'var(--card)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 24, padding: '28px 20px', marginBottom: 16, textAlign: 'center' }}>
              <BFCircle bf={result.bf} color={result.color} />
              <div style={{ marginTop: 16 }}>
                <span style={{ background: result.color + '20', color: result.color, border: `1px solid ${result.color}44`, padding: '5px 16px', borderRadius: 20, fontSize: '.82rem', fontWeight: 800 }}>
                  {result.categoryAr}
                </span>
              </div>
            </div>

            {/* Body composition breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                ['⚖️ الوزن الكلي', `${weight} كجم`, G],
                ['💪 الكتلة العضلية', `${result.lean} كجم`, '#22c55e'],
                ['🔥 كتلة الدهون', `${result.fat} كجم`, result.color],
                ['📊 نسبة الدهون', `${result.bf}%`, result.color],
              ].map(([l, v, c]) => (
                <div key={l} style={{ background: 'var(--card)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginBottom: 6 }}>{l}</div>
                  <div style={{ fontWeight: 900, fontSize: '1.1rem', color: c, fontFamily: 'monospace' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Reference scale */}
            <div style={{ background: 'var(--card)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '14px 16px', marginBottom: 24 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, letterSpacing: 1 }}>مرجع: {isMale ? 'ذكور' : 'إناث'}</div>
              {(isMale
                ? [['رياضي', '6-13%', '#22c55e'], ['لياقة', '14-17%', G], ['مقبول', '18-24%', '#f97316'], ['زيادة', '25%+', '#ef4444']]
                : [['رياضية', '14-20%', '#22c55e'], ['لياقة', '21-24%', G], ['مقبول', '25-31%', '#f97316'], ['زيادة', '32%+', '#ef4444']]
              ).map(([cat, range, c]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <span style={{ fontSize: '.8rem', color: c, fontWeight: 600 }}>{cat}</span>
                  <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{range}</span>
                </div>
              ))}
            </div>

            {/* Save + continue */}
            <button onClick={saveAndContinue} disabled={saving}
              style={{ width: '100%', background: '#111111', color: '#FFFFFF', border: 'none', borderRadius: 9999, padding: '16px', fontFamily: F, fontWeight: 900, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', marginBottom: 10 }}>
              {saving ? 'جاري الحفظ...' : 'حفظ وشوف الباقة المناسبة لي ←'}
            </button>
            <button onClick={() => { setStep(0); setResult(null) }} style={{ width: '100%', background: 'none', border: '1px solid rgba(0,0,0,0.10)', color: 'var(--text-secondary)', borderRadius: 9999, padding: '13px', fontFamily: F, cursor: 'pointer', fontSize: '.85rem' }}>
              أعد القياس
            </button>
          </div>
        )}

        {/* ══ PACKAGE RECOMMENDATION ══ */}
        {step === 4 && pkg && result && (
          <div className="fu">
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>الباقة المناسبة لك</div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 900 }}>بناءً على تحليلك وهدفك</h2>
            </div>

            {/* Package card */}
            <div style={{ background: `linear-gradient(135deg,${pkg.color}14,${pkg.color}06)`, border: `1px solid ${pkg.color}44`, borderRadius: 24, padding: 28, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: pkg.color + '20', border: `1px solid ${pkg.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0 }}>
                  {pkg.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '1.15rem', color: pkg.color }}>{pkg.name}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)', marginTop: 3 }}>{pkg.days} يوم · {pkg.intensity}</div>
                </div>
              </div>
              <p style={{ fontSize: '.88rem', color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 16 }}>{pkg.description}</p>
              <div style={{ background: 'rgba(0,0,0,0.05)', borderRadius: 12, padding: '12px 14px', fontSize: '.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <span style={{ color: pkg.color, fontWeight: 700 }}>لماذا هذه الباقة؟ </span>{pkg.why}
              </div>
            </div>

            {/* Summary */}
            <div style={{ background: 'var(--card)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: '16px 18px', marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['نسبة الدهون', `${result.bf}%`, result.color], ['التصنيف', result.categoryAr, result.color], ['الكتلة العضلية', `${result.lean} كجم`, '#22c55e'], ['كتلة الدهون', `${result.fat} كجم`, '#f97316']].map(([l, v, c]) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '.68rem', color: 'var(--text-secondary)', marginBottom: 4 }}>{l}</div>
                    <div style={{ fontWeight: 800, color: c, fontSize: '.95rem' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <button onClick={() => router.push('/packages?recommended=' + (pkg?.id||''))} style={{ width: '100%', background: '#111111', color: '#FFFFFF', border: 'none', borderRadius: 9999, padding: '16px', fontFamily: F, fontWeight: 900, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', marginBottom: 10 }}>
              🏋️ ابدأ باقتي الآن →
            </button>
            <button onClick={() => router.push('/settings')} style={{ width: '100%', background: 'none', border: '1px solid rgba(0,0,0,0.10)', color: 'var(--text-secondary)', borderRadius: 9999, padding: '13px', fontFamily: F, cursor: 'pointer', fontSize: '.85rem' }}>
              ⚙️ تعديل البيانات
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
