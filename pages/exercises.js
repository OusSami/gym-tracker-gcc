import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { BottomTabs } from '../components/Nav'
import { EXERCISE_DB, STRETCHING, WARMUP } from '../lib/exercise-data'

const CATS = ['الكل','Chest','Back','Shoulders','Arms','Legs','Core','Cardio']
const CAT_AR = {'الكل':'الكل','Chest':'الصدر','Back':'الظهر','Shoulders':'الأكتاف','Arms':'الأذرع','Legs':'الأرجل','Core':'البطن','Cardio':'الكارديو'}
const SUB_AR = {
  'Mid Chest':'الصدر الأوسط','Upper Chest':'الصدر العلوي',
  'Lower Chest':'الصدر السفلي','Inner Chest':'الصدر الداخلي',
  'Lats':'العريضة','Upper Traps':'شبه المنحرف العلوي',
  'Middle Traps':'شبه المنحرف الأوسط','Erector Spinae':'باسطة العمود الفقري',
  'Front Delts':'الدالية الأمامية','Side Delts':'الدالية الجانبية',
  'Rear Delts':'الدالية الخلفية',
  'Biceps':'الثنائي','Triceps':'الثلاثي',
  'Brachialis':'العضدي','Forearms':'الساعد',
  'Quads':'الفخذ الأمامي','Hamstrings':'أوتار الركبة',
  'Glutes':'الأرداف','Calves':'الساق',
  'Abs':'عضلات البطن','Obliques':'المائلة',
  'Transverse Abdominis':'المستعرض البطني',
  'HIIT':'تمرين متقطع','Steady State':'كارديو ثابت',
}
const MC = { Chest:'#ef4444',Back:'#3b82f6',Shoulders:'#a855f7',Arms:'#f97316',Legs:'#22c55e',Core:'#eab308',Cardio:'#06b6d4' }
const mc = c => MC[c]||'#6b7280'

