import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { BottomTabs } from '../components/Nav'

const G = '#CBA23B', F = "'Tajawal',sans-serif"

function buildProgram(profile) {
  const goal = profile?.goal || 'weight'
  const bmi  = profile?.weight_kg && profile?.height_cm
    ? profile.weight_kg / Math.pow(profile.height_cm / 100, 2) : 28
  const bf   = profile?.body_fat_pct || 25

  if (goal === 'muscle') return {
    id:'muscle_21', name:'برنامج بناء العضل', days:21,
    tagline:'بناء عضل حقيقي مع أكل خليجي صحي',
    what:['تمارين قوة مخصصة للبيت','خطة بروتين من مطبخك الخليجي','متابعة أداء كل مجموعة','مدرب ذكي يتكيف مع أداءك'],
    expect:'ستلاحظ فرقاً واضحاً في الأسبوع الثالث',
  }
  if (bmi >= 30 || bf >= 30) return {
    id:'transform_30', name:'برنامج التحول الكامل', days:30,
    tagline:'30 يوم لتغيير حقيقي يبدأ اليوم',
    what:['تمارين بيتية يومية 25-35 دقيقة','خطة أكل كاملة من مطبخك الخليجي','متابعة أداء كل تمرين وكل وجبة','مدرب ذكي يعدّل البرنامج يومياً'],
    expect:'متوقع تخسر 2.5-3.5 كجم أول شهر مع الالتزام',
  }
  return {
    id:'transform_21', name:'برنامج التحول', days:21,
    tagline:'21 يوم تبني فيها العادة الصح',
    what:['تمارين بيتية يومية 20-30 دقيقة','خطة أكل من مطبخك الخليجي','متابعة أداء كل تمرين','مدرب ذكي يتكيف مع جسمك'],
    expect:'متوقع تخسر 1.5-2 كجم أول 21 يوم',
  }
}

