import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { TopNav, BottomTabs } from '../components/Nav'

const MUSCLES = [
  { id:'Chest',     label:'الصدر',       icon:'🫁', sub:'الصدر العلوي · الأوسط · الداخلي',    color:'#ef4444', subs:['Upper Chest','Mid Chest','Lower Chest','Inner Chest'], subLabels:['الصدر العلوي','الصدر الأوسط','الصدر السفلي','الصدر الداخلي'] },
  { id:'Back',      label:'الظهر',       icon:'🔵', sub:'العريضة · الشبه منحرف · المعيني',    color:'#3b82f6', subs:['Lats','Upper Traps','Middle Traps','Rhomboids'], subLabels:['العريضة','شبه المنحرف العلوي','شبه المنحرف الأوسط','المعيني'] },
  { id:'Legs',      label:'الأرجل',      icon:'🦵', sub:'الفخذ الأمامي · أوتار الركبة · الأرداف', color:'#22c55e', subs:['Quads','Hamstrings','Glutes','Calves'], subLabels:['الفخذ الأمامي','أوتار الركبة','الأرداف','الساق'] },
  { id:'Shoulders', label:'الأكتاف',     icon:'💪', sub:'الدالية الأمامية · الجانبية · الخلفية', color:'#a855f7', subs:['Front Delts','Side Delts','Rear Delts'], subLabels:['الدالية الأمامية','الدالية الجانبية','الدالية الخلفية'] },
  { id:'Arms',      label:'الأذرع',      icon:'💪', sub:'الثنائي · الثلاثي · الساعد',          color:'#f97316', subs:['Biceps','Triceps','Forearms'], subLabels:['الثنائي','الثلاثي','الساعد'] },
  { id:'Core',      label:'البطن والجذع',icon:'🔥', sub:'عضلات البطن · المائلة · أسفل الظهر', color:'#eab308', subs:['Abs','Obliques','Transverse Abdominis'], subLabels:['عضلات البطن','المائلة','العميقة'] },
  { id:'Cardio',    label:'الكارديو',    icon:'❤️', sub:'تحمّل · قلب · حرق دهون',              color:'#06b6d4' },
]

const QUICK_PLANS = [
  { name:'يوم الدفع 🏋️',     label:'الصدر + الأكتاف + الأذرع',  muscles:['Chest','Shoulders','Arms'], icon:'🏋️' },
  { name:'يوم الشد 🔗',      label:'الظهر + الأذرع',             muscles:['Back','Arms'],               icon:'🔗' },
  { name:'يوم الأرجل 🦵',    label:'الأرجل + البطن والجذع',      muscles:['Legs','Core'],               icon:'🦵' },
  { name:'الجسم العلوي 💪',  label:'صدر + ظهر + أكتاف + أذرع',  muscles:['Chest','Back','Shoulders','Arms'], icon:'💪' },
  { name:'جسم كامل ⚡',      label:'كل العضلات الرئيسية',         muscles:['Chest','Back','Legs','Shoulders','Arms','Core'], icon:'⚡' },
  { name:'كارديو ❤️',        label:'حرق دهون + تحمّل',           muscles:['Cardio','Core'],             icon:'❤️' },
]

const todayStr = () => new Date().toISOString().split('T')[0]

