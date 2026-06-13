import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { TopNav, BottomTabs } from '../components/Nav'
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
const LEVEL_C = { Beginner:'#22c55e',Intermediate:'#eab308',Advanced:'#f97316' }

function MuscleMap({ ex }) {
  const color = mc(ex.category)
  return (
    <div style={{background:`linear-gradient(135deg,${color}12 0%,var(--surface) 100%)`,border:`1px solid ${color}25`,borderRadius:16,padding:'16px',marginBottom:16}}>
      <div style={{fontSize:'.6rem',fontWeight:700,letterSpacing:1.5,color:'rgba(0,0,0,0.25)',marginBottom:12}}>العضلات المُشغَّلة</div>
      {/* Primary */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:'.65rem',fontWeight:700,color:color,letterSpacing:1,marginBottom:4}}>الأساسية</div>
        <span style={{background:color+'22',border:`1px solid ${color}44`,color:color,padding:'4px 12px',borderRadius:20,fontSize:'.8rem',fontWeight:700}}>{ex.primary}</span>
      </div>
      {/* Secondary */}
      {ex.secondary?.length>0&&(
        <div style={{marginBottom:8}}>
          <div style={{fontSize:'.65rem',fontWeight:700,color:'var(--text-secondary)',letterSpacing:1,marginBottom:4}}>الثانوية</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
            {ex.secondary.map((m,i)=><span key={i} style={{background:'rgba(0,0,0,0.04)',border:'1px solid rgba(0,0,0,0.08)',color:'var(--text-secondary)',padding:'3px 10px',borderRadius:20,fontSize:'.75rem',fontWeight:600}}>{m}</span>)}
          </div>
        </div>
      )}
      {/* Other */}
      {ex.other?.length>0&&(
        <div>
          <div style={{fontSize:'.65rem',fontWeight:700,color:'rgba(0,0,0,0.25)',letterSpacing:1,marginBottom:4}}>المثبّتة</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
            {ex.other.map((m,i)=><span key={i} style={{background:'rgba(0,0,0,0.04)',border:'1px solid rgba(0,0,0,0.06)',color:'rgba(0,0,0,0.25)',padding:'2px 9px',borderRadius:20,fontSize:'.7rem'}}>{m}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}

function ExSVG({ type, color: c, finished=false }) {
  const a = finished ? 0.6 : 1
  if (type==='barbell') return (
    <svg width="120" height="80" viewBox="0 0 120 80">
      <circle cx={finished?60:60} cy={16} r={9} fill={c} opacity={.9*a}/>
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
  // body/default
  return (
    <svg width="120" height="85" viewBox="0 0 120 85">
      <line x1={10} y1={78} x2={110} y2={78} stroke={c} strokeWidth={2} opacity={.2}/>
      <circle cx={finished?70:72} cy={16} r={9} fill={c} opacity={.9}/>
      <line x1={finished?70:72} y1={25} x2={finished?56:56} y2={46} stroke={c} strokeWidth={5} strokeLinecap="round"/>
      <line x1={finished?66:68} y1={33} x2={finished?86:88} y2={22} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={finished?58:58} y1={35} x2={finished?38:36} y2={44} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={finished?56:56} y1={46} x2={finished?40:38} y2={64} stroke={c} strokeWidth={5} strokeLinecap="round"/>
      <line x1={finished?40:38} y1={64} x2={finished?28:26} y2={78} stroke={c} strokeWidth={4} strokeLinecap="round"/>
      <line x1={finished?58:58} y1={48} x2={finished?72:74} y2={62} stroke={c} strokeWidth={5} strokeLinecap="round"/>
      <line x1={finished?72:74} y1={62} x2={finished?86:90} y2={53} stroke={c} strokeWidth={4} strokeLinecap="round"/>
    </svg>
  )
}

function GifPlayer({ src, color, name }) {
  const [playing, setPlaying] = React.useState(true)
  const [loaded, setLoaded] = React.useState(false)
  const [err, setErr] = React.useState(false)
  // Use a key trick to pause/resume GIF (GIFs can't be paused natively in HTML)
  // We show a static screenshot when "paused" - simplified: just show/hide
  return (
    <div style={{position:'relative',background:'rgba(0,0,0,0.06)',minHeight:220}}>
      {!loaded && !err && (
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10}}>
          <div style={{width:36,height:36,border:`3px solid ${color}33`,borderTopColor:color,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
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
          style={{width:'100%',maxHeight:280,objectFit:'contain',display:loaded?'block':'none',background:'rgba(0,0,0,0.06)'}}
        />
      ) : (
        <div style={{height:160,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8,padding:16}}>
          <div style={{fontSize:'2rem'}}>🏋️</div>
          <div style={{color:'var(--text-secondary)',fontSize:'.75rem',textAlign:'center'}}>معاينة غير متاحة</div>
        </div>
      )}
      {loaded && !err && (
        <div style={{position:'absolute',bottom:8,insetInlineEnd:8}}>
          <span style={{background:'rgba(0,0,0,.65)',borderRadius:20,padding:'3px 10px',fontSize:'.65rem',color:color,fontWeight:700,backdropFilter:'blur(4px)'}}>
            GIF
          </span>
        </div>
      )}
    </div>
  )
}

function ExerciseCard({ ex, onSelect, sex = 'male' }) {
  const color = mc(ex.category)
  return (
    <div onClick={() => onSelect(ex)}
      style={{background:'var(--surface)',border:`1px solid ${color}22`,borderRadius:16,overflow:'hidden',cursor:'pointer',transition:'all .2s'}}
      onTouchStart={e=>e.currentTarget.style.transform='scale(.96)'} onTouchEnd={e=>e.currentTarget.style.transform='scale(1)'}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=color+'55';e.currentTarget.style.background='var(--card)'}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=color+'22';e.currentTarget.style.background='var(--surface)'}}>
      {/* Illustration */}
      <div style={{background:`linear-gradient(135deg,${color}0c 0%,var(--surface) 100%)`,position:'relative',overflow:'hidden',minHeight:100}}>
        <div style={{position:'absolute',top:6,insetInlineEnd:8,zIndex:2,fontSize:'.58rem',fontWeight:700,letterSpacing:1,color:`${color}cc`,background:'rgba(0,0,0,0.45)',borderRadius:6,padding:'1px 6px'}}>{ex.equipment.toUpperCase()}</div>
        <img
          src={`/exercises/${ex.id}-${sex}.webp`}
          alt={ex.name}
          style={{width:'100%',display:'block',objectFit:'cover',maxHeight:160}}
          onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex'}}
        />
        <div style={{display:'none',alignItems:'center',justifyContent:'center',minHeight:100}}>
          <ExSVG type={ex.shape} color={color}/>
        </div>
      </div>
      {/* Info */}
      <div style={{padding:'10px 12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
          <span style={{background:`${color}20`,color,padding:'2px 7px',borderRadius:20,fontSize:'.6rem',fontWeight:700,border:`1px solid ${color}33`}}>{SUB_AR[ex.sub]||ex.sub}</span>
          <span style={{fontSize:'.6rem',fontWeight:700,color:LEVEL_C[ex.level]||'#888'}}>{ex.level}</span>
        </div>
        {/* Arabic name */}
        <div style={{fontFamily:"'Tajawal',sans-serif",fontWeight:800,fontSize:'.92rem',lineHeight:1.25,marginBottom:2,direction:'rtl'}}>
          {ex.name.includes('|') ? ex.name.split('|')[1].trim() : ex.name}
        </div>
        {/* English name */}
        {ex.name.includes('|') && (
          <div style={{fontFamily:"'DM Sans','Space Grotesk',sans-serif",fontWeight:500,fontSize:'.72rem',color:'rgba(0,0,0,0.25)',marginBottom:3}}>
            {ex.name.split('|')[0].trim()}
          </div>
        )}
        {/* Target muscle */}
        <div style={{fontSize:'.65rem',color:`${color}bb`,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ex.primary}</div>
      </div>
    </div>
  )
}

function ExerciseDetail({ ex, onClose, sex = 'male' }) {
  const color = mc(ex.category)
  const [showStretch, setShowStretch] = useState(false)
  const stretches = STRETCHING[ex.category] || []
  const isFemale = sex === 'female'
  const steps = isFemale ? (ex.female?.steps ?? ex.steps) : ex.steps
  const tips  = isFemale ? (ex.female?.tips  ?? ex.tips)  : ex.tips
  const cues  = isFemale ? (ex.female?.cues  ?? ex.cues)  : ex.cues
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.06)',zIndex:300,overflowY:'auto',backdropFilter:'blur(12px)'}}>
      <div style={{maxWidth:540,margin:'0 auto',padding:'16px 16px calc(80px + env(safe-area-inset-bottom))'}}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div style={{flex:1,marginInlineEnd:10}}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6}}>
              <span style={{background:`${color}22`,border:`1px solid ${color}44`,color,padding:'3px 10px',borderRadius:20,fontSize:'.68rem',fontWeight:700}}>{ex.category} › {ex.sub}</span>
              <span style={{background:LEVEL_C[ex.level]+'18',border:`1px solid ${LEVEL_C[ex.level]}44`,color:LEVEL_C[ex.level],padding:'3px 10px',borderRadius:20,fontSize:'.68rem',fontWeight:700}}>{ex.level}</span>
              <span style={{background:'rgba(0,0,0,0.04)',border:'1px solid rgba(0,0,0,0.08)',color:'var(--text-secondary)',padding:'3px 10px',borderRadius:20,fontSize:'.68rem'}}>{ex.type}</span>
            </div>
            <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'1.3rem',lineHeight:1.2}}>{ex.name}</div>
          </div>
          <button onClick={onClose} style={{background:'rgba(0,0,0,0.06)',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--text-secondary)',fontSize:'1rem',flexShrink:0}}>✕</button>
        </div>

        {/* Exercise illustration / GIF demonstration */}
        <div style={{background:`linear-gradient(135deg,${color}0c 0%,var(--surface) 100%)`,border:`1px solid ${color}25`,borderRadius:20,overflow:'hidden',marginBottom:16}}>
          {ex.id ? (
            <img
              src={`/exercises/${ex.id}-${sex}.webp`}
              alt={ex.name}
              style={{width:'100%',display:'block',borderRadius:20}}
              onError={e => {
                e.target.style.display = 'none'
                e.target.nextSibling && (e.target.nextSibling.style.display = 'block')
              }}
            />
          ) : null}
          <div style={{display: ex.id ? 'none' : 'block'}}>
          {ex.gifUrl ? (
            <GifPlayer src={ex.gifUrl} color={color} name={ex.name}/>
          ) : (
            <div style={{padding:'16px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-around'}}>
                <div style={{textAlign:'center',flex:1}}>
                  <div style={{fontSize:'.58rem',fontWeight:700,letterSpacing:2,color:`${color}70`,marginBottom:8}}>ابدأ</div>
                  <ExSVG type={ex.shape} color={color}/>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'0 8px'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:`${color}20`,border:`1px solid ${color}40`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </div>
                <div style={{textAlign:'center',flex:1}}>
                  <div style={{fontSize:'.58rem',fontWeight:700,letterSpacing:2,color:`${color}70`,marginBottom:8}}>أنهِ</div>
                  <ExSVG type={ex.shape} color={color} finished/>
                </div>
              </div>
            </div>
          )}
          </div>
          {/* Muscle activation tags */}
          <div style={{padding:'12px 16px',borderTop:`1px solid ${color}18`}}>
            <div style={{fontSize:'.58rem',fontWeight:700,letterSpacing:1.5,color:'rgba(0,0,0,0.25)',marginBottom:6}}>العضلات المُشغَّلة</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              <span style={{background:`${color}25`,border:`1px solid ${color}44`,color,padding:'3px 10px',borderRadius:20,fontSize:'.7rem',fontWeight:800}}>⬤ {ex.primary}</span>
              {ex.secondary?.map((m,i)=><span key={i} style={{background:'rgba(0,0,0,0.04)',border:'1px solid rgba(0,0,0,0.08)',color:'var(--text-secondary)',padding:'3px 10px',borderRadius:20,fontSize:'.68rem',fontWeight:600}}>{m}</span>)}
            </div>
          </div>
        </div>

        {/* Volume guide */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
          {[['Volume',ex.sets,''],['Rest',ex.rest,''],['Tempo',ex.tempo||'2-1-1','']].map(([l,v])=>(
            <div key={l} style={{background:'rgba(0,0,0,0.04)',border:'1px solid rgba(0,0,0,0.06)',borderRadius:12,padding:'11px 10px',textAlign:'center'}}>
              <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.82rem',color,lineHeight:1.2}}>{v}</div>
              <div style={{fontSize:'.58rem',color:'rgba(0,0,0,0.25)',letterSpacing:1,marginTop:4,fontWeight:700}}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Step by step */}
        <div style={{background:'rgba(0,0,0,0.04)',border:'1px solid rgba(0,0,0,0.06)',borderRadius:14,padding:'14px 16px',marginBottom:12}}>
          <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'rgba(0,0,0,0.30)',marginBottom:14}}>طريقة الأداء الصحيحة</div>
          {steps.map((step,i)=>(
            <div key={i} style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-start'}}>
              <div style={{width:24,height:24,borderRadius:'50%',background:`${color}20`,border:`1px solid ${color}44`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
                <span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.7rem',color}}>{i+1}</span>
              </div>
              <div style={{fontSize:'.85rem',color:'var(--text-primary)',lineHeight:1.55}}>{step}</div>
            </div>
          ))}
        </div>

        {/* أخطاء شائعة - RED */}
        <div style={{background:'rgba(239,68,68,0.05)',border:'1px solid rgba(239,68,68,0.18)',borderRadius:14,padding:'14px 16px',marginBottom:12}}>
          <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'#f87171',marginBottom:12}}>⚠ COMMON MISTAKES TO AVOID</div>
          {ex.mistakes.map((m,i)=>(
            <div key={i} style={{display:'flex',gap:8,marginBottom:8,alignItems:'flex-start'}}>
              <span style={{color:'#ef4444',flexShrink:0,fontSize:.9+'rem',marginTop:1}}>✗</span>
              <span style={{fontSize:'.83rem',color:'var(--text-secondary)',lineHeight:1.5}}>{m}</span>
            </div>
          ))}
        </div>

        {/* Pro tip */}
        {tips&&<div style={{background:`${color}0c`,border:`1px solid ${color}28`,borderRadius:14,padding:'14px 16px',marginBottom:12}}>
          <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:`${color}99`,marginBottom:8}}>💡 PRO TIP</div>
          <div style={{fontSize:'.85rem',color:'var(--text-secondary)',lineHeight:1.6}}>{tips}</div>
        </div>}

        {/* Form cues */}
        {cues?.length>0&&<div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:14}}>
          {cues.map((cue,i)=><span key={i} style={{background:'rgba(0,0,0,0.04)',border:'1px solid rgba(0,0,0,0.08)',color:'var(--text-secondary)',padding:'5px 13px',borderRadius:20,fontSize:'.75rem',fontWeight:600}}>"{cue}"</span>)}
        </div>}

        {/* Stretching section */}
        {stretches.length>0&&(
          <div style={{background:'rgba(129,140,248,0.05)',border:'1px solid rgba(129,140,248,0.18)',borderRadius:14,padding:'14px 16px',marginBottom:12}}>
            <button onClick={()=>setShowStretch(v=>!v)} style={{width:'100%',background:'none',border:'none',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',padding:0}}>
              <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'#818cf8'}}>🧘 POST-WORKOUT STRETCHES FOR {ex.category.toUpperCase()}</div>
              <span style={{color:'var(--text-secondary)',fontSize:'.8rem',transition:'transform .2s',transform:showStretch?'rotate(180deg)':'none'}}>▼</span>
            </button>
            {showStretch&&stretches.map((s,i)=>(
              <div key={i} style={{marginTop:12,paddingTop:12,borderTop:'1px solid rgba(0,0,0,0.08)'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                  <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.88rem'}}>{s.name}</div>
                  <span style={{background:'rgba(129,140,248,0.15)',color:'#818cf8',padding:'2px 8px',borderRadius:20,fontSize:'.65rem',fontWeight:700}}>{s.duration}</span>
                </div>
                <div style={{fontSize:'.72rem',color:'rgba(129,140,248,0.7)',marginBottom:6}}>Targets: {s.muscles}</div>
                {(isFemale ? (s.femaleSteps ?? s.steps) : s.steps).map((step,j)=>(
                  <div key={j} style={{display:'flex',gap:7,marginBottom:5}}>
                    <span style={{color:'#818cf8',fontSize:'.7rem',flexShrink:0,minWidth:14}}>{j+1}.</span>
                    <span style={{fontSize:'.8rem',color:'var(--text-secondary)',lineHeight:1.4}}>{step}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} style={{width:'100%',padding:'15px',background:color,border:'none',borderRadius:12,fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.95rem',color:'#0C0B0D',cursor:'pointer'}}>Got it ✓</button>
      </div>
    </div>
  )
}

export default function Exercises() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [env, setEnv] = useState('home')   // 'home' | 'gym'
  const [cat, setCat] = useState('الكل')
  const [sub, setSub] = useState('الكل')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('exercises')
  const [sex, setSex] = useState('male')

  // Sub-muscles available in current env + category
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
    <div style={{minHeight:'100vh',background:'var(--surface)',color:'var(--text-primary)'}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        input{background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08);color:var(--text-primary);padding:11px 14px;font-family:'DM Sans','Tajawal',sans-serif;font-size:.9rem;border-radius:10px;outline:none;width:100%;transition:all .2s}
        input:focus{border-color:#111111;background:rgba(0,0,0,0.04)}
        ::placeholder{color:rgba(0,0,0,0.25)}
        .ptab{background:transparent;border:none;border-bottom:2px solid transparent;color:var(--text-secondary);font-family:'DM Sans','Tajawal',sans-serif;font-size:.88rem;font-weight:600;padding:10px 14px;cursor:pointer;transition:all .2s}
        .ptab.on{color:var(--text-primary);border-bottom-color:#111111}
        ::-webkit-scrollbar{height:3px;width:3px} ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.08)}
      `}</style>
      <TopNav title="مكتبة التمارين" user={user} back="/" onSignOut={()=>supabase.auth.signOut().then(()=>router.push('/'))}/>

      {/* IMG-PLACEHOLDER: exercises-hero · 16:9 · exercises library hero */}
      <div className="img-placeholder" style={{width:'100%',aspectRatio:'16/9',borderRadius:'0 0 24px 24px',marginBottom:0}}/>

      <div style={{maxWidth:760,margin:'0 auto',padding:'14px 16px 0'}}>
        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid rgba(0,0,0,0.08)',marginBottom:14}}>
          <button className={`ptab${tab==='exercises'?' on':''}`} onClick={()=>setTab('exercises')}>🏋️ التمارين</button>
          <button className={`ptab${tab==='stretching'?' on':''}`} onClick={()=>setTab('stretching')}>🧘 التمديد</button>
          <button className={`ptab${tab==='warmup'?' on':''}`} onClick={()=>setTab('warmup')}>🔥 الإحماء</button>
        </div>

        {tab === 'exercises' && (
          <>
            {/* Home / Gym toggle */}
            <div style={{display:'flex',gap:8,marginBottom:14}}>
              {[['home','🏠 المنزل'],['gym','🏋️ الصالة']].map(([v,lbl])=>(
                <button key={v} onClick={()=>{setEnv(v);setCat('الكل')}}
                  style={{flex:1,padding:'10px 0',borderRadius:22,fontFamily:"'DM Sans','Tajawal',sans-serif",fontWeight:700,fontSize:'.9rem',cursor:'pointer',transition:'all .2s',
                    background: env===v ? '#111111' : 'rgba(0,0,0,0.05)',
                    color:       env===v ? '#FFFFFF' : 'var(--text-primary)',
                    border:      env===v ? 'none'    : '1px solid rgba(0,0,0,0.08)',
                  }}>
                  {lbl}
                </button>
              ))}
            </div>
            <input type="text" placeholder="ابحث باسم التمرين أو العضلة…" value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:12}}/>
            {/* Category filter */}
            <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4,marginBottom:sub!=='الكل'||subOptions.length>0?8:12,scrollbarWidth:'none'}}>
              {CATS.map(c=>(
                <button key={c} onClick={()=>setCat(c)}
                  style={{flexShrink:0,padding:'6px 13px',background:cat===c?(MC[c]||'#111111')+'22':'rgba(0,0,0,0.04)',border:`1px solid ${cat===c?(MC[c]||'#111111')+'55':'rgba(0,0,0,0.08)'}`,borderRadius:20,color:cat===c?(MC[c]||'#111111'):'var(--text-secondary)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.8rem',fontWeight:700}}>
                  {CAT_AR[c]||c}
                </button>
              ))}
            </div>
            {/* Sub-muscle filter */}
            {subOptions.length>0&&(
              <div style={{display:'flex',gap:5,overflowX:'auto',paddingBottom:4,marginBottom:12,scrollbarWidth:'none'}}>
                {subOptions.map(s=>(
                  <button key={s} onClick={()=>setSub(s)}
                    style={{flexShrink:0,padding:'4px 11px',background:sub===s?'rgba(0,0,0,0.10)':'transparent',border:`1px solid ${sub===s?'rgba(0,0,0,0.25)':'rgba(0,0,0,0.06)'}`,borderRadius:20,color:sub===s?'var(--text-primary)':'var(--text-secondary)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.75rem',fontWeight:sub===s?700:500}}>
                    {SUB_AR[s]||s}
                  </button>
                ))}
              </div>
            )}
            <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'rgba(0,0,0,0.25)',marginBottom:10}}>
              {filtered.length} تمرين · {env==='home'?'🏠 المنزل':'🏋️ الصالة'}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:20}}>
              {filtered.map(ex=><ExerciseCard key={ex.id} ex={ex} onSelect={setSelected} sex={sex}/>)}
            </div>
          </>
        )}

        {tab === 'stretching' && (
          <div>
            {Object.entries(STRETCHING).map(([muscle, stretches])=>(
              <div key={muscle} style={{marginBottom:20}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:mc(muscle),flexShrink:0}}/>
                  <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'1rem',color:mc(muscle)}}>{muscle} Stretches</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {stretches.map((s,i)=>(
                    <div key={i} style={{background:'rgba(0,0,0,0.04)',border:'1px solid rgba(0,0,0,0.06)',borderRadius:14,overflow:'hidden'}}>
                      {s.id&&<img src={`/exercises/${s.id}-${sex}.webp`} alt={s.name} style={{width:'100%',maxHeight:160,objectFit:'cover',display:'block'}} onError={e=>{e.target.style.display='none'}}/>}
                      <div style={{padding:'14px 16px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                        <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.92rem'}}>{s.name}</div>
                        <span style={{background:mc(muscle)+'18',border:`1px solid ${mc(muscle)}33`,color:mc(muscle),padding:'3px 9px',borderRadius:20,fontSize:'.65rem',fontWeight:700,whiteSpace:'nowrap',marginInlineStart:8,flexShrink:0}}>{s.duration}</span>
                      </div>
                      <div style={{fontSize:'.72rem',color:'var(--text-secondary)',marginBottom:8}}>Targets: {s.muscles}</div>
                      {(sex==='female'?(s.femaleSteps??s.steps):s.steps).map((step,j)=>(
                        <div key={j} style={{display:'flex',gap:8,marginBottom:5}}>
                          <span style={{color:mc(muscle),fontSize:'.7rem',flexShrink:0,minWidth:16,fontWeight:700}}>{j+1}.</span>
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
          <div>
            {Object.entries(WARMUP).map(([muscle, routines]) => (
              <div key={muscle} style={{marginBottom:20}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:mc(muscle),flexShrink:0}}/>
                  <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'1rem',color:mc(muscle)}}>{muscle} Warmup</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {routines.map((r,i) => (
                    <div key={i} style={{background:'rgba(0,0,0,0.04)',border:'1px solid rgba(0,0,0,0.06)',borderRadius:14,overflow:'hidden'}}>
                      {r.id&&<img src={`/exercises/${r.id}-${sex}.webp`} alt={r.name} style={{width:'100%',maxHeight:160,objectFit:'cover',display:'block'}} onError={e=>{e.target.style.display='none'}}/>}
                      <div style={{padding:'14px 16px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                        <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.92rem'}}>{r.name}</div>
                        <div style={{display:'flex',gap:6,flexShrink:0,marginInlineStart:10}}>
                          <span style={{background:mc(muscle)+'18',border:`1px solid ${mc(muscle)}33`,color:mc(muscle),padding:'2px 8px',borderRadius:20,fontSize:'.63rem',fontWeight:700,whiteSpace:'nowrap'}}>{r.sets} sets</span>
                          <span style={{background:'rgba(0,0,0,0.04)',border:'1px solid rgba(0,0,0,0.06)',color:'var(--text-secondary)',padding:'2px 8px',borderRadius:20,fontSize:'.63rem',whiteSpace:'nowrap'}}>{r.duration}</span>
                        </div>
                      </div>
                      {r.why && <div style={{fontSize:'.72rem',color:'var(--text-secondary)',marginBottom:8,lineHeight:1.4,fontStyle:'italic'}}>Why: {r.why}</div>}
                      {(sex==='female'?(r.femaleSteps??r.steps):r.steps).map((step,j) => (
                        <div key={j} style={{display:'flex',gap:8,marginBottom:5}}>
                          <span style={{color:mc(muscle),fontSize:'.7rem',flexShrink:0,minWidth:16,fontWeight:700}}>{j+1}.</span>
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
