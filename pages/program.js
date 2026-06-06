import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { BottomTabs } from '../components/Nav'
import { calcNutrientGoals } from '../lib/nutrition'

const G = '#CBA23B', F = "'Tajawal',sans-serif"

// ── Audio beep ────────────────────────────────────────────────────
function beep(freq=880,dur=0.3){try{const a=new(window.AudioContext||window.webkitAudioContext)();const o=a.createOscillator();const g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(0.5,a.currentTime);g.gain.exponentialRampToValueAtTime(0.01,a.currentTime+dur);o.start(a.currentTime);o.stop(a.currentTime+dur)}catch(e){}}

// ── Workout phrases (used once at start) ─────────────────────────
const PHRASES_M=[
  {ar:'المُؤْمِنُ القَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللهِ',sub:'قوِّ عزيمتك وسمِّ الله وابدأ.'},
  {ar:'بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ',sub:'ابدأ تمرينك باسم الله.'},
  {ar:'احْرِصْ عَلَى مَا يَنْفَعُكَ وَاسْتَعِنْ بِاللهِ',sub:'ابدأ وخذ بالأسباب.'},
  {ar:'فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللهِ',sub:'عزمت؟ توكّل وانطلق.'},
]
const PHRASES_F=[
  {ar:'المُؤْمِنُ القَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللهِ',sub:'قوِّ عزيمتكِ وسمِّ الله وابدئي.'},
  {ar:'بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ',sub:'ابدئي تمرينكِ باسم الله.'},
  {ar:'احْرِصْ عَلَى مَا يَنْفَعُكَ وَاسْتَعِنْ بِاللهِ',sub:'ابدئي وخذي بالأسباب.'},
  {ar:'فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللهِ',sub:'ابدئي بخطوة وتوكلي على الله.'},
]

// ── Cooldown — adapted to muscles trained ────────────────────────
function buildCooldown(muscles=[]) {
  const all = [
    {name:'تمديد البطن | Cobra Stretch', target:'البطن والظهر', muscles:['البطن','الظهر السفلي','Core'], dur:30},
    {name:'تمديد الأرجل | Hamstring', target:'أوتار الركبة', muscles:['الأرجل','Legs'], dur:30},
    {name:'تمديد الكتفين | Shoulder Cross', target:'الكتفين', muscles:['الصدر/الكتفين','Chest','Shoulders','Arms'], dur:30},
    {name:'وضع الطفل | Child Pose', target:'الظهر والكتفين', muscles:['الظهر','Back','Core','الظهر السفلي'], dur:40},
    {name:'تمديد الأرداف | Glute Stretch', target:'الأرداف', muscles:['الأرجل','Legs','المؤخرة'], dur:30},
    {name:'تدوير الرقبة | Neck Roll', target:'الرقبة', muscles:['الجسم كامل','Shoulders'], dur:20},
  ]
  const flat = muscles.map(m=>m.toLowerCase())
  const relevant = all.filter(c=>c.muscles.some(cm=>flat.some(m=>m.includes(cm.toLowerCase())||cm.toLowerCase().includes(m))))
  return relevant.length >= 2 ? relevant.slice(0,3) : all.slice(0,3)
}