function ExSVG({ type, color: c, finished=false }) {
  const a = finished ? 0.6 : 1
  if (type==='barbell') return (
    <svg width="120" height="80" viewBox="0 0 120 80">
      <circle cx={60} cy={16} r={9} fill={c} opacity={.9*a}/>
      <rect x={50} y={25} width={10} height={22} rx={4} fill={c} opacity={.8*a}/>
      <line x1={51} y1={31} x2={finished?28:30} y2={finished?10:20} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={59} y1={31} x2={finished?92:90} y2={finished?10:20} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <rect x={16} y={finished?6:14} width={88} height={7} rx={3.5} fill={c} opacity={.7*a}/>
      <rect x={8} y={finished?2:10} width={10} height={15} rx={3} fill={c} opacity={a}/>
      <rect x={102} y={finished?2:10} width={10} height={15} rx={3} fill={c} opacity={a}/>
      <line x1={52} y1={47} x2={46} y2={68} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={58} y1={47} x2={64} y2={68} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <ellipse cx={38} cy={finished?14:26} rx={6} ry={8} fill={c} opacity={.3*a}/>
      <ellipse cx={82} cy={finished?14:26} rx={6} ry={8} fill={c} opacity={.3*a}/>
    </svg>
  )
  if (type==='dumbbell') return (
    <svg width="120" height="80" viewBox="0 0 120 80">
      <circle cx={60} cy={14} r={9} fill={c} opacity={.9}/>
      <rect x={55} y={23} width={10} height={24} rx={4} fill={c} opacity={.8}/>
      <line x1={55} y1={29} x2={finished?35:30} y2={finished?18:36} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <rect x={finished?18:10} y={finished?14:32} width={18} height={6} rx={3} fill={c} opacity={.7}/>
      <rect x={finished?14:6} y={finished?11:29} width={6} height={12} rx={2} fill={c}/>
      <rect x={finished?34:26} y={finished?11:29} width={6} height={12} rx={2} fill={c}/>
      <line x1={65} y1={29} x2={finished?85:90} y2={finished?18:36} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <rect x={finished?85:98} y={finished?14:32} width={18} height={6} rx={3} fill={c} opacity={.7}/>
      <rect x={finished?81:94} y={finished?11:29} width={6} height={12} rx={2} fill={c}/>
      <rect x={finished?101:114} y={finished?11:29} width={6} height={12} rx={2} fill={c}/>
      <ellipse cx={finished?38:28} cy={finished?24:34} rx={5} ry={8} fill={c} opacity={.3}/>
      <ellipse cx={finished?82:92} cy={finished?24:34} rx={5} ry={8} fill={c} opacity={.3}/>
      <line x1={57} y1={47} x2={50} y2={70} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={63} y1={47} x2={70} y2={70} stroke={c} strokeWidth={4} strokeLinecap="round"/>
    </svg>
  )
  if (type==='cables') return (
    <svg width="120" height="85" viewBox="0 0 120 85">
      <rect x={2} y={5} width={8} height={75} rx={3} fill={c} opacity={.3}/>
      <rect x={110} y={5} width={8} height={75} rx={3} fill={c} opacity={.3}/>
      <rect x={2} y={5} width={116} height={8} rx={3} fill={c} opacity={.4}/>
      <circle cx={6} cy={9} r={5} fill="none" stroke={c} strokeWidth={2}/>
      <circle cx={114} cy={9} r={5} fill="none" stroke={c} strokeWidth={2}/>
      <circle cx={60} cy={26} r={9} fill={c} opacity={.9}/>
      <rect x={55} y={35} width={10} height={22} rx={4} fill={c} opacity={.8}/>
      <line x1={55} y1={41} x2={finished?35:38} y2={finished?50:48} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={65} y1={41} x2={finished?85:82} y2={finished?50:48} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={6} y1={14} x2={finished?35:38} y2={finished?50:48} stroke={c} strokeWidth={2} strokeDasharray="3 2" opacity={.6}/>
      <line x1={114} y1={14} x2={finished?85:82} y2={finished?50:48} stroke={c} strokeWidth={2} strokeDasharray="3 2" opacity={.6}/>
      <line x1={52} y1={57} x2={46} y2={78} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={58} y1={57} x2={64} y2={78} stroke={c} strokeWidth={4} strokeLinecap="round"/>
    </svg>
  )
  if (type==='pullup') return (
    <svg width="120" height="90" viewBox="0 0 120 90">
      <rect x={8} y={6} width={104} height={9} rx={4} fill={c} opacity={.8}/>
      <rect x={12} y={1} width={7} height={14} rx={2} fill={c} opacity={.5}/>
      <rect x={101} y={1} width={7} height={14} rx={2} fill={c} opacity={.5}/>
      <circle cx={60} cy={finished?28:38} r={9} fill={c} opacity={.9}/>
      <rect x={55} y={finished?37:47} width={10} height={20} rx={4} fill={c} opacity={.8}/>
      <line x1={55} y1={finished?32:35} x2={42} y2={15} stroke={c} strokeWidth={5} strokeLinecap="round"/>
      <line x1={65} y1={finished?32:35} x2={78} y2={15} stroke={c} strokeWidth={5} strokeLinecap="round"/>
      <line x1={53} y1={finished?57:67} x2={45} y2={finished?75:82} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={57} y1={finished?57:67} x2={65} y2={finished?75:82} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <ellipse cx={60} cy={finished?48:58} rx={8} ry={10} fill={c} opacity={.2}/>
    </svg>
  )
  if (type==='machine') return (
    <svg width="120" height="85" viewBox="0 0 120 85">
      <rect x={5} y={55} width={60} height={25} rx={4} fill={c} opacity={.15}/>
      <rect x={5} y={50} width={60} height={8} rx={3} fill={c} opacity={.3}/>
      <rect x={60} y={20} width={8} height={38} rx={3} fill={c} opacity={.4}/>
      <rect x={80} y={10} width={28} height={65} rx={4} fill={c} opacity={.08}/>
      {[0,1,2,3,4,5].map(i=><rect key={i} x={83} y={12+i*10} width={22} height={7} rx={2} fill={c} opacity={i<2?.7:.2}/>)}
      <circle cx={32} cy={36} r={9} fill={c} opacity={.9}/>
      <rect x={27} y={45} width={10} height={14} rx={4} fill={c} opacity={.8}/>
      <line x1={32} y1={59} x2={finished?12:18} y2={finished?59:73} stroke={c} strokeWidth={5} strokeLinecap="round"/>
      <line x1={37} y1={59} x2={finished?60:52} y2={finished?59:73} stroke={c} strokeWidth={5} strokeLinecap="round"/>
    </svg>
  )
  if (type==='dip') return (
    <svg width="120" height="85" viewBox="0 0 120 85">
      <rect x={20} y={22} width={80} height={7} rx={3} fill={c} opacity={.6}/>
      <rect x={20} y={22} width={8} height={55} rx={3} fill={c} opacity={.35}/>
      <rect x={92} y={22} width={8} height={55} rx={3} fill={c} opacity={.35}/>
      <circle cx={60} cy={finished?15:18} r={9} fill={c} opacity={.9}/>
      <rect x={55} y={finished?24:27} width={10} height={20} rx={4} fill={c} opacity={.8}/>
      <line x1={55} y1={finished?30:33} x2={28} y2={29} stroke={c} strokeWidth={5} strokeLinecap="round"/>
      <line x1={65} y1={finished?30:33} x2={92} y2={29} stroke={c} strokeWidth={5} strokeLinecap="round"/>
      <line x1={57} y1={finished?44:47} x2={49} y2={finished?60:65} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={63} y1={finished?44:47} x2={71} y2={finished?60:65} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <ellipse cx={28} cy={32} rx={5} ry={7} fill={c} opacity={.3}/>
      <ellipse cx={92} cy={32} rx={5} ry={7} fill={c} opacity={.3}/>
    </svg>
  )
  return (
    <svg width="120" height="85" viewBox="0 0 120 85">
      <line x1={10} y1={78} x2={110} y2={78} stroke={c} strokeWidth={2} opacity={.2}/>
      <circle cx={finished?70:72} cy={16} r={9} fill={c} opacity={.9}/>
      <line x1={finished?70:72} y1={25} x2={56} y2={46} stroke={c} strokeWidth={5} strokeLinecap="round"/>
      <line x1={finished?66:68} y1={33} x2={finished?86:88} y2={22} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={58} y1={35} x2={finished?38:36} y2={44} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={56} y1={46} x2={finished?40:38} y2={64} stroke={c} strokeWidth={5} strokeLinecap="round"/>
      <line x1={finished?40:38} y1={64} x2={finished?28:26} y2={78} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={58} y1={48} x2={finished?72:74} y2={62} stroke={c} strokeWidth={5} strokeLinecap="round"/>
      <line x1={finished?72:74} y1={62} x2={finished?86:90} y2={53} stroke={c} strokeWidth={4} strokeLinecap="round"/>
    </svg>
  )
}