export default function Packages() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [active, setActive] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/'); return }
      const u = session.user; setUser(u)
      const [pr, sr] = await Promise.all([
        fetch('/api/profile?userId=' + u.id).then(r => r.json()),
        fetch('/api/packages/status?userId=' + u.id).then(r => r.json()).catch(() => ({})),
      ])
      setProfile(pr.profile)
      if (sr.program) setActive(sr)
      setLoading(false)
    })
  }, [])

  const start = async () => {
    if (!user?.id || !profile) return
    setGenerating(true); setError(null)
    const prog = buildProgram(profile)
    try {
      const r = await fetch('/api/packages/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id, packageId: prog.id, packageName: prog.name,
          totalDays: prog.days,
          profile: {
            goal: profile.goal, fitness_level: profile.fitness_level || 'beginner',
            equipment: 'home', days_per_week: profile.days_per_week || 3,
            weight_kg: profile.weight_kg, height_cm: profile.height_cm,
            body_fat_pct: profile.body_fat_pct, calorie_target: profile.calorie_target,
            session_minutes: 30,
          }
        })
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'صار خطأ'); setGenerating(false); return }
      router.push('/program')
    } catch(e) { setError('تعذر الاتصال'); setGenerating(false) }
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#09090B', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:26, height:26, border:`3px solid rgba(203,162,59,0.15)`, borderTopColor:G, borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
    </div>
  )

  const prog = buildProgram(profile)
  const hasActive = !!active?.program
  const completedPct = hasActive ? Math.round(((active.completedDays||0) / (active.program.total_days||21)) * 100) : 0

  return (
    <div style={{ minHeight:'100vh', background:'#09090B', color:'#ECE3CF', fontFamily:F, direction:'rtl' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp .4s ease both}
      `}</style>

      {/* TOP BAR */}
      <div style={{ background:'linear-gradient(180deg,rgba(10,8,5,0.98),rgba(10,8,5,0.8))', backdropFilter:'blur(20px)', borderBottom:`1px solid rgba(203,162,59,0.12)`, padding:'13px 18px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:50 }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'1.1rem', padding:'4px 8px', lineHeight:1 }}>←</button>
        <div style={{ fontWeight:800, fontSize:'.92rem', color:'#ECE3CF' }}>برنامجي</div>
      </div>

      <div style={{ maxWidth:460, margin:'0 auto', padding:'24px 18px 100px' }}>

        {/* ACTIVE PROGRAM BANNER */}
        {hasActive && (
          <div className="fu" onClick={() => router.push('/program')}
            style={{ background:'linear-gradient(135deg,rgba(203,162,59,0.08),rgba(203,162,59,0.03))', border:`1px solid ${G}30`, borderRadius:20, padding:'18px 20px', marginBottom:24, cursor:'pointer', position:'relative', overflow:'hidden' }}>
            {/* Shimmer line */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${G},transparent)` }}/>
            <div style={{ fontSize:'.62rem', fontWeight:700, color:`${G}`, letterSpacing:2, marginBottom:8, textTransform:'uppercase' }}>برنامجك النشط ✓</div>
            <div style={{ fontWeight:900, fontSize:'1rem', marginBottom:10, color:'#ECE3CF' }}>{active.program.package_name}</div>
            <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:10, overflow:'hidden', marginBottom:8 }}>
              <div style={{ height:'100%', width:completedPct+'%', background:`linear-gradient(90deg,#8B6914,${G})`, borderRadius:10, boxShadow:`0 0 10px ${G}50`, transition:'width .6s' }}/>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.74rem', color:'rgba(255,255,255,0.45)' }}>
              <span>اليوم {active.program.current_day} من {active.program.total_days}</span>
              <span style={{ color:G, fontWeight:700 }}>اضغط للمتابعة ←</span>
            </div>
          </div>
        )}

        {/* PROGRAM CARD */}
        <div className="fu">

          {/* Decorative top border */}
          <div style={{ height:2, background:`linear-gradient(90deg,transparent,${G}60,transparent)`, borderRadius:1, marginBottom:28 }}/>

          {/* Program name */}
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <div style={{ fontWeight:900, fontSize:'1.5rem', color:'#ECE3CF', marginBottom:8, lineHeight:1.2 }}>{prog.name}</div>
            <div style={{ fontSize:'.88rem', color:'rgba(255,255,255,0.45)', lineHeight:1.7 }}>{prog.tagline}</div>
          </div>

          {/* Duration + type badges */}
          <div style={{ display:'flex', justifyContent:'center', gap:8, marginBottom:24 }}>
            {[['📅', prog.days + ' يوم'], ['🏠', 'بيت'], ['🤖', 'متكيف']].map(([ic, lbl]) => (
              <div key={lbl} style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.04)', border:`1px solid rgba(203,162,59,0.15)`, borderRadius:20, padding:'6px 14px', fontSize:'.78rem', color:'rgba(255,255,255,0.6)' }}>
                <span>{ic}</span><span>{lbl}</span>
              </div>
            ))}
          </div>

          {/* What you get */}
          <div style={{ background:'rgba(255,255,255,0.02)', border:`1px solid rgba(203,162,59,0.1)`, borderRadius:18, padding:'20px', marginBottom:14 }}>
            <div style={{ fontSize:'.65rem', fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:2, marginBottom:16, textTransform:'uppercase' }}>ما ستحصل عليه</div>
            {prog.what.map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:14, marginBottom: i < prog.what.length - 1 ? 14 : 0 }}>
                {/* Gold checkmark */}
                <div style={{ width:22, height:22, borderRadius:6, background:`rgba(203,162,59,0.12)`, border:`1.5px solid ${G}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
                <div style={{ fontSize:'.88rem', color:'rgba(255,255,255,0.78)', lineHeight:1.4 }}>{item}</div>
              </div>
            ))}
          </div>

          {/* Expected result */}
          <div style={{ background:`rgba(203,162,59,0.05)`, border:`1px solid rgba(203,162,59,0.15)`, borderRadius:14, padding:'14px 18px', marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:'1.1rem' }}>📈</span>
              <span style={{ fontSize:'.85rem', color:'rgba(255,255,255,0.65)', lineHeight:1.6 }}>{prog.expect}</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:12, padding:'12px 16px', marginBottom:14, fontSize:'.84rem', color:'#ef4444' }}>
              ⚠️ {error}
            </div>
          )}

          {/* CTA */}
          {hasActive ? (
            <button onClick={() => router.push('/program')}
              style={{ width:'100%', background:`linear-gradient(135deg,${G},#8B6914)`, color:'#09090B', border:'none', borderRadius:16, padding:'17px', fontFamily:F, fontWeight:900, fontSize:'1rem', cursor:'pointer', boxShadow:`0 6px 28px rgba(203,162,59,0.35)`, letterSpacing:.5 }}>
              متابعة برنامجي الحالي ←
            </button>
          ) : (
            <button onClick={start} disabled={generating}
              style={{ width:'100%', background:generating ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg,${G},#8B6914)`, color:generating ? 'rgba(255,255,255,0.3)' : '#09090B', border:'none', borderRadius:16, padding:'17px', fontFamily:F, fontWeight:900, fontSize:'1rem', cursor:generating ? 'not-allowed' : 'pointer', boxShadow:generating ? 'none' : `0 6px 28px rgba(203,162,59,0.35)`, transition:'all .2s', letterSpacing:.5 }}>
              {generating ? (
                <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                  <span style={{ width:16, height:16, border:'2px solid rgba(0,0,0,0.2)', borderTopColor:'rgba(0,0,0,0.6)', borderRadius:'50%', animation:'spin .8s linear infinite', display:'inline-block' }}/>
                  يبني برنامجك...
                </span>
              ) : 'ابدأ برنامجك الآن 🔥'}
            </button>
          )}
        </div>
      </div>
      <BottomTabs active="program"/>
    </div>
  )
}