// ── Timed exercise (warmup & cooldown) ───────────────────────────
function TimedExercise({exercise, index, total, label, color, onDone, sex}) {
  const dur = exercise.duration_seconds || exercise.dur || 30
  const [left, setLeft] = useState(dur)
  const ref = useRef(null)

  useEffect(()=>{
    ref.current = setInterval(()=>{
      setLeft(p=>{
        if(p<=1){clearInterval(ref.current);beep(660,0.2);setTimeout(()=>beep(880,0.3),300);onDone();return 0}
        if(p<=3)beep(440,0.08)
        return p-1
      })
    },1000)
    return ()=>clearInterval(ref.current)
  },[])

  const pct=((dur-left)/dur)*100
  const c2=color||G
  const imgSex = sex === 'female' ? 'female' : 'male'
  const imgSrc = exercise.imageKey ? `/exercises/${exercise.imageKey}-${imgSex}.png` : null

  return (
    <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${c2}22`,borderRadius:18,overflow:'hidden'}}>
      {/* Exercise image */}
      {imgSrc && (
        <div style={{width:'100%',height:220,background:'#0d0d0a',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',borderBottom:`1px solid ${c2}18`}}>
          <img src={imgSrc} alt={exercise.name} onError={e=>{e.target.parentNode.style.display='none'}}
            style={{height:'100%',width:'100%',objectFit:'contain',objectPosition:'center'}}/>
        </div>
      )}

      <div style={{padding:'16px 20px',textAlign:'center'}}>
        <div style={{fontSize:'.65rem',fontWeight:700,color:c2,letterSpacing:2,marginBottom:8,textTransform:'uppercase'}}>
          {label} · {index+1} من {total}
        </div>
        <div style={{fontWeight:800,fontSize:'1.05rem',color:'#ECE3CF',marginBottom:4}}>{exercise.name}</div>
        {exercise.target && <div style={{fontSize:'.72rem',color:c2,marginBottom:8,fontWeight:600}}>{exercise.target}</div>}

        {/* Steps list */}
        {exercise.steps?.length > 0 ? (
          <div style={{textAlign:'right',margin:'10px 0 14px',display:'flex',flexDirection:'column',gap:5}}>
            {exercise.steps.map((s,i)=>(
              <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:'.78rem',color:'rgba(255,255,255,0.55)',lineHeight:1.5}}>
                <span style={{color:c2,fontWeight:900,fontSize:'.72rem',minWidth:18,marginTop:1}}>{i+1}.</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        ) : exercise.instructions ? (
          <div style={{fontSize:'.78rem',color:'rgba(255,255,255,0.45)',marginBottom:14,lineHeight:1.5}}>{exercise.instructions}</div>
        ) : null}

        {/* Timer ring */}
        <div style={{position:'relative',width:84,height:84,margin:'0 auto 14px'}}>
          <svg width="84" height="84" viewBox="0 0 84 84" style={{transform:'rotate(-90deg)'}}>
            <circle cx="42" cy="42" r="36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
            <circle cx="42" cy="42" r="36" fill="none" stroke={c2} strokeWidth="7"
              strokeDasharray={`${pct/100*2*Math.PI*36} ${2*Math.PI*36}`} strokeLinecap="round"
              style={{transition:'stroke-dasharray .9s linear'}}/>
          </svg>
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontFamily:'monospace',fontWeight:900,fontSize:'1.6rem',color:c2,lineHeight:1}}>{left}</div>
            <div style={{fontSize:'.55rem',color:'rgba(255,255,255,0.3)',marginTop:2}}>ثانية</div>
          </div>
        </div>

        <button onClick={()=>{clearInterval(ref.current);onDone()}}
          style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.5)',borderRadius:10,padding:'8px 18px',fontFamily:F,cursor:'pointer',fontSize:'.8rem'}}>
          التالي →
        </button>
      </div>
    </div>
  )
}

// ── Rest Timer ─────────────────────────────────────────────────────
function RestTimer({seconds, onDone}) {
  const [left, setLeft] = useState(seconds)
  const ref = useRef(null)

  useEffect(()=>{
    ref.current = setInterval(()=>{
      setLeft(p=>{
        if(p<=1){clearInterval(ref.current);beep(660,0.25);setTimeout(()=>beep(880,0.4),350);onDone();return 0}
        if(p<=3)beep(440,0.08)
        return p-1
      })
    },1000)
    return ()=>clearInterval(ref.current)
  },[])

  const pct=((seconds-left)/seconds)*100

  return (
    <div style={{background:'rgba(255,255,255,0.02)',border:`1px solid ${G}25`,borderRadius:18,padding:'24px',textAlign:'center',marginBottom:14}}>
      <div style={{fontSize:'.65rem',fontWeight:700,color:'rgba(255,255,255,0.35)',letterSpacing:2,marginBottom:12,textTransform:'uppercase'}}>⏱️ راحة بين المجموعات</div>
      <div style={{position:'relative',width:100,height:100,margin:'0 auto 14px'}}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{transform:'rotate(-90deg)'}}>
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
          <circle cx="50" cy="50" r="44" fill="none" stroke={G} strokeWidth="8"
            strokeDasharray={`${pct/100*2*Math.PI*44} ${2*Math.PI*44}`} strokeLinecap="round"
            style={{transition:'stroke-dasharray .9s linear'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
          <div style={{fontFamily:'monospace',fontWeight:900,fontSize:'1.9rem',color:G,lineHeight:1}}>{left}</div>
          <div style={{fontSize:'.58rem',color:'rgba(255,255,255,0.3)',marginTop:2}}>ثانية</div>
        </div>
      </div>
      <div style={{fontSize:'.8rem',color:'rgba(255,255,255,0.45)',marginBottom:12}}>
        {left>10?'استرح — جسمك يتعافى':left>3?'استعد للمجموعة الجاية':'🔥 جاهز!'}
      </div>
      <button onClick={()=>{clearInterval(ref.current);onDone()}}
        style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.45)',borderRadius:10,padding:'7px 18px',fontFamily:F,cursor:'pointer',fontSize:'.78rem'}}>
        تخطى الراحة ←
      </button>
    </div>
  )
}

// ── Workout Tracker ────────────────────────────────────────────────
function WorkoutTracker({workout, sex, onComplete, profile, userId, programId, dayNumber}) {
  const PHRASES = sex==='female' ? PHRASES_F : PHRASES_M
  const phrase = PHRASES[Math.floor(Math.random()*PHRASES.length)]
  const exercises = workout.exercises || []
  const warmup = workout.warmup || []

  // Cooldown adapted to today's muscles
  const muscles = exercises.map(e=>e.muscle).filter(Boolean)
  const cooldown = buildCooldown(muscles)

  const [phase, setPhase] = useState('intro')
  const [wuIdx, setWuIdx] = useState(0)
  const [cdIdx, setCdIdx] = useState(0)
  const [exIdx, setExIdx] = useState(0)
  const [setIdx, setSetIdx] = useState(0)
  const [reps, setReps] = useState('')
  const [logs, setLogs] = useState(exercises.map(ex=>({name:ex.name,muscle:ex.muscle,targetReps:ex.reps,targetSets:ex.sets,sets:[]})))
  const [whyModal, setWhyModal] = useState(null)
  const [setStartTime, setSetStartTime] = useState(null)
  const [saving, setSaving] = useState(false)
  const [whyCat, setWhyCat] = useState(null)
  const [whyText, setWhyText] = useState('')
  const [registering, setRegistering] = useState(false)
  const [liveSessionId, setLiveSessionId] = useState(null)
  const [exerciseRowIds, setExerciseRowIds] = useState({})
  const [coachBanner, setCoachBanner] = useState(null)       // {msg, color, isMedical}
  const [healthSuggest, setHealthSuggest] = useState(null)   // {condition, userId}
  const inputRef = useRef(null)

  // Save a single set to DB immediately (fire and forget)
  const saveSetToDB = (exName, exMuscle, setNum, reps, durSec) => {
    if (!liveSessionId) return
    const exId = exerciseRowIds[exName]
    if (!exId) return
    fetch('/api/session-set', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ exerciseId: exId, setNumber: setNum, reps, duration_seconds: durSec || 0 })
    }).catch(() => {})
  }

    useEffect(()=>{ if(phase==='exercise'){ setTimeout(()=>inputRef.current?.focus(),200); setSetStartTime(Date.now()) } },[phase,exIdx,setIdx])

  if(!exercises.length) return null
  const ex = exercises[exIdx]
  if(!ex) return null
  const log = logs[exIdx] || {sets:[]}
  const isLastSet = setIdx >= (ex.sets||1)-1
  const isLastEx = exIdx >= exercises.length-1

  const logSet = () => {
    if (registering) return   // prevent double-tap
    setRegistering(true)
    const r = parseInt(reps)||0
    const durSec = setStartTime ? Math.round((Date.now()-setStartTime)/1000) : 0
    const newLogs = logs.map((l,i)=>i!==exIdx?l:{...l,sets:[...l.sets,{reps:r,target:ex.reps,setNum:setIdx+1,duration_seconds:durSec}]})
    setLogs(newLogs)
    setReps('')
    // ── Save set to DB immediately ──────────────────────────────
    saveSetToDB(ex.name, ex.muscle, setIdx+1, r, durSec)
    // Ask why for EVERY set that drops significantly
    const target = parseInt(ex.reps?.split('-')[0]||10)
    if(r < target*0.65) {
      setWhyModal({exerciseName:ex.name, setNum:setIdx+1})
    }
    setPhase('rest')
    setTimeout(() => setRegistering(false), 800)
  }

  const afterRest = () => {
    setRegistering(false)   // allow next set to be logged
    const curIsLastSet = setIdx >= (ex.sets||1)-1
    const curIsLastEx = exIdx >= exercises.length-1
    if(curIsLastSet){
      if(curIsLastEx) setPhase('done')
      else { setExIdx(e=>Math.min(e+1, exercises.length-1)); setSetIdx(0); setPhase('exercise') }
    } else {
      setSetIdx(s=>s+1); setPhase('exercise')
    }
  }

  const submitWhy = async () => {
    const wasSkip = whyModal?.isSkip
    const cat = whyCat
    const txt = whyText.trim()
    const exName = whyModal?.exerciseName
    setWhyModal(null); setWhyCat(null); setWhyText('')

    // Map UI category to API category
    const apiCategory = cat === 'pain' ? 'pain'
      : cat === 'time' ? 'time'
      : cat === 'heavy' || cat === 'fatigue' || cat === 'form' ? 'difficulty'
      : 'mental'

    // Navigate immediately — don't block the workout on API call
    if (wasSkip) {
      setRegistering(false)
      const nextIdx = exIdx + 1
      if (nextIdx >= exercises.length || !exercises[nextIdx]) setPhase('done')
      else { setExIdx(nextIdx); setSetIdx(0); setPhase('exercise') }
    }

    // Send analysis in background
    try {
      const r = await fetch('/api/packages/analyze-reason', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ userId, programId, dayNumber, category: apiCategory, reasonText: txt, exerciseName: exName })
      })
      const d = await r.json()
      if (!r.ok || !d.analysis) return

      const a = d.analysis

      // Show coach reply
      if (a.coach_reply) {
        const isMedical = a.medical_warning || a.severity === 'urgent'
        setCoachBanner({
          msg: a.coach_reply,
          color: isMedical ? '#ef4444' : a.type === 'pain' ? '#f97316' : '#22c55e',
          isMedical,
        })
        setTimeout(() => setCoachBanner(null), isMedical ? 0 : 8000)
      }

      // If AI suggests adding a health condition → ask user to confirm
      if (a.suggest_health_condition && userId) {
        setHealthSuggest({ condition: a.suggest_health_condition, userId })
      }
    } catch (e) {
      console.error('analyze-reason error:', e)
    }
  }

  // ── Coach reply banner ──────────────────────────────────────────
  const coachBannerUI = coachBanner && (
    <div style={{position:'fixed',top:64,right:0,left:0,zIndex:400,padding:'0 16px'}}>
      <div style={{maxWidth:480,margin:'0 auto',background:coachBanner.isMedical?'rgba(239,68,68,0.15)':'rgba(0,0,0,0.92)',border:`1px solid ${coachBanner.color}44`,borderRadius:16,padding:'14px 16px',boxShadow:'0 8px 32px rgba(0,0,0,0.5)',backdropFilter:'blur(12px)'}}>
        <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
          <span style={{fontSize:'1.1rem',flexShrink:0}}>{coachBanner.isMedical?'🚨':'🏋️'}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:'.7rem',fontWeight:700,color:coachBanner.color,letterSpacing:1,marginBottom:4,textTransform:'uppercase'}}>رد المدرب</div>
            <div style={{fontSize:'.85rem',color:'rgba(255,255,255,0.9)',lineHeight:1.6}}>{coachBanner.msg}</div>
          </div>
          {!coachBanner.isMedical && (
            <button onClick={()=>setCoachBanner(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:'1rem',flexShrink:0,padding:4}}>✕</button>
          )}
        </div>
      </div>
    </div>
  )

  // ── Health condition suggestion ─────────────────────────────────
  const CONDITION_LABELS = {
    knee_pain:'ألم الركبة', back_pain:'ألم الظهر', shoulder_pain:'ألم الكتف',
  }
  const healthSuggestUI = healthSuggest && (
    <div style={{position:'fixed',bottom:100,right:0,left:0,zIndex:400,padding:'0 16px'}}>
      <div style={{maxWidth:480,margin:'0 auto',background:'rgba(15,14,11,0.97)',border:`1px solid ${G}40`,borderRadius:18,padding:'16px',boxShadow:'0 8px 32px rgba(0,0,0,0.6)',backdropFilter:'blur(12px)'}}>
        <div style={{fontSize:'.75rem',fontWeight:700,color:G,marginBottom:6}}>💡 اقتراح المدرب</div>
        <div style={{fontSize:'.84rem',color:'rgba(255,255,255,0.85)',lineHeight:1.6,marginBottom:14}}>
          لاحظ المدرب أعراض <strong style={{color:G}}>{CONDITION_LABELS[healthSuggest.condition]||healthSuggest.condition}</strong>. هل نضيفها لملفك الصحي لتعديل التمارين القادمة؟
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={async()=>{
            try {
              await fetch('/api/profile', {
                method:'PATCH',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({userId:healthSuggest.userId, addHealthCondition: healthSuggest.condition})
              })
            } catch(e){ console.error(e) }
            setHealthSuggest(null)
          }} style={{flex:1,background:G,color:'#09090B',border:'none',borderRadius:11,padding:'11px',fontFamily:F,fontWeight:900,cursor:'pointer',fontSize:'.85rem'}}>
            نعم، أضف للملف ✓
          </button>
          <button onClick={()=>setHealthSuggest(null)}
            style={{flex:1,background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.5)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:11,padding:'11px',fontFamily:F,fontWeight:700,cursor:'pointer',fontSize:'.85rem'}}>
            لا، شكراً
          </button>
        </div>
      </div>
    </div>
  )

  const whyOverlay = whyModal && (
        <div style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>{ if(!whyModal.isSkip){ setWhyModal(null);setWhyCat(null);setWhyText('') } }}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0F0E0B',border:`1px solid ${G}30`,borderRadius:18,padding:'22px',maxWidth:380,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}}>
            <div style={{fontWeight:800,fontSize:'.95rem',marginBottom:6,color:G}}>
              {whyModal.isSkip ? '🤔 ليش تبي تتخطى هذا التمرين؟' : '🤔 الأداء كان أقل من الهدف — ليش؟'}
            </div>
            <div style={{fontSize:'.78rem',color:'rgba(255,255,255,0.4)',marginBottom:16,lineHeight:1.6}}>
              {whyModal.exerciseName?.split('|')[0].trim()} — جوابك يساعدنا نعدّل برنامج بكرة لك
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
              {[{id:'heavy',l:'ثقيل عليّ'},{id:'pain',l:'حسيت ألم'},{id:'fatigue',l:'تعبت بسرعة'},{id:'time',l:'ما عندي وقت'},{id:'form',l:'الحركة صعبة'},{id:'other',l:'سبب آخر'}].map(o=>(
                <button key={o.id} onClick={()=>setWhyCat(o.id)}
                  style={{padding:'11px 8px',background:whyCat===o.id?`${G}22`:'rgba(255,255,255,0.04)',border:`1px solid ${whyCat===o.id?G:'rgba(255,255,255,0.1)'}`,borderRadius:11,cursor:'pointer',fontFamily:F,fontWeight:600,fontSize:'.8rem',color:whyCat===o.id?G:'rgba(255,255,255,0.7)',transition:'all .15s'}}>
                  {o.l}
                </button>
              ))}
            </div>
            <input value={whyText} onChange={e=>setWhyText(e.target.value)} placeholder="تفاصيل إضافية (اختياري)..."
              style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:11,padding:'11px 14px',fontFamily:F,fontSize:'.85rem',color:'#ECE3CF',marginBottom:14,boxSizing:'border-box'}}/>
            <button onClick={submitWhy} disabled={!whyCat}
              style={{width:'100%',background:whyCat?G:'rgba(255,255,255,0.06)',color:whyCat?'#09090B':'rgba(255,255,255,0.3)',border:'none',borderRadius:12,padding:'14px',fontFamily:F,fontWeight:900,fontSize:'.92rem',cursor:whyCat?'pointer':'not-allowed'}}>
              {whyModal.isSkip ? 'تخطى التمرين ←' : 'إرسال ومتابعة ←'}
            </button>
          </div>
        </div>
      )

  // ── INTRO ──
  if(phase==='intro') return (
    <div>
      {/* Islamic phrase */}
      <div style={{background:'rgba(203,162,59,0.07)',border:`1px solid ${G}20`,borderRadius:20,padding:'28px 20px',marginBottom:16,textAlign:'center'}}>
        <div style={{fontFamily:"'Scheherazade New','Amiri',serif",fontSize:'clamp(1.3rem,4.5vw,1.8rem)',fontWeight:700,color:G,lineHeight:1.7,marginBottom:10,direction:'rtl',textShadow:'0 0 30px rgba(203,162,59,0.2)'}}>{phrase.ar}</div>
        <div style={{fontSize:'.82rem',color:'rgba(255,255,255,0.45)',fontFamily:F}}>{phrase.sub}</div>
      </div>

      {/* Stats strip */}
      {(()=>{
        const totalSec=warmup.reduce((a,w)=>a+(w.duration_seconds||30),0)
        const warmupMin=Math.round(totalSec/60)
        const totalMin=(workout.estimated_duration_min||30)+warmupMin
        const calories=Math.round(0.08*(profile?.weight_kg||75)*totalMin)
        const muscles=[...new Set(exercises.map(e=>e.muscle).filter(Boolean))]
        return(
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
            {[
              {icon:'⏱️', val:totalMin+'د',   lbl:'المدة الكلية'},
              {icon:'💪', val:exercises.length+'', lbl:'تمرين رئيسي'},
              {icon:'🔥', val:calories+'',    lbl:'سعرة متوقعة'},
              {icon:'🎯', val:muscles.length+'', lbl:'مجموعة عضلية'},
            ].map(({icon,val,lbl})=>(
              <div key={lbl} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${G}18`,borderRadius:13,padding:'10px 6px',textAlign:'center'}}>
                <div style={{fontSize:'.9rem',marginBottom:3}}>{icon}</div>
                <div style={{fontWeight:900,fontSize:'.95rem',color:G,fontFamily:'monospace',lineHeight:1}}>{val}</div>
                <div style={{fontSize:'.52rem',color:'rgba(255,255,255,0.3)',marginTop:3,lineHeight:1.3}}>{lbl}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Session overview - compact cards */}
      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
        {/* Warmup */}
        {warmup.length>0&&<div style={{background:'rgba(59,130,246,0.06)',border:'1px solid rgba(59,130,246,0.15)',borderRadius:14,padding:'12px 16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:'1.1rem'}}>🔥</span>
            <div>
              <div style={{fontWeight:700,fontSize:'.82rem',color:'#3b82f6',marginBottom:3}}>الإحماء — {warmup.length} تمارين</div>
              <div style={{fontSize:'.72rem',color:'rgba(255,255,255,0.4)'}}>{warmup.map(w=>(w.name||'').split('|')[0].trim()).join(' · ')}</div>
            </div>
            <div style={{marginRight:'auto',fontSize:'.7rem',color:'rgba(59,130,246,0.7)',fontFamily:'monospace'}}>{warmup.reduce((a,w)=>a+(w.duration_seconds||30),0)}ث</div>
          </div>
        </div>}

        {/* Muscle targets */}
        {(() => { const ms=[...new Set(exercises.map(e=>e.muscle).filter(Boolean))]; return ms.length>0?(<div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
          {ms.map(m=><div key={m} style={{background:`${G}15`,border:`1px solid ${G}30`,borderRadius:20,padding:'4px 12px',fontSize:'.7rem',color:G,fontWeight:700}}>{m}</div>)}
        </div>):null })()}

        {/* Main exercises */}
        <div style={{background:'rgba(203,162,59,0.06)',border:`1px solid ${G}18`,borderRadius:14,padding:'12px 16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <span style={{fontSize:'1.1rem'}}>💪</span>
            <div style={{fontWeight:700,fontSize:'.82rem',color:G}}>التمارين — {exercises.length} تمارين</div>
            <div style={{marginRight:'auto',fontSize:'.7rem',color:`${G}88`,fontFamily:'monospace'}}>{workout.estimated_duration_min}د</div>
          </div>
          {exercises.map((e,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderTop:i>0?'1px solid rgba(255,255,255,0.04)':'none'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'.83rem',color:'rgba(255,255,255,0.88)',fontWeight:700,marginBottom:2}}>{(e.name||'').split('|')[0].trim()}</div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  {e.muscle&&<span style={{fontSize:'.6rem',color:`${G}80`,fontWeight:600}}>{e.muscle}</span>}
                  {e.name?.includes('|')&&<span style={{fontSize:'.6rem',color:'rgba(255,255,255,0.22)'}}>{e.name.split('|')[1]?.trim()}</span>}
                </div>
              </div>
              <div style={{background:`${G}18`,border:`1px solid ${G}40`,borderRadius:9,padding:'5px 11px',textAlign:'center',flexShrink:0}}>
                <div style={{fontFamily:'monospace',fontWeight:900,fontSize:'.8rem',color:G,lineHeight:1}}>{e.sets}×{e.reps}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Cooldown */}
        <div style={{background:'rgba(34,197,94,0.05)',border:'1px solid rgba(34,197,94,0.12)',borderRadius:14,padding:'12px 16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:'1.1rem'}}>🧘</span>
            <div>
              <div style={{fontWeight:700,fontSize:'.82rem',color:'#22c55e',marginBottom:3}}>تبريد وتمديد — {cooldown.length} تمارين</div>
              <div style={{fontSize:'.72rem',color:'rgba(255,255,255,0.4)'}}>{cooldown.map(c=>(c.name||'').split('|')[0].trim()).join(' · ')}</div>
            </div>
          </div>
        </div>
      </div>

      <button onClick={async()=>{
        // Create session row immediately so data is never lost
        // ── Create session row immediately ──────────────────────────
        ;(async () => {
          try {
            const muscles = [...new Set(exercises.map(e => e.muscle).filter(Boolean))]
            const r = await fetch('/api/packages/start-session', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({
                userId, programId, dayNumber,
                muscles,
                durationMin: workout?.estimated_duration_min || 30,
              })
            })
            const d = await r.json()
            if (d.sessionId) {
              setLiveSessionId(d.sessionId)
              // Pre-create exercise rows for every exercise in this workout
              const exIds = {}
              for (const ex of exercises) {
                const er = await fetch('/api/session-exercise', {
                  method: 'POST',
                  headers: {'Content-Type':'application/json'},
                  body: JSON.stringify({ sessionId: d.sessionId, name: ex.name, muscle: ex.muscle || 'عام' })
                })
                const ed = await er.json()
                if (ed.id) exIds[ex.name] = ed.id
              }
              setExerciseRowIds(exIds)
            }
          } catch(e) { console.error('Session start error:', e) }
        })()
        setPhase(warmup.length>0?'warmup':'exercise')
      }}
        style={{width:'100%',background:`linear-gradient(135deg,${G},#8B6914)`,color:'#09090B',border:'none',borderRadius:14,padding:'16px',fontFamily:F,fontWeight:900,fontSize:'1rem',cursor:'pointer',boxShadow:`0 6px 24px rgba(203,162,59,0.35)`,letterSpacing:.5}}>
        بسم الله — هيا نبدأ 🔥
      </button>
    </div>
  )

  // ── WARMUP ──
  if(phase==='warmup') return (
    <div>
      <div style={{display:'flex',gap:5,justifyContent:'center',marginBottom:16}}>
        {warmup.map((_,i)=><div key={i} style={{width:i===wuIdx?20:6,height:4,borderRadius:2,background:i<wuIdx?'#22c55e':i===wuIdx?'#3b82f6':'rgba(255,255,255,0.1)',transition:'all .3s'}}/>)}
      </div>
      <TimedExercise key={'wu-'+wuIdx}
        exercise={warmup[wuIdx]} index={wuIdx} total={warmup.length}
        label="الإحماء" color="#3b82f6" sex={workout.sex}
        onDone={()=>{
          if(wuIdx<warmup.length-1){setWuIdx(i=>i+1)}
          else{setPhase('warmup_done')}
        }}
      />
    </div>
  )

  // ── WARMUP DONE ──
  if(phase==='warmup_done') return (
    <div style={{textAlign:'center',padding:'28px 0'}}>
      <div style={{fontSize:'2rem',marginBottom:12}}>✅</div>
      <div style={{fontWeight:900,fontSize:'1.1rem',color:'#22c55e',marginBottom:6}}>الإحماء انتهى!</div>
      <div style={{fontSize:'.85rem',color:'rgba(255,255,255,0.5)',marginBottom:24,lineHeight:1.7}}>جسمك جاهز — الدم يجري والعضلات دافئة.</div>
      <button onClick={()=>setPhase('exercise')}
        style={{width:'100%',background:`linear-gradient(135deg,${G},#8B6914)`,color:'#09090B',border:'none',borderRadius:14,padding:'15px',fontFamily:F,fontWeight:900,fontSize:'1rem',cursor:'pointer',boxShadow:`0 4px 20px rgba(203,162,59,0.3)`}}>
        ابدأ التمارين الرئيسية 💪
      </button>
    </div>
  )

  // ── REST ──
  if(phase==='rest') return (
    <div>
      {coachBannerUI}{healthSuggestUI}{whyOverlay}
      <div style={{textAlign:'center',marginBottom:12,fontSize:'.8rem',color:'rgba(255,255,255,0.4)'}}>
        {ex.name?.split('|')[1]?.trim()||ex.name||''} · مجموعة {setIdx+1} من {ex.sets} ✓
      </div>
      <RestTimer seconds={ex.rest||45} onDone={afterRest}/>
      {/* Why modal overlay during rest */}
      
    </div>
  )

  // ── COOLDOWN ──
  if(phase==='cooldown') return (
    <div>
      <div style={{display:'flex',gap:5,justifyContent:'center',marginBottom:16}}>
        {cooldown.map((_,i)=><div key={i} style={{width:i===cdIdx?20:6,height:4,borderRadius:2,background:i<cdIdx?'#22c55e':i===cdIdx?'#22c55e':'rgba(255,255,255,0.1)',transition:'all .3s'}}/>)}
      </div>
      <TimedExercise key={'cd-'+cdIdx}
        exercise={cooldown[cdIdx]} index={cdIdx} total={cooldown.length}
        label="تبريد وتمديد" color="#22c55e" sex={workout.sex}
        onDone={()=>{
          if(cdIdx<cooldown.length-1){setCdIdx(i=>i+1)}
          else{setPhase('cooldown_done')}
        }}
      />
    </div>
  )

  // ── DONE ──
  if(phase==='done') {
    const totalActual = logs.reduce((a,l)=>a+l.sets.reduce((b,s)=>b+(s.reps||0),0),0)
    const totalTarget = logs.reduce((a,l)=>a+(l.targetSets*parseInt(l.targetReps?.split('-')[0]||10)),0)
    const pct = totalTarget>0 ? Math.round((totalActual/totalTarget)*100) : 100
    return (
      <div>
        {(() => {
          const caloriesBurned = Math.round(0.08 * ((typeof profile!=='undefined'?profile?.weight_kg:null)||75) * (workout?.estimated_duration_min||30))
          return (
            <div style={{textAlign:'center',marginBottom:20}}>
              <div style={{fontSize:'2.5rem',marginBottom:8}}>🏆</div>
              <div style={{fontWeight:900,fontSize:'1.2rem',color:G,marginBottom:10}}>أكملت التمرين!</div>
              <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap',marginBottom:4}}>
                <div style={{display:'inline-flex',alignItems:'center',gap:6,background:`${pct>=80?'rgba(34,197,94,0.1)':pct>=60?'rgba(251,146,60,0.1)':'rgba(239,68,68,0.1)'}`,border:`1px solid ${pct>=80?'rgba(34,197,94,0.3)':pct>=60?'rgba(251,146,60,0.3)':'rgba(239,68,68,0.3)'}`,borderRadius:20,padding:'6px 14px',fontSize:'.85rem',color:pct>=80?'#22c55e':pct>=60?'#f97316':'#ef4444',fontWeight:700}}>
                  💪 {pct}% أداء
                </div>
                <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:20,padding:'6px 14px',fontSize:'.85rem',color:'#f87171',fontWeight:700}}>
                  🔥 {caloriesBurned} سعرة محروقة
                </div>
              </div>
            </div>
          )
        })()}

        {/* Performance breakdown */}
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:18,padding:'16px',marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:'.78rem',color:'rgba(255,255,255,0.45)',marginBottom:12,letterSpacing:1}}>أداء كل تمرين</div>
          {logs.map((l,i)=>{
            const t=parseInt(l.targetReps?.split('-')[0]||10)
            const actual=l.sets.reduce((a,s)=>a+(s.reps||0),0)
            const target=l.targetSets*t
            const p=target>0?Math.round((actual/target)*100):0
            const ok=p>=80
            return (
              <div key={i} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,fontSize:'.8rem'}}>
                  <span style={{color:'rgba(255,255,255,0.7)'}}>{(l.name||'').split('|')[0].trim()}</span>
                    {l.name?.includes('|')&&<span style={{fontSize:'.68rem',color:'rgba(255,255,255,0.3)',marginRight:4}}>{l.name.split('|')[1]?.trim()}</span>}
                  <span style={{color:ok?'#22c55e':'#f97316',fontWeight:700}}>{actual}/{target} تكرار ({p}%)</span>
                </div>
                <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:10,overflow:'hidden'}}>
                  <div style={{height:'100%',width:Math.min(100,p)+'%',background:ok?'#22c55e':'#f97316',borderRadius:10}}/>
                </div>
                <div style={{display:'flex',gap:5,marginTop:5,flexWrap:'wrap'}}>
                  {l.sets.map((s,j)=>(
                    <div key={j} style={{background:s.reps>=t?'rgba(34,197,94,0.12)':'rgba(251,146,60,0.12)',border:`1px solid ${s.reps>=t?'rgba(34,197,94,0.3)':'rgba(251,146,60,0.3)'}`,borderRadius:6,padding:'2px 8px',fontSize:'.68rem',color:s.reps>=t?'#22c55e':'#f97316'}}>
                      م{s.setNum}: {s.reps}
                    </div>
                  ))}
                  {l.sets.length===0&&<div style={{fontSize:'.7rem',color:'rgba(255,255,255,0.25)'}}>لم تسجّل</div>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Cooldown is mandatory before completing */}
        <div style={{background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:12,padding:'14px',marginTop:8}}>
          <div style={{fontWeight:700,fontSize:'.85rem',color:'#22c55e',marginBottom:6}}>🧘 التبريد والتمديد — خطوة إلزامية</div>
          <div style={{fontSize:'.78rem',color:'rgba(255,255,255,0.5)',lineHeight:1.6,marginBottom:12}}>
            مهم لصحتك — التمديد يحمي العضلات ويقلل ألم اليوم التالي.
          </div>
          <button onClick={()=>setPhase('cooldown')}
            style={{width:'100%',background:'#22c55e',color:'#09090B',border:'none',borderRadius:11,padding:'13px',fontFamily:F,fontWeight:900,cursor:'pointer',fontSize:'.92rem'}}>
            ابدأ التبريد والتمديد ({cooldown.length} تمارين) 🧘
          </button>
        </div>
      </div>
    )
  }

  // ── COOLDOWN DONE — final screen ──
  if(phase==='cooldown_done') {
    const totalActual = logs.reduce((a,l)=>a+l.sets.reduce((b,s)=>b+(s.reps||0),0),0)
    const totalTarget = logs.reduce((a,l)=>a+(l.targetSets*parseInt(l.targetReps?.split('-')[0]||10)),0)
    const finalPct = totalTarget>0 ? Math.round((totalActual/totalTarget)*100) : 100
    const caloriesBurned = Math.round(0.08*(profile?.weight_kg||75)*(workout?.estimated_duration_min||30))
    return (
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:'2.5rem',marginBottom:12}}>✅</div>
        <div style={{fontWeight:900,fontSize:'1.2rem',color:'#22c55e',marginBottom:16}}>أتممت الجلسة كاملة — أحسنت!</div>
        {/* Session summary */}
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'16px',marginBottom:16,textAlign:'right'}}>
          <div style={{fontWeight:700,fontSize:'.75rem',color:'rgba(255,255,255,0.4)',marginBottom:12,letterSpacing:1,textTransform:'uppercase',textAlign:'center'}}>ملخص جلستك</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {[[finalPct+'%','الأداء',finalPct>=80?'#22c55e':'#f97316'],[totalActual,'تكرار','#ECE3CF'],[caloriesBurned,'سعرة محروقة','#ef4444'],[logs.filter(l=>l.sets.length>0).length+'/'+logs.length,'تمارين مكتملة',G]].map(([v,l,col])=>(
              <div key={l} style={{background:'rgba(0,0,0,0.3)',borderRadius:10,padding:'10px',textAlign:'center'}}>
                <div style={{fontWeight:900,fontSize:'1rem',color:col,fontFamily:'monospace',lineHeight:1}}>{v}</div>
                <div style={{fontSize:'.62rem',color:'rgba(255,255,255,0.3)',marginTop:4}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Motivational message */}
        <div style={{background:'rgba(203,162,59,0.06)',border:'1px solid rgba(203,162,59,0.15)',borderRadius:13,padding:'12px 16px',marginBottom:20,fontSize:'.84rem',color:'rgba(255,255,255,0.6)',lineHeight:1.7}}>
          💧 اشرب ماء الآن واستهدف وجبة بروتين خلال ساعة من التمرين.
        </div>
        <button onClick={()=>onComplete(logs)}
          style={{width:'100%',background:`linear-gradient(135deg,${G},#8B6914)`,color:'#09090B',border:'none',borderRadius:14,padding:'16px',fontFamily:F,fontWeight:900,fontSize:'1rem',cursor:'pointer',boxShadow:`0 6px 24px rgba(203,162,59,0.3)`}}>
          سجّل وأنهِ الجلسة ✔️
        </button>
      </div>
    )
  }

  // ── EXERCISE ──
  return (
    <div>
      {coachBannerUI}{healthSuggestUI}{whyOverlay}
      {/* Progress bar */}
      <div style={{display:'flex',gap:4,marginBottom:14}}>
        {exercises.map((_,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:i<exIdx?'#22c55e':i===exIdx?G:'rgba(255,255,255,0.08)',transition:'all .3s'}}/>)}
      </div>
      <div style={{fontSize:'.72rem',color:'rgba(255,255,255,0.35)',textAlign:'center',marginBottom:14}}>تمرين {exIdx+1} من {exercises.length}</div>

      {/* Exercise card */}
      <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${G}22`,borderRadius:18,marginBottom:12,overflow:'hidden'}}>
        {/* Exercise image */}
        {ex.imageKey && (
          <div style={{width:'100%',height:220,background:'#0d0d0a',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',borderBottom:`1px solid ${G}18`}}>
            <img
              src={`/exercises/${ex.imageKey}-${workout.sex==='female'?'female':'male'}.png`}
              alt={ex.name}
              onError={e=>{e.target.parentNode.style.display='none'}}
              style={{height:'100%',width:'100%',objectFit:'contain',objectPosition:'center'}}/>
          </div>
        )}
        <div style={{padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
            <div>
              <div style={{fontWeight:900,fontSize:'1rem',marginBottom:1}}>{(ex.name||'').split('|')[0].trim()}</div>
              {ex.name?.includes('|')&&<div style={{fontSize:'.7rem',color:'rgba(255,255,255,0.3)',marginBottom:3}}>{ex.name.split('|')[1]?.trim()}</div>}
              <div style={{fontSize:'.72rem',color:G,fontWeight:600}}>{ex.muscle}</div>
            </div>
            <div style={{background:`${G}18`,borderRadius:10,padding:'6px 12px',textAlign:'center',flexShrink:0}}>
              <div style={{fontWeight:900,fontSize:'.95rem',color:G,fontFamily:'monospace'}}>{ex.sets}×{ex.reps}</div>
              <div style={{fontSize:'.58rem',color:'rgba(255,255,255,0.35)'}}>هدف</div>
            </div>
          </div>
          {/* Steps */}
          {ex.steps?.length>0&&(
            <div style={{background:'rgba(0,0,0,0.2)',borderRadius:10,padding:'10px 12px',marginBottom:10}}>
              {ex.steps.map((s,i)=>(
                <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:i<ex.steps.length-1?6:0,fontSize:'.76rem',color:'rgba(255,255,255,0.55)',lineHeight:1.5}}>
                  <span style={{color:G,fontWeight:900,fontSize:'.7rem',minWidth:16,marginTop:1}}>{i+1}.</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
          {ex.tip&&<div style={{background:'rgba(203,162,59,0.06)',border:'1px solid rgba(203,162,59,0.12)',borderRadius:9,padding:'7px 12px',fontSize:'.75rem',color:`${G}cc`,lineHeight:1.55,marginBottom:10}}>💡 {ex.tip}</div>}
          {/* Set dots */}
          <div style={{display:'flex',gap:5,marginBottom:3}}>
            {Array.from({length:ex.sets},(_,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:i<setIdx?'#22c55e':i===setIdx?G:'rgba(255,255,255,0.08)',transition:'background .25s'}}/>)}
          </div>
          <div style={{fontSize:'.68rem',color:'rgba(255,255,255,0.3)'}}>المجموعة {setIdx+1} من {ex.sets}</div>
        </div>
      </div>

      {/* Reps input */}
      <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'16px',marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:'.82rem',color:'rgba(255,255,255,0.5)',marginBottom:12,textAlign:'center'}}>كم تكرار عملت؟</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7,marginBottom:12}}>
          {[8,10,12,15,18,20,parseInt(ex.reps?.split('-')[0]||12),parseInt(ex.reps?.split('-')[1]||15)].filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>b-a).slice(0,8).map(n=>(
            <button key={n} onClick={()=>setReps(n.toString())}
              style={{padding:'10px 4px',background:reps===n.toString()?G:'rgba(255,255,255,0.04)',border:`1px solid ${reps===n.toString()?G:'rgba(255,255,255,0.09)'}`,borderRadius:9,cursor:'pointer',fontFamily:'monospace',fontWeight:800,fontSize:'.88rem',color:reps===n.toString()?'#09090B':'#ECE3CF',transition:'all .15s'}}>
              {n}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
          <input ref={inputRef} type="number" inputMode="numeric" value={reps} onChange={e=>setReps(e.target.value)}
            placeholder="عدد آخر..."
            style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#ECE3CF',padding:'10px 12px',borderRadius:11,fontFamily:F,fontSize:'.95rem',outline:'none',direction:'ltr',textAlign:'center',transition:'border .2s'}}
            onFocus={e=>e.target.style.borderColor=`${G}66`}
            onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}/>
          <span style={{fontSize:'.8rem',color:'rgba(255,255,255,0.4)',flexShrink:0}}>تكرار</span>
        </div>
        <button onClick={logSet} disabled={!reps||parseInt(reps)<=0}
          style={{width:'100%',background:reps&&parseInt(reps)>0&&!registering?G:'rgba(255,255,255,0.05)',color:reps&&parseInt(reps)>0&&!registering?'#09090B':'rgba(255,255,255,0.2)',border:'none',borderRadius:12,padding:'13px',fontFamily:F,fontWeight:900,fontSize:'.93rem',cursor:reps&&parseInt(reps)>0&&!registering?'pointer':'not-allowed',transition:'all .2s',boxShadow:reps&&parseInt(reps)>0&&!registering?`0 4px 16px rgba(203,162,59,0.25)`:'none'}}>
          ✓ سجّل المجموعة
        </button>
      </div>

      {log.sets.length>0&&(
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
          {log.sets.map((s,i)=>{const t=parseInt(ex.reps?.split('-')[0]||10);return(<div key={i} style={{background:s.reps>=t?'rgba(34,197,94,0.1)':'rgba(251,146,60,0.1)',border:`1px solid ${s.reps>=t?'rgba(34,197,94,0.3)':'rgba(251,146,60,0.3)'}`,borderRadius:7,padding:'3px 9px',fontSize:'.73rem',color:s.reps>=t?'#22c55e':'#f97316'}}>م{s.setNum}: {s.reps}</div>)})}
        </div>
      )}
      {/* Skip exercise → ask why first */}
      <div style={{textAlign:'center',marginTop:10}}>
        <button onClick={()=>{
          // Always ask why before skipping
          setWhyModal({exerciseName:ex.name, setNum:0, isSkip:true})
        }}
          style={{background:'none',border:'none',color:'rgba(255,255,255,0.22)',cursor:'pointer',fontFamily:F,fontSize:'.78rem',padding:'6px 12px'}}>
          تخطى هذا التمرين — حسيت ألم أو تعب ←
        </button>
      </div>
    </div>
  )
}

// ── Main Program Page ─────────────────────────────────────────────
export default function Program() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [program, setProgram] = useState(null)
  const [dayRecords, setDayRecords] = useState([])
  const [workout, setWorkout] = useState(null)

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [view, setView] = useState('overview')
  const [saving, setSaving] = useState(false)
  const { tab: tabQuery } = router.query
  const [tab, setTab] = useState('workout')
  const [checkinDone, setCheckinDone] = useState(false)
  const [mealPlan, setMealPlan] = useState(null)

  useEffect(()=>{
    supabase.auth.getSession().then(async({data:{session}})=>{
      if(!session?.user){router.push('/');return}
      setUser(session.user)
      const pr=await fetch('/api/profile?userId='+session.user.id).then(r=>r.json())
      setProfile(pr.profile)
    })
  },[])

  useEffect(()=>{ if(tabQuery&&tabQuery==='workout') setTab(tabQuery) },[tabQuery])
  useEffect(()=>{if(user)loadAll()},[user])

  useEffect(()=>{
    if(!user?.id) return
    fetch('/api/packages/meal-plan?userId='+user.id)
      .then(r=>r.json())
      .then(d=>{ if(d?.plan) setMealPlan(d) })
      .catch(()=>{})
  },[user?.id])

  useEffect(()=>{
    if(!user?.id) return
    const start=Date.now()
    return ()=>{ const dur=Math.round((Date.now()-start)/1000); if(dur>=5) fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:user.id,page:'program',duration_seconds:dur})}).catch(()=>{}) }
  },[user?.id])

  const loadAll=async()=>{
    setLoading(true)
    try{
      const [sr]=await Promise.all([
        fetch('/api/packages/status?userId='+user.id).then(r=>r.json()),
      ])
      if(sr.program){
        setProgram(sr.program)
        if(sr.todayDay?.checkin_status)setCheckinDone(true)
        const dr=await fetch('/api/packages/days?programId='+sr.program.id).then(r=>r.json()).catch(()=>({days:[]}))
        setDayRecords(dr.days||[])
        const cached=sr.todayDay?.daily_workout
        // Use cache only if it has current version (v:6 = beginner level filter + enrichExercise fallbacks). Otherwise regenerate.
        if(cached&&cached.v===6){
          setWorkout(cached)
        }else if(!sr.todayDay?.checkin_status){
          autoGenerate(sr.program,dr.days||[])
        }
      }

    }catch(e){}
    setLoading(false)
  }

  const autoGenerate=async(prog,days)=>{
    setGenerating(true)
    try{
      const yesterday=days.find(d=>d.day_number===(prog.current_day||1)-1)
      const r=await fetch('/api/packages/daily',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId:user.id,programId:prog.id,dayNumber:prog.current_day,energyLevel:'normal',yesterdayStatus:yesterday?.checkin_status||'completed',profile})
      })
      const d=await r.json()
      if(r.ok)setWorkout(d.workout)
    }catch(e){}
    setGenerating(false)
  }

  const handleWorkoutComplete=async(logs)=>{
    if(saving)return
    setSaving(true)
    setCheckinDone(true)
    await fetch('/api/packages/checkin',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({userId:user.id,programId:program.id,dayNumber:program.current_day,status:'completed',energyLevel:'normal',actual_logs:logs,warmup_data:workout?.warmup||[],cooldown_data:workout?.cooldown||[]})
    })
    setView('overview')
    await loadAll()
    router.push('/progress')
    setSaving(false)
  }

const B={minHeight:'100vh',background:'#09090B',color:'#ECE3CF',fontFamily:F,direction:'rtl'}

  if(loading)return(<div style={{...B,display:'flex',alignItems:'center',justifyContent:'center',gap:14,color:'rgba(255,255,255,0.35)'}}>
    <div style={{width:28,height:28,border:'3px solid rgba(203,162,59,0.15)',borderTopColor:G,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} .fu{animation:fu .3s ease}`}</style>
  </div>)

  if(!program)return(<div style={{...B,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:28,textAlign:'center'}}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <div style={{fontSize:'3rem',marginBottom:16}}>📋</div>
    <div style={{fontWeight:800,fontSize:'1.2rem',marginBottom:8}}>ما عندك برنامج نشط</div>
    <div style={{fontSize:'.88rem',color:'rgba(255,255,255,0.4)',marginBottom:24}}>ابدأ برنامجك وخلّنا نبني رحلتك</div>
    <button onClick={()=>router.push('/packages')} style={{background:G,color:'#09090B',border:'none',borderRadius:14,padding:'14px 32px',fontFamily:F,fontWeight:900,fontSize:'1rem',cursor:'pointer'}}>ابدأ برنامجي 🚀</button>
    <BottomTabs active="program"/>
  </div>)

  const days=program.roadmap?.days||[]
  const totalDays=program.total_days||21
  const currentDay=program.current_day||1
  const completedCount=dayRecords.filter(d=>['completed','partial'].includes(d.checkin_status)).length
  const pct=Math.round((completedCount/totalDays)*100)
  const todayTarget=days[currentDay-1]||{}
  const isRest=todayTarget.day_type==='راحة'
  const sex=profile?.sex||'male'

  // ── Workout detail view ──
  if(view==='workout_detail'&&workout)return(
    <div style={B}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} .fu{animation:fu .3s ease}`}</style>
      <div style={{background:'rgba(0,0,0,0.8)',backdropFilter:'blur(14px)',borderBottom:'1px solid rgba(203,162,59,0.1)',padding:'12px 18px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:50}}>
        <button onClick={()=>setView('overview')} style={{background:'none',border:'none',color:G,cursor:'pointer',fontFamily:F,fontWeight:700,fontSize:'.85rem'}}>← رجوع</button>
        <div style={{fontWeight:800,fontSize:'.9rem',flex:1}}>تمرين اليوم {currentDay}</div>
        <div style={{fontSize:'.72rem',color:'rgba(255,255,255,0.35)'}}>{workout.estimated_duration_min}د</div>
      </div>
      <div style={{maxWidth:480,margin:'0 auto',padding:'16px 16px 100px'}} className="fu">
        <WorkoutTracker workout={workout} sex={sex} onComplete={handleWorkoutComplete} profile={profile} userId={user?.id} programId={program?.id} dayNumber={program?.current_day}/>
      </div>
      <BottomTabs active="program"/>
    </div>
  )

  // ── Main overview ──
  const goals = profile ? calcNutrientGoals(profile) : null

  return(
    <div style={B}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fu{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fu .35s ease}
        .prog-card:active{transform:scale(.985)}
      `}</style>

      {/* ── Sticky top bar ── */}
      <div style={{background:'rgba(9,9,11,0.92)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(203,162,59,0.12)',padding:'12px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50}}>
        <div>
          <div style={{fontWeight:800,fontSize:'.88rem'}}>{program.roadmap?.program_name||program.package_name}</div>
          <div style={{fontSize:'.62rem',color:'rgba(255,255,255,0.3)'}}>اليوم {currentDay} من {totalDays}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {generating&&<div style={{width:12,height:12,border:'2px solid rgba(203,162,59,0.15)',borderTopColor:G,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>}
          <div style={{height:3,width:54,background:'rgba(255,255,255,0.07)',borderRadius:10,overflow:'hidden'}}>
            <div style={{height:'100%',width:pct+'%',background:`linear-gradient(90deg,${G},#e8c55a)`,borderRadius:10,transition:'width .6s'}}/>
          </div>
          <div style={{fontFamily:'monospace',fontWeight:900,fontSize:'.88rem',color:G}}>{pct}%</div>
        </div>
      </div>

      <div style={{maxWidth:480,margin:'0 auto',padding:'14px 14px 100px'}}>
        <div className="fu">

          {/* ══════════════════════════════════════════
              SECTION 1 — HERO: Today's Mission
          ══════════════════════════════════════════ */}
          <div style={{
            background:isRest
              ?'linear-gradient(135deg,rgba(59,130,246,0.12) 0%,rgba(59,130,246,0.02) 100%)'
              :'linear-gradient(135deg,rgba(203,162,59,0.16) 0%,rgba(203,162,59,0.04) 55%,transparent 100%)',
            border:`1px solid ${isRest?'rgba(59,130,246,0.28)':'rgba(203,162,59,0.32)'}`,
            borderRadius:22,padding:'20px 18px',marginBottom:10,position:'relative',overflow:'hidden',
          }}>
            {/* ambient glow */}
            <div style={{position:'absolute',top:-60,right:-20,width:200,height:200,background:isRest?'rgba(59,130,246,0.07)':'rgba(203,162,59,0.08)',borderRadius:'50%',filter:'blur(55px)',pointerEvents:'none'}}/>

            {/* Day header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
              <div style={{fontSize:'.58rem',fontWeight:700,color:isRest?'rgba(59,130,246,0.9)':G,letterSpacing:2.5,textTransform:'uppercase'}}>◆ اليوم {currentDay}</div>
              <div style={{background:isRest?'rgba(59,130,246,0.14)':'rgba(203,162,59,0.13)',border:`1px solid ${isRest?'rgba(59,130,246,0.28)':'rgba(203,162,59,0.25)'}`,borderRadius:20,padding:'3px 11px',fontSize:'.6rem',fontWeight:700,color:isRest?'#60a5fa':G}}>
                {todayTarget.day_type||'تمرين'}
              </div>
            </div>

            {/* Focus phrase */}
            <div style={{fontWeight:900,fontSize:'1.08rem',marginBottom:11,lineHeight:1.45}}>
              {todayTarget.daily_focus||(isRest?'يوم راحة — جسمك يبني نفسه':'ركّز على الأداء الصحيح')}
            </div>

            {/* Session metrics chips */}
            {!isRest&&(
              <div style={{display:'flex',gap:6,marginBottom:11,overflowX:'auto',scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
                {[[todayTarget.session_type||'لياقة','النوع'],[(todayTarget.intensity_target||5)+'/10','الشدة'],[(todayTarget.estimated_duration_min||30)+' د','المدة'],[(todayTarget.sets_target||10)+' مج','الحجم']].map(([v,l])=>(
                  <div key={l} style={{background:'rgba(0,0,0,0.32)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:10,padding:'7px 11px',textAlign:'center',flexShrink:0}}>
                    <div style={{fontFamily:'monospace',fontWeight:800,fontSize:'.8rem',color:G,lineHeight:1}}>{v}</div>
                    <div style={{fontSize:'.55rem',color:'rgba(255,255,255,0.28)',marginTop:3}}>{l}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Coach tip */}
            {todayTarget.coach_tip&&(
              <div style={{fontSize:'.74rem',color:'rgba(255,255,255,0.42)',background:'rgba(0,0,0,0.28)',borderRadius:10,padding:'8px 12px',marginBottom:12,lineHeight:1.65,fontStyle:'italic'}}>
                💬 {todayTarget.coach_tip}
              </div>
            )}

            {/* CTA */}
            {checkinDone?(
              <div style={{background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.22)',borderRadius:12,padding:'13px',textAlign:'center',color:'#22c55e',fontWeight:700,fontSize:'.88rem'}}>
                ✅ أكملت اليوم — ممتاز! تعال غداً 💪
              </div>
            ):isRest?(
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:'.82rem',color:'rgba(255,255,255,0.42)',marginBottom:12,lineHeight:1.7}}>يوم راحة — جسمك يبني نفسه الآن.<br/>نم جيداً واشرب ماء.</div>
                <button onClick={async()=>{await fetch('/api/packages/checkin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:user.id,programId:program.id,dayNumber:currentDay,status:'rest',energyLevel:'normal'})});setCheckinDone(true);await loadAll()}}
                  style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.25)',color:'#60a5fa',borderRadius:11,padding:'11px 26px',fontFamily:F,fontWeight:700,cursor:'pointer',fontSize:'.85rem'}}>
                  ✓ سجّل يوم الراحة
                </button>
              </div>
            ):generating?(
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'rgba(203,162,59,0.05)',border:'1px solid rgba(203,162,59,0.12)',borderRadius:11}}>
                <div style={{width:15,height:15,border:'2px solid rgba(203,162,59,0.2)',borderTopColor:G,borderRadius:'50%',animation:'spin .8s linear infinite',flexShrink:0}}/>
                <div style={{fontSize:'.82rem',color:'rgba(255,255,255,0.5)'}}>المدرب يحضّر تمريني اليوم...</div>
              </div>
            ):(
              <button onClick={()=>setView('workout_detail')} disabled={!workout}
                style={{width:'100%',background:workout?`linear-gradient(135deg,${G} 0%,#9a7220 100%)`:'rgba(255,255,255,0.05)',color:workout?'#09090B':'rgba(255,255,255,0.22)',border:workout?'none':'1px solid rgba(255,255,255,0.07)',borderRadius:13,padding:'15px',fontFamily:F,fontWeight:900,fontSize:'1rem',cursor:workout?'pointer':'not-allowed',boxShadow:workout?`0 6px 28px rgba(203,162,59,0.38)`:'none',transition:'all .2s'}}>
                {workout?'🏋️  ابدأ تمريني اليوم':'⏳ جاري تحضير التمرين...'}
              </button>
            )}
          </div>

          {/* ══════════════════════════════════════════
              SECTION 2 — WORKOUT + NUTRITION (2-col)
          ══════════════════════════════════════════ */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>

            {/* Workout card */}
            <div
              onClick={()=>workout&&!isRest&&!checkinDone&&setView('workout_detail')}
              style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:18,padding:'15px 13px',cursor:workout&&!isRest&&!checkinDone?'pointer':'default',display:'flex',flexDirection:'column',minHeight:215,WebkitTapHighlightColor:'transparent',position:'relative',overflow:'hidden'}}
              onTouchStart={e=>{if(workout&&!isRest&&!checkinDone)e.currentTarget.style.transform='scale(.97)'}}
              onTouchEnd={e=>e.currentTarget.style.transform='scale(1)'}>
              <div style={{position:'absolute',bottom:-18,left:-18,width:70,height:70,background:'rgba(203,162,59,0.05)',borderRadius:'50%'}}/>
              <div style={{fontSize:'.56rem',fontWeight:700,color:'rgba(203,162,59,0.6)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:9}}>تمارين اليوم</div>
              {isRest?(
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:5}}>
                  <div style={{fontSize:'1.8rem'}}>🛌</div>
                  <div style={{fontSize:'.68rem',color:'rgba(255,255,255,0.28)',textAlign:'center'}}>يوم راحة</div>
                </div>
              ):checkinDone?(
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:5}}>
                  <div style={{fontSize:'1.8rem'}}>✅</div>
                  <div style={{fontFamily:'monospace',fontWeight:900,fontSize:'1.2rem',color:'#22c55e'}}>{workout?.exercises?.length||'—'}</div>
                  <div style={{fontSize:'.65rem',color:'rgba(255,255,255,0.35)'}}>تمرين أكملته</div>
                </div>
              ):workout?.exercises?(
                <>
                  <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:2}}>
                    <div style={{fontFamily:'monospace',fontWeight:900,fontSize:'1.55rem',color:G,lineHeight:1}}>{workout.exercises.length}</div>
                    <div style={{fontSize:'.6rem',color:'rgba(255,255,255,0.3)'}}>تمرين</div>
                  </div>
                  <div style={{fontSize:'.58rem',color:'rgba(255,255,255,0.28)',marginBottom:9}}>{workout.estimated_duration_min||35} دقيقة</div>
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:5}}>
                    {workout.exercises.slice(0,4).map((ex,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingBottom:i<Math.min(3,workout.exercises.length-1)?5:0,borderBottom:i<Math.min(3,workout.exercises.length-1)?'1px solid rgba(255,255,255,0.04)':'none'}}>
                        <div style={{fontSize:'.66rem',color:'rgba(255,255,255,0.58)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,paddingLeft:4}}>{ex.name}</div>
                        <div style={{fontFamily:'monospace',fontSize:'.6rem',color:G,fontWeight:700,flexShrink:0}}>{ex.sets}×{ex.reps}</div>
                      </div>
                    ))}
                    {workout.exercises.length>4&&<div style={{fontSize:'.55rem',color:'rgba(255,255,255,0.2)',marginTop:2}}>+{workout.exercises.length-4} أخرى</div>}
                  </div>
                  <div style={{marginTop:9,fontSize:'.66rem',color:G,fontWeight:700}}>ابدأ ←</div>
                </>
              ):(
                <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.7rem',color:'rgba(255,255,255,0.22)'}}>جاري التحضير...</div>
              )}
            </div>

            {/* Nutrition / Meal plan card */}
            <div
              onClick={()=>router.push('/meals')}
              style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:18,padding:'15px 13px',cursor:'pointer',display:'flex',flexDirection:'column',minHeight:215,WebkitTapHighlightColor:'transparent',position:'relative',overflow:'hidden'}}
              onTouchStart={e=>e.currentTarget.style.transform='scale(.97)'}
              onTouchEnd={e=>e.currentTarget.style.transform='scale(1)'}>
              <div style={{position:'absolute',bottom:-18,left:-18,width:70,height:70,background:'rgba(34,197,94,0.04)',borderRadius:'50%'}}/>
              <div style={{fontSize:'.56rem',fontWeight:700,color:'rgba(34,197,94,0.65)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:9}}>خطة التغذية</div>
              {mealPlan?.plan?(
                <>
                  <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:2}}>
                    <div style={{fontFamily:'monospace',fontWeight:900,fontSize:'1.55rem',color:'#22c55e',lineHeight:1}}>{mealPlan.total_calories}</div>
                    <div style={{fontSize:'.6rem',color:'rgba(255,255,255,0.3)'}}>سعرة</div>
                  </div>
                  <div style={{fontSize:'.58rem',color:'rgba(255,255,255,0.28)',marginBottom:9}}>{mealPlan.total_protein}g بروتين</div>
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:5}}>
                    {mealPlan.plan.map((m,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingBottom:i<mealPlan.plan.length-1?5:0,borderBottom:i<mealPlan.plan.length-1?'1px solid rgba(255,255,255,0.04)':'none'}}>
                        <div style={{fontSize:'.64rem',color:'rgba(255,255,255,0.55)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,paddingLeft:3}}>{m.food?.name_ar||m.meal_time}</div>
                        <div style={{fontFamily:'monospace',fontSize:'.58rem',color:'#22c55e',fontWeight:700,flexShrink:0}}>{m.actual_calories}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:9,fontSize:'.66rem',color:'#22c55e',fontWeight:700}}>التغذية ←</div>
                </>
              ):goals?(
                <>
                  <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:2}}>
                    <div style={{fontFamily:'monospace',fontWeight:900,fontSize:'1.55rem',color:'#22c55e',lineHeight:1}}>{goals.calories}</div>
                    <div style={{fontSize:'.6rem',color:'rgba(255,255,255,0.3)'}}>سعرة</div>
                  </div>
                  <div style={{fontSize:'.58rem',color:'rgba(255,255,255,0.28)',marginBottom:9}}>هدفك اليومي</div>
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:7}}>
                    {[['بروتين','#3b82f6',goals.protein_g],['كارب','#f97316',goals.carbs_g],['دهن','#a855f7',goals.fat_g]].map(([l,c,v])=>(
                      <div key={l}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                          <div style={{fontSize:'.6rem',color:c,fontWeight:700}}>{l}</div>
                          <div style={{fontFamily:'monospace',fontSize:'.56rem',color:'rgba(255,255,255,0.38)'}}>{v}g</div>
                        </div>
                        <div style={{height:3,background:'rgba(255,255,255,0.06)',borderRadius:2}}>
                          <div style={{height:'100%',width:'62%',background:c,borderRadius:2,opacity:.8}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:9,fontSize:'.66rem',color:'#22c55e',fontWeight:700}}>التغذية ←</div>
                </>
              ):(
                <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.7rem',color:'rgba(255,255,255,0.22)'}}>جاري التحميل...</div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════
              SECTION 3 — PROGRESS
          ══════════════════════════════════════════ */}
          {(()=>{
            const R=32, C=2*Math.PI*R
            return(
              <div
                onClick={()=>router.push('/progress')}
                className="prog-card"
                style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:20,padding:'17px 17px',marginBottom:10,cursor:'pointer',WebkitTapHighlightColor:'transparent',transition:'transform .15s'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:13}}>
                  <div style={{fontSize:'.58rem',fontWeight:700,color:'rgba(203,162,59,0.6)',letterSpacing:1.5,textTransform:'uppercase'}}>تقدمي في البرنامج</div>
                  <div style={{fontSize:'.62rem',color:'rgba(255,255,255,0.28)'}}>التفاصيل ←</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:13}}>
                  {/* Progress ring */}
                  <svg width={76} height={76} style={{flexShrink:0}}>
                    <circle cx={38} cy={38} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={5}/>
                    <circle cx={38} cy={38} r={R} fill="none" stroke={G} strokeWidth={5}
                      strokeDasharray={`${(pct/100)*C} ${C}`} strokeLinecap="round"
                      transform="rotate(-90 38 38)"
                      style={{filter:`drop-shadow(0 0 8px rgba(203,162,59,0.55))`,transition:'stroke-dasharray 1.2s ease'}}/>
                    <text x={38} y={43} textAnchor="middle" fill={G} fontSize={13} fontWeight="900" fontFamily="monospace">{pct}%</text>
                  </svg>
                  {/* Stats */}
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:9}}>
                    <div style={{display:'flex',gap:0}}>
                      {[[completedCount,'مكتمل','#22c55e'],[totalDays-completedCount,'متبقي','rgba(255,255,255,0.35)']].map(([v,l,c],i)=>(
                        <div key={l} style={{flex:1,paddingRight:i===0?12:0,paddingLeft:i===1?12:0,borderLeft:i===1?'1px solid rgba(255,255,255,0.06)':undefined,textAlign:i===0?'right':'left'}}>
                          <div style={{fontFamily:'monospace',fontWeight:900,fontSize:'1.35rem',color:c,lineHeight:1}}>{v}</div>
                          <div style={{fontSize:'.58rem',color:'rgba(255,255,255,0.28)',marginTop:3}}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:10,overflow:'hidden'}}>
                      <div style={{height:'100%',width:pct+'%',background:`linear-gradient(90deg,${G},#e8c55a)`,borderRadius:10,transition:'width .7s ease'}}/>
                    </div>
                  </div>
                </div>
                {/* Day dots */}
                <div style={{display:'flex',gap:2.5}}>
                  {Array.from({length:Math.min(totalDays,30)},(_,i)=>{
                    const dayNum=i+1, rec=dayRecords.find(d=>d.day_number===dayNum), s=rec?.checkin_status, isCur=dayNum===currentDay
                    return <div key={i} style={{flex:1,height:5,borderRadius:3,background:s==='completed'?'#22c55e':s==='partial'?'#f97316':s==='missed'?'rgba(239,68,68,0.4)':isCur?G:'rgba(255,255,255,0.06)',transition:'background .3s',boxShadow:isCur?`0 0 8px ${G}bb`:s==='completed'?'0 0 4px rgba(34,197,94,0.5)':'none'}}/>
                  })}
                </div>
              </div>
            )
          })()}

          {/* ══════════════════════════════════════════
              SECTION 4 — WEEK GOAL
          ══════════════════════════════════════════ */}
          {program.roadmap?.weekly_overview?.length>0&&(()=>{
            const w=program.roadmap.weekly_overview[Math.min(Math.ceil(currentDay/7)-1,program.roadmap.weekly_overview.length-1)]
            return w?(
              <div style={{background:'rgba(255,255,255,0.015)',border:'1px solid rgba(255,255,255,0.055)',borderRadius:15,padding:'13px 16px'}}>
                <div style={{fontSize:'.56rem',fontWeight:700,color:'rgba(255,255,255,0.22)',letterSpacing:2,textTransform:'uppercase',marginBottom:6}}>هدف هذا الأسبوع</div>
                <div style={{fontWeight:800,fontSize:'.88rem',color:G,marginBottom:4}}>{w.theme}</div>
                <div style={{fontSize:'.74rem',color:'rgba(255,255,255,0.38)',lineHeight:1.65}}>{w.key_objective}</div>
              </div>
            ):null
          })()}

        </div>
      </div>
      <BottomTabs active="program"/>
    </div>
  )
}