function GifPlayer({ src, color, name }) {
  const [loaded, setLoaded] = React.useState(false)
  const [err, setErr] = React.useState(false)
  return (
    <div style={{position:'relative',background:'var(--surface-inset)',minHeight:220}}>
      {!loaded && !err && (
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10}}>
          <div style={{width:36,height:36,border:'3px solid var(--accent-soft)',borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
          <div style={{color:'var(--text-secondary)',fontSize:'.72rem',fontWeight:600}}>Loading GIF...</div>
        </div>
      )}
      {!err ? (
        <img
          key={src}
          src={src}
          alt={name}
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
          style={{width:'100%',maxHeight:280,objectFit:'contain',display:loaded?'block':'none',background:'transparent'}}
        />
      ) : (
        <div style={{height:160,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8,padding:16}}>
          <div style={{fontSize:'2rem'}}>🏋️</div>
          <div style={{color:'var(--text-secondary)',fontSize:'.75rem',textAlign:'center'}}>معاينة غير متاحة</div>
        </div>
      )}
      {loaded && !err && (
        <div style={{position:'absolute',bottom:8,insetInlineEnd:8}}>
          <span style={{background:'rgba(0,0,0,.55)',borderRadius:20,padding:'3px 10px',fontSize:'.65rem',color:'var(--accent)',fontWeight:700,backdropFilter:'blur(4px)'}}>GIF</span>
        </div>
      )}
    </div>
  )
}