export default function Workout() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [selected, setSelected] = useState([])
  const [expandedMuscle, setExpandedMuscle] = useState(null)
  const [date, setDate] = useState(todayStr())
  const [loading, setLoading] = useState(true)
  const [recentSessions, setRecentSessions] = useState([])
  const MC = { Chest:'#ef4444',Back:'#3b82f6',Legs:'#22c55e',Shoulders:'#a855f7',Arms:'#f97316',Core:'#eab308',Cardio:'#06b6d4' }
  const mc = m => MC[m]||'#6b7280'
  const labelAR = { Chest:'الصدر',Back:'الظهر',Legs:'الأرجل',Shoulders:'الأكتاف',Arms:'الأذرع',Core:'البطن والجذع',Cardio:'الكارديو' }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data:{session} }) => {
      if (!session?.user) { router.push('/'); return }
      setUser(session.user)
      try {
        const r = await fetch(`/api/sessions?userId=${session.user.id}`)
        const d = await r.json()
        setRecentSessions((d.sessions||[]).slice(0,3))
      } catch(e) {}
      setLoading(false)
    })
  }, [])

  const toggle = id => setSelected(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id])

  const startSession = () => {
    if (!selected.length) return
    try {
      localStorage.setItem('gt_v5', JSON.stringify({
        screen: 'upload', date, muscles: selected,
        imgPreview: null, pending: [], cidx: 0,
        done: [], cur: null, sessStart: null, exStart: null,
      }))
    } catch(e) {}
    router.push('/')
  }

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#09090B',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,border:'3px solid rgba(203,162,59,0.2)',borderTopColor:'#CBA23B',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#09090B',color:'var(--text-primary)',direction:'rtl'}}>
      <TopNav title="ابدأ تمرين اليوم 🔥" user={user} back="/"/>

      <div style={{padding:'20px 16px',maxWidth:520,margin:'0 auto'}}>

        {/* Date */}
        <div style={{marginBottom:20}}>
          <div className="label" style={{marginBottom:8}}>تاريخ التمرين</div>
          <input type="date" value={date} max={todayStr()} onChange={e=>setDate(e.target.value)}
            style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(203,162,59,0.15)',color:'var(--text-primary)',padding:'12px 16px',borderRadius:12,outline:'none',width:'100%',fontSize:'.95rem',transition:'border .2s',direction:'rtl'}}/>
          {date!==todayStr()&&<div style={{color:'#CBA23B',fontSize:'.75rem',marginTop:6,fontWeight:600}}>📅 تسجيل تمرين سابق</div>}
        </div>

        {/* Quote */}
        <div style={{background:'rgba(203,162,59,0.06)',border:'1px solid rgba(203,162,59,0.15)',borderRadius:14,padding:'14px 16px',marginBottom:20,textAlign:'right'}}>
          <div style={{fontSize:'.7rem',fontWeight:700,letterSpacing:1,color:'rgba(203,162,59,0.6)',marginBottom:4}}>💬 كلمة قبل التمرين</div>
          <div style={{fontFamily:"'Tajawal',sans-serif",fontSize:'.88rem',color:'var(--text-primary)',lineHeight:1.6,fontStyle:'italic'}}>
            "الجسم ما يبني نفسه."
          </div>
        </div>

        {/* Quick plans */}
        <div style={{marginBottom:20}}>
          <div className="label" style={{marginBottom:10}}>خطط جاهزة — اختر واضرب ⚡</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {QUICK_PLANS.map(plan=>{
              const active = plan.muscles.every(m=>selected.includes(m))&&selected.length===plan.muscles.length
              return (
                <button key={plan.name} onClick={()=>setSelected(plan.muscles)}
                  style={{background:active?'rgba(203,162,59,0.12)':'rgba(255,255,255,0.03)',border:`1px solid ${active?'rgba(203,162,59,0.4)':'rgba(203,162,59,0.12)'}`,borderRadius:12,padding:'12px 8px',cursor:'pointer',textAlign:'center',transition:'all .15s',direction:'rtl'}}>
                  <div style={{fontSize:'1.4rem',marginBottom:5}}>{plan.icon}</div>
                  <div style={{fontFamily:"'Tajawal',sans-serif",fontWeight:700,fontSize:'.75rem',color:active?'#CBA23B':'var(--text-primary)',lineHeight:1.2}}>{plan.name}</div>
                  <div style={{fontFamily:"'Tajawal',sans-serif",fontSize:'.55rem',color:'var(--text-muted)',marginTop:3,lineHeight:1.3}}>{plan.label}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Muscle selector */}
        <div style={{marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div className="label">شغّل العضلات الصح — الجسم يتذكر كل حركة</div>
            {selected.length>0&&<button onClick={()=>setSelected([])} style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:'.75rem',cursor:'pointer',fontFamily:"'Tajawal',sans-serif"}}>مسح الكل</button>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {MUSCLES.map(m=>{
              const sel = selected.includes(m.id)
              return (
                <React.Fragment key={m.id}>
                  <div onClick={()=>toggle(m.id)}
                    style={{background:sel?`${m.color}14`:'rgba(255,255,255,0.025)',border:`1px solid ${sel?m.color+'55':'rgba(203,162,59,0.10)'}`,borderRadius:14,padding:'13px 15px',cursor:'pointer',transition:'all .2s',display:'flex',alignItems:'center',gap:11,direction:'rtl'}}>
                    <div style={{width:36,height:36,borderRadius:10,background:sel?`${m.color}22`:'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',flexShrink:0,transition:'background .2s'}}>{m.icon}</div>
                    <div style={{minWidth:0,flex:1,textAlign:'right'}}>
                      <div style={{fontFamily:"'Tajawal',sans-serif",fontWeight:800,fontSize:'.92rem',color:sel?m.color:'var(--text-primary)',transition:'color .2s'}}>{m.label}</div>
                      <div style={{fontSize:'.6rem',color:sel?`${m.color}99`:'var(--text-muted)',marginTop:2,lineHeight:1.4}}>{m.sub}</div>
                    </div>
                    <div style={{display:'flex',gap:4,marginLeft:'auto',flexShrink:0}}>
                      {sel&&<div style={{width:20,height:20,borderRadius:'50%',background:m.color,display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg></div>}
                      {m.subs&&sel&&<button onClick={e=>{e.stopPropagation();setExpandedMuscle(expandedMuscle===m.id?null:m.id)}} style={{padding:'2px 8px',borderRadius:10,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',cursor:'pointer',color:'rgba(255,255,255,0.5)',fontSize:'.62rem',fontFamily:"'Tajawal',sans-serif"}}>تفصيل</button>}
                    </div>
                  </div>
                  {m.subs&&sel&&expandedMuscle===m.id&&(
                    <div style={{display:'flex',flexWrap:'wrap',gap:4,padding:'8px 12px 10px',background:`${m.color}08`,borderRadius:'0 0 12px 12px',border:`1px solid ${m.color}22`,borderTop:'none',marginTop:-4}} onClick={e=>e.stopPropagation()}>
                      {m.subs.map((sub,si)=>(
                        <button key={sub} onClick={e=>{e.stopPropagation();toggle(sub)}}
                          style={{padding:'4px 10px',borderRadius:14,fontSize:'.65rem',fontWeight:600,cursor:'pointer',fontFamily:"'Tajawal',sans-serif",background:selected.includes(sub)?m.color+'25':'rgba(255,255,255,0.04)',border:`1px solid ${selected.includes(sub)?m.color+'60':'rgba(255,255,255,0.08)'}`,color:selected.includes(sub)?m.color:'rgba(255,255,255,0.45)',transition:'all .15s'}}>
                          {m.subLabels[si]}
                        </button>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Selected summary */}
        {selected.length>0&&(
          <div style={{background:'rgba(203,162,59,0.06)',border:'1px solid rgba(203,162,59,0.15)',borderRadius:14,padding:'14px 16px',marginBottom:16,direction:'rtl'}}>
            <div style={{fontSize:'.72rem',fontWeight:700,letterSpacing:1,color:'rgba(203,162,59,0.7)',marginBottom:8,fontFamily:"'Tajawal',sans-serif"}}>هدفك اليوم 🎯</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {selected.map(m=>(
                <span key={m} style={{background:`${mc(m)}22`,border:`1px solid ${mc(m)}44`,color:mc(m),padding:'4px 11px',borderRadius:20,fontSize:'.72rem',fontWeight:700,fontFamily:"'Tajawal',sans-serif"}}>{labelAR[m]||m}</span>
              ))}
            </div>
          </div>
        )}

        {/* Start button */}
        <button onClick={startSession} disabled={!selected.length}
          style={{width:'100%',padding:'18px',background:selected.length?'#CBA23B':'rgba(255,255,255,0.06)',border:'none',borderRadius:14,fontFamily:"'Tajawal',sans-serif",fontWeight:800,fontSize:'1.05rem',color:selected.length?'#0C0B0D':'var(--text-muted)',cursor:selected.length?'pointer':'not-allowed',transition:'all .2s',boxShadow:selected.length?'0 4px 24px rgba(203,162,59,0.25)':'none',marginBottom:24,direction:'rtl'}}>
          {selected.length === 0
            ? 'حدّد هدفك وابدأ 🔥'
            : selected.length === 1
            ? 'ابدأ — عضلة واحدة 🔥'
            : selected.length === 2
            ? 'ابدأ — عضلتين 💪'
            : `ابدأ التمرين — ${selected.length} عضلات 🔥`}
        </button>

        {/* Recent sessions */}
        {recentSessions.length>0&&(
          <div>
            <div className="label" style={{marginBottom:10}}>آخر تمارينك</div>
            {recentSessions.map(s=>(
              <div key={s.id} style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,padding:'12px 14px',marginBottom:8,cursor:'pointer',transition:'all .15s',direction:'rtl'}}
                onClick={()=>router.push('/dashboard')}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                  <span style={{fontFamily:"'Tajawal',sans-serif",fontWeight:600,fontSize:'.85rem',color:'var(--text-primary)'}}>
                    {new Date((s.session_date||s.created_at?.split('T')[0])+'T12:00:00').toLocaleDateString('ar-SA',{weekday:'short',month:'short',day:'numeric'})}
                  </span>
                  <span style={{fontSize:'.75rem',color:'var(--text-muted)',fontFamily:"'Tajawal',sans-serif"}}>
                    {s.exercises?.reduce((a,ex)=>a+(ex.sets?.length||0),0)||0} مجموعة
                  </span>
                </div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {s.muscles_trained?.map(m=>(
                    <span key={m} style={{background:`${mc(m)}22`,color:mc(m),border:`1px solid ${mc(m)}33`,padding:'2px 8px',borderRadius:20,fontSize:'.65rem',fontWeight:600,fontFamily:"'Tajawal',sans-serif"}}>{labelAR[m]||m}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{height:'calc(80px + env(safe-area-inset-bottom))'}}/>
      <BottomTabs active="workout"/>
    </div>
  )
}