function ExerciseCard({ ex, onSelect, sex = 'male' }) {
  return (
    <div
      onClick={() => onSelect(ex)}
      onTouchStart={e => e.currentTarget.style.transform='scale(.96)'}
      onTouchEnd={e => e.currentTarget.style.transform='scale(1)'}
      style={{borderRadius:16,overflow:'hidden',backgroundColor:'var(--card)',boxShadow:'var(--shadow-card)',cursor:'pointer',transition:'transform .15s'}}
    >
      <div style={{position:'relative',height:140,backgroundColor:'var(--accent-faint)'}}>
        <img
          src={`/exercises/${ex.id}-${sex}.webp`}
          alt={ex.name}
          style={{width:'100%',height:'100%',objectFit:'cover'}}
          onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}
        />
        <div style={{display:'none',width:'100%',height:'100%',alignItems:'center',justifyContent:'center',backgroundColor:'var(--accent-faint)'}}>
          <ExSVG type={ex.shape} color="var(--accent)"/>
        </div>
        <div style={{
          position:'absolute',top:8,insetInlineEnd:8,
          paddingInline:8,paddingBlock:4,borderRadius:10,fontSize:10,fontWeight:700,
          backgroundColor: ex.level?.includes('مبتدئ') ? '#E8F5E9' : ex.level?.includes('متوسط') ? '#FFF8E1' : '#FBE9E7',
          color: ex.level?.includes('مبتدئ') ? '#2E7D32' : ex.level?.includes('متوسط') ? '#F57F17' : '#B71C1C'
        }}>{ex.level}</div>
      </div>
      <div style={{padding:12,textAlign:'right'}}>
        <p style={{
          fontSize:13,fontWeight:700,color:'var(--text-primary)',
          margin:'0 0 4px',
          display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',
          overflow:'hidden',lineHeight:1.4
        }}>
          {ex.name?.split('|')[1]?.trim() || ex.name}
        </p>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBlockStart:6}}>
          <span style={{fontSize:10,color:'var(--accent)',backgroundColor:'var(--accent-faint)',paddingInline:8,paddingBlock:3,borderRadius:8,fontWeight:600}}>
            {ex.primary}
          </span>
          <span style={{fontSize:10,color:'var(--text-secondary)'}}>{ex.equipment}</span>
        </div>
      </div>
    </div>
  )
}

function ExerciseDetail({ ex, onClose, sex = 'male' }) {
  const [showStretch, setShowStretch] = useState(false)
  const stretches = STRETCHING[ex.category] || []
  const isFemale = sex === 'female'
  const steps = isFemale ? (ex.female?.steps ?? ex.steps) : ex.steps
  const tips  = isFemale ? (ex.female?.tips  ?? ex.tips)  : ex.tips
  const cues  = isFemale ? (ex.female?.cues  ?? ex.cues)  : ex.cues

  const levelBg    = ex.level?.includes('مبتدئ') ? '#E8F5E9' : ex.level?.includes('متوسط') ? '#FFF8E1' : '#FBE9E7'
  const levelColor = ex.level?.includes('مبتدئ') ? '#2E7D32' : ex.level?.includes('متوسط') ? '#F57F17' : '#B71C1C'

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:300,overflowY:'auto',backdropFilter:'blur(8px)'}}>
      <div style={{maxWidth:540,margin:'0 auto',backgroundColor:'var(--surface)',borderRadius:'24px 24px 0 0',minHeight:'100vh',padding:'16px 16px calc(80px + env(safe-area-inset-bottom))'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div style={{flex:1,marginInlineEnd:10}}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6}}>
              <span style={{backgroundColor:'var(--accent-faint)',border:'1px solid var(--accent-soft)',color:'var(--accent)',padding:'3px 10px',borderRadius:20,fontSize:'.68rem',fontWeight:700}}>
                {ex.category} › {ex.sub}
              </span>
              <span style={{backgroundColor:levelBg,color:levelColor,padding:'3px 10px',borderRadius:20,fontSize:'.68rem',fontWeight:700}}>
                {ex.level}
              </span>
              <span style={{backgroundColor:'var(--card)',border:'1px solid var(--accent-soft)',color:'var(--text-secondary)',padding:'3px 10px',borderRadius:20,fontSize:'.68rem'}}>
                {ex.type}
              </span>
            </div>
            <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'1.3rem',lineHeight:1.2,color:'var(--text-primary)'}}>
              {ex.name}
            </div>
          </div>
          <button onClick={onClose} style={{backgroundColor:'var(--card)',border:'1px solid var(--accent-soft)',borderRadius:10,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--text-primary)',fontSize:'1rem',flexShrink:0}}>✕</button>
        </div>

        {/* Illustration */}
        <div style={{background:'linear-gradient(135deg,var(--accent-faint) 0%,var(--surface) 100%)',border:'1px solid var(--accent-soft)',borderRadius:20,overflow:'hidden',marginBottom:16}}>
          {ex.id ? (
            <img
              src={`/exercises/${ex.id}-${sex}.webp`}
              alt={ex.name}
              style={{width:'100%',display:'block',borderRadius:20}}
              onError={e => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='block') }}
            />
          ) : null}
          <div style={{display: ex.id ? 'none' : 'block'}}>
            {ex.gifUrl ? (
              <GifPlayer src={ex.gifUrl} color="var(--accent)" name={ex.name}/>
            ) : (
              <div style={{padding:'16px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-around'}}>
                  <div style={{textAlign:'center',flex:1}}>
                    <div style={{fontSize:'.58rem',fontWeight:700,letterSpacing:2,color:'var(--text-secondary)',marginBottom:8}}>ابدأ</div>
                    <ExSVG type={ex.shape} color="var(--accent)"/>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'0 8px'}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background:'var(--accent-faint)',border:'1px solid var(--accent-soft)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </div>
                  <div style={{textAlign:'center',flex:1}}>
                    <div style={{fontSize:'.58rem',fontWeight:700,letterSpacing:2,color:'var(--text-secondary)',marginBottom:8}}>أنهِ</div>
                    <ExSVG type={ex.shape} color="var(--accent)" finished/>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Muscle activation */}
          <div style={{padding:'12px 16px',borderTop:'1px solid var(--accent-soft)'}}>
            <div style={{fontSize:'.58rem',fontWeight:700,letterSpacing:1.5,color:'var(--text-secondary)',marginBottom:6}}>العضلات المُشغَّلة</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              <span style={{backgroundColor:'var(--accent-faint)',border:'1px solid var(--accent-soft)',color:'var(--accent)',padding:'3px 10px',borderRadius:20,fontSize:'.7rem',fontWeight:800}}>⬤ {ex.primary}</span>
              {ex.secondary?.map((m,i)=>(
                <span key={i} style={{backgroundColor:'var(--card)',border:'1px solid var(--accent-soft)',color:'var(--text-secondary)',padding:'3px 10px',borderRadius:20,fontSize:'.68rem',fontWeight:600}}>{m}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Volume / Rest / Tempo */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
          {[['Volume',ex.sets],['Rest',ex.rest],['Tempo',ex.tempo||'2-1-1']].map(([l,v])=>(
            <div key={l} style={{backgroundColor:'var(--card)',boxShadow:'var(--shadow-card)',borderRadius:12,padding:'11px 10px',textAlign:'center'}}>
              <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.82rem',color:'var(--accent)',lineHeight:1.2}}>{v}</div>
              <div style={{fontSize:'.58rem',color:'var(--text-secondary)',letterSpacing:1,marginTop:4,fontWeight:700}}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div style={{backgroundColor:'var(--card)',boxShadow:'var(--shadow-card)',borderRadius:14,padding:'14px 16px',marginBottom:12}}>
          <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'var(--text-secondary)',marginBottom:14}}>طريقة الأداء الصحيحة</div>
          {steps.map((step,i)=>(
            <div key={i} style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-start'}}>
              <div style={{width:24,height:24,borderRadius:'50%',backgroundColor:'var(--accent-faint)',border:'1px solid var(--accent-soft)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
                <span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.7rem',color:'var(--accent)'}}>{i+1}</span>
              </div>
              <div style={{fontSize:'.85rem',color:'var(--text-primary)',lineHeight:1.55}}>{step}</div>
            </div>
          ))}
        </div>

        {/* Mistakes */}
        <div style={{backgroundColor:'#FEF2F2',border:'1px solid #FECACA',borderRadius:14,padding:'14px 16px',marginBottom:12}}>
          <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'#EF4444',marginBottom:12}}>⚠ COMMON MISTAKES TO AVOID</div>
          {ex.mistakes.map((m,i)=>(
            <div key={i} style={{display:'flex',gap:8,marginBottom:8,alignItems:'flex-start'}}>
              <span style={{color:'#EF4444',flexShrink:0,fontSize:.9+'rem',marginTop:1}}>✗</span>
              <span style={{fontSize:'.83rem',color:'var(--text-secondary)',lineHeight:1.5}}>{m}</span>
            </div>
          ))}
        </div>

        {/* Pro tip */}
        {tips && (
          <div style={{backgroundColor:'var(--spiritual-bg)',border:'1px solid rgba(138,90,43,0.2)',borderRadius:14,padding:'14px 16px',marginBottom:12}}>
            <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'var(--spiritual-fg)',marginBottom:8}}>💡 PRO TIP</div>
            <div style={{fontSize:'.85rem',color:'var(--text-secondary)',lineHeight:1.6}}>{tips}</div>
          </div>
        )}

        {/* Form cues */}
        {cues?.length > 0 && (
          <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:14}}>
            {cues.map((cue,i)=>(
              <span key={i} style={{backgroundColor:'var(--card)',border:'1px solid var(--accent-soft)',color:'var(--text-secondary)',padding:'5px 13px',borderRadius:20,fontSize:'.75rem',fontWeight:600}}>"{cue}"</span>
            ))}
          </div>
        )}

        {/* Stretches */}
        {stretches.length > 0 && (
          <div style={{backgroundColor:'var(--card)',border:'1px solid var(--accent-soft)',boxShadow:'var(--shadow-card)',borderRadius:14,padding:'14px 16px',marginBottom:12}}>
            <button onClick={()=>setShowStretch(v=>!v)} style={{width:'100%',background:'none',border:'none',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',padding:0}}>
              <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'var(--accent)'}}>🧘 POST-WORKOUT STRETCHES FOR {ex.category.toUpperCase()}</div>
              <span style={{color:'var(--text-secondary)',fontSize:'.8rem',transition:'transform .2s',transform:showStretch?'rotate(180deg)':'none'}}>▼</span>
            </button>
            {showStretch && stretches.map((s,i)=>(
              <div key={i} style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--accent-soft)'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                  <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.88rem',color:'var(--text-primary)'}}>{s.name}</div>
                  <span style={{backgroundColor:'var(--accent-faint)',color:'var(--accent)',padding:'2px 8px',borderRadius:20,fontSize:'.65rem',fontWeight:700,whiteSpace:'nowrap',marginInlineStart:8,flexShrink:0}}>{s.duration}</span>
                </div>
                <div style={{fontSize:'.72rem',color:'var(--text-secondary)',marginBottom:6}}>Targets: {s.muscles}</div>
                {(isFemale ? (s.femaleSteps ?? s.steps) : s.steps).map((step,j)=>(
                  <div key={j} style={{display:'flex',gap:7,marginBottom:5}}>
                    <span style={{color:'var(--accent)',fontSize:'.7rem',flexShrink:0,minWidth:14}}>{j+1}.</span>
                    <span style={{fontSize:'.8rem',color:'var(--text-secondary)',lineHeight:1.4}}>{step}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} style={{width:'100%',padding:'15px',backgroundColor:'var(--text-primary)',border:'none',borderRadius:12,fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.95rem',color:'#FFFFFF',cursor:'pointer'}}>
          Got it ✓
        </button>
      </div>
    </div>
  )
}

export default function Exercises() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [env, setEnv] = useState('home')
  const [cat, setCat] = useState('الكل')
  const [sub, setSub] = useState('الكل')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('exercises')
  const [sex, setSex] = useState('male')

  const subOptions = cat === 'الكل' ? [] : [
    'الكل',
    ...new Set(
      EXERCISE_DB
        .filter(e => e.category===cat && (e.environment||'gym')===env)
        .map(e => e.sub)
    )
  ]

  useEffect(() => {
    setSub('الكل')
    supabase.auth.getSession().then(({data:{session}}) => {
      if (!session?.user) { router.push('/'); return }
      setUser(session.user)
    })
  }, [cat, env])

  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => {
      if (!session?.user) return
      fetch(`/api/profile?userId=${session.user.id}`)
        .then(r => r.json())
        .then(d => { if (d.profile?.sex) setSex(d.profile.sex) })
        .catch(() => {})
    })
  }, [])

  const filtered = EXERCISE_DB.filter(ex =>
    (e => e.environment||'gym')(ex) === env &&
    (cat==='الكل'||ex.category===cat) &&
    (sub==='الكل'||ex.sub===sub) &&
    (ex.name.toLowerCase().includes(search.toLowerCase()) ||
     ex.primary.toLowerCase().includes(search.toLowerCase()) ||
     ex.sub.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{minHeight:'100vh',backgroundColor:'var(--surface)',color:'var(--text-primary)'}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        ::placeholder{color:var(--text-secondary);opacity:1}
        ::-webkit-scrollbar{height:3px;width:3px}
        ::-webkit-scrollbar-thumb{background:var(--accent-soft)}
        .stat-scroll{scrollbar-width:none;-ms-overflow-style:none;overflow-x:auto;display:flex}
        .stat-scroll::-webkit-scrollbar{display:none}
      `}</style>

      {/* Page header */}
      <div style={{backgroundColor:'var(--surface)',paddingBlock:16,paddingInline:16,borderBottom:'1px solid var(--accent-faint)'}}>
        <div style={{fontSize:26,fontWeight:800,color:'var(--text-primary)',textAlign:'right'}}>المكتبة</div>
        <div style={{fontSize:14,color:'var(--text-secondary)',textAlign:'right'}}>تمارينك ومرونتك</div>
      </div>

      {/* Tab bar — segmented pills */}
      <div style={{display:'flex',gap:8,padding:'12px 16px',backgroundColor:'var(--surface)'}}>
        {[['exercises','🏋️ التمارين'],['stretching','🧘 التمديد'],['warmup','🔥 الإحماء']].map(([v,lbl])=>(
          <button key={v} onClick={()=>setTab(v)}
            style={{
              flex:1,paddingBlock:10,borderRadius:24,
              textAlign:'center',fontSize:14,fontWeight:600,
              border: tab===v ? 'none' : '1px solid var(--accent-soft)',
              cursor:'pointer',
              backgroundColor: tab===v ? 'var(--text-primary)' : 'var(--card)',
              color: tab===v ? '#FFFFFF' : 'var(--text-secondary)'
            }}>
            {lbl}
          </button>
        ))}
      </div>

      <div style={{maxWidth:760,margin:'0 auto',paddingBlockEnd:'calc(80px + env(safe-area-inset-bottom))'}}>

        {tab === 'exercises' && (
          <>
            {/* Environment toggle */}
            <div style={{display:'flex',marginInline:16,marginBlockEnd:12,backgroundColor:'var(--surface-inset)',borderRadius:20,padding:4,gap:4}}>
              {[['home','🏠 المنزل'],['gym','🏋️ الصالة']].map(([v,lbl])=>(
                <button key={v} onClick={()=>{setEnv(v);setCat('الكل')}}
                  style={{
                    flex:1,paddingBlock:8,borderRadius:16,
                    fontSize:13,fontWeight:600,border:'none',cursor:'pointer',
                    backgroundColor: env===v ? 'var(--text-primary)' : 'transparent',
                    color: env===v ? '#FFFFFF' : 'var(--text-secondary)'
                  }}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* Search bar */}
            <div style={{marginInline:16,marginBlockEnd:12}}>
              <div style={{backgroundColor:'#1A1A1A',borderRadius:30,paddingInline:16,paddingBlock:12,display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:16,flexShrink:0}}>🔍</span>
                <input
                  type="text"
                  placeholder="ابحثي عن تمرين..."
                  value={search}
                  onChange={e=>setSearch(e.target.value)}
                  style={{flex:1,color:'#FFFFFF',backgroundColor:'transparent',border:'none',outline:'none',textAlign:'right',fontSize:14,fontFamily:"'Tajawal','DM Sans',sans-serif"}}
                />
              </div>
            </div>

            {/* Category pills */}
            <div className="stat-scroll" style={{paddingInline:16,gap:8,marginBlockEnd:12}}>
              {CATS.map(c=>(
                <button key={c} onClick={()=>setCat(c)}
                  style={{
                    flexShrink:0,paddingInline:16,paddingBlock:8,
                    borderRadius:20,fontSize:13,fontWeight:600,
                    whiteSpace:'nowrap',cursor:'pointer',
                    border: cat===c ? 'none' : '1px solid var(--accent-soft)',
                    backgroundColor: cat===c ? 'var(--text-primary)' : 'var(--card)',
                    color: cat===c ? '#FFFFFF' : 'var(--text-secondary)'
                  }}>
                  {CAT_AR[c]||c}
                </button>
              ))}
            </div>

            {/* Sub-muscle pills */}
            {subOptions.length > 0 && (
              <div className="stat-scroll" style={{paddingInline:16,gap:8,marginBlockEnd:12}}>
                {subOptions.map(s=>(
                  <button key={s} onClick={()=>setSub(s)}
                    style={{
                      flexShrink:0,paddingInline:12,paddingBlock:6,
                      borderRadius:20,fontSize:12,fontWeight:600,
                      whiteSpace:'nowrap',cursor:'pointer',
                      border: sub===s ? 'none' : '1px solid var(--accent-soft)',
                      backgroundColor: sub===s ? 'var(--text-primary)' : 'var(--card)',
                      color: sub===s ? '#FFFFFF' : 'var(--text-secondary)'
                    }}>
                    {SUB_AR[s]||s}
                  </button>
                ))}
              </div>
            )}

            {/* Exercise count */}
            <div style={{fontSize:13,color:'var(--text-secondary)',paddingInline:16,marginBlockEnd:8,textAlign:'right'}}>
              {filtered.length} تمرين
            </div>

            {/* Exercise grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,paddingInline:16,marginBlockEnd:20}}>
              {filtered.map(ex=><ExerciseCard key={ex.id} ex={ex} onSelect={setSelected} sex={sex}/>)}
            </div>
          </>
        )}

        {tab === 'stretching' && (
          <div style={{paddingInline:16,paddingBlockStart:8}}>
            {Object.entries(STRETCHING).map(([muscle, stretches])=>(
              <div key={muscle} style={{marginBottom:20}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBlock:'16px 8px'}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:'var(--accent)',flexShrink:0}}/>
                  <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:16,color:'var(--text-primary)'}}>{muscle} Stretches</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {stretches.map((s,i)=>(
                    <div key={i} style={{backgroundColor:'var(--card)',borderRadius:16,overflow:'hidden',boxShadow:'var(--shadow-card)'}}>
                      {s.id && (
                        <img src={`/exercises/${s.id}-${sex}.webp`} alt={s.name}
                          style={{width:'100%',maxHeight:160,objectFit:'cover',display:'block',backgroundColor:'var(--accent-faint)'}}
                          onError={e=>{e.target.style.display='none'}}/>
                      )}
                      <div style={{padding:16}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                          <span style={{backgroundColor:'var(--accent-faint)',color:'var(--accent)',padding:'3px 9px',borderRadius:20,fontSize:'.65rem',fontWeight:700,whiteSpace:'nowrap',marginInlineStart:8,flexShrink:0}}>{s.duration}</span>
                          <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:600,fontSize:'.92rem',color:'var(--text-primary)',textAlign:'right'}}>{s.name}</div>
                        </div>
                        <div style={{fontSize:'.72rem',color:'var(--text-secondary)',marginBottom:8,textAlign:'right'}}>Targets: {s.muscles}</div>
                        {(sex==='female'?(s.femaleSteps??s.steps):s.steps).map((step,j)=>(
                          <div key={j} style={{display:'flex',gap:8,marginBottom:5}}>
                            <span style={{color:'var(--accent)',fontSize:'.7rem',flexShrink:0,minWidth:16,fontWeight:700}}>{j+1}.</span>
                            <span style={{fontSize:'.82rem',color:'var(--text-secondary)',lineHeight:1.45}}>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'warmup' && (
          <div style={{paddingInline:16,paddingBlockStart:8}}>
            {Object.entries(WARMUP).map(([muscle, routines]) => (
              <div key={muscle} style={{marginBottom:20}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBlock:'16px 8px'}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:'var(--accent)',flexShrink:0}}/>
                  <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:16,color:'var(--text-primary)'}}>{muscle} Warmup</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {routines.map((r,i) => (
                    <div key={i} style={{backgroundColor:'var(--card)',borderRadius:16,overflow:'hidden',boxShadow:'var(--shadow-card)'}}>
                      {r.id && (
                        <img src={`/exercises/${r.id}-${sex}.webp`} alt={r.name}
                          style={{width:'100%',maxHeight:160,objectFit:'cover',display:'block',backgroundColor:'var(--accent-faint)'}}
                          onError={e=>{e.target.style.display='none'}}/>
                      )}
                      <div style={{padding:16}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                          <div style={{display:'flex',gap:6,flexShrink:0,marginInlineStart:10}}>
                            <span style={{backgroundColor:'var(--accent-faint)',color:'var(--accent)',padding:'2px 8px',borderRadius:20,fontSize:'.63rem',fontWeight:700,whiteSpace:'nowrap'}}>{r.sets} sets</span>
                            <span style={{backgroundColor:'var(--card)',border:'1px solid var(--accent-soft)',color:'var(--text-secondary)',padding:'2px 8px',borderRadius:20,fontSize:'.63rem',whiteSpace:'nowrap'}}>{r.duration}</span>
                          </div>
                          <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:600,fontSize:'.92rem',color:'var(--text-primary)',textAlign:'right'}}>{r.name}</div>
                        </div>
                        {r.why && <div style={{fontSize:'.72rem',color:'var(--text-secondary)',marginBottom:8,lineHeight:1.4,fontStyle:'italic',textAlign:'right'}}>Why: {r.why}</div>}
                        {(sex==='female'?(r.femaleSteps??r.steps):r.steps).map((step,j) => (
                          <div key={j} style={{display:'flex',gap:8,marginBottom:5}}>
                            <span style={{color:'var(--accent)',fontSize:'.7rem',flexShrink:0,minWidth:16,fontWeight:700}}>{j+1}.</span>
                            <span style={{fontSize:'.82rem',color:'var(--text-secondary)',lineHeight:1.45}}>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {selected && <ExerciseDetail ex={selected} onClose={()=>setSelected(null)} sex={sex}/>}
      <BottomTabs active="exercises"/>
    </div>
  )
}
