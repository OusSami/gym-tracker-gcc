import { useState, useEffect, useRef } from 'react'
import React from 'react'
import { useRouter } from 'next/router'

export function TopNav({ title, back, user, onSignOut }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const go = path => { setOpen(false); router.push(path) }

  // RTL: back arrow points right (→) since layout is flipped
  const BackArrow = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(236,227,207,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  )

  return (
    <div style={{
      position:'sticky', top:0, zIndex:100,
      background:'rgba(9,9,11,0.88)',
      backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
      borderBottom:'1px solid rgba(203,162,59,0.13)',
      padding:'0 16px', height:56,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      direction:'rtl',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        {back && (
          <button onClick={() => typeof back==='function' ? back() : router.push(back)}
            style={{background:'rgba(203,162,59,0.08)',border:'1px solid rgba(203,162,59,0.18)',borderRadius:9,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
            <BackArrow />
          </button>
        )}
        {title ? (
          <span style={{fontFamily:"'Tajawal','Space Grotesk',sans-serif",fontWeight:700,fontSize:'1rem',color:'#ECE3CF'}}>{title}</span>
        ) : (
          <div style={{display:'flex',alignItems:'baseline',gap:6}}>
            <span style={{fontFamily:"'Noto Kufi Arabic',sans-serif",fontWeight:900,fontSize:'1.3rem',color:'#CBA23B',lineHeight:1}}>GYM</span>
            <span style={{fontFamily:"'Noto Kufi Arabic',sans-serif",fontWeight:700,fontSize:'1.1rem',lineHeight:1,color:'#ECE3CF'}}>TRACKER</span>
          </div>
        )}
      </div>

      {user && (
        <div ref={ref} style={{position:'relative'}}>
          <button onClick={() => setOpen(o => !o)}
            style={{display:'flex',alignItems:'center',gap:8,background:'rgba(203,162,59,0.07)',border:'1px solid rgba(203,162,59,0.18)',borderRadius:10,padding:'6px 12px',cursor:'pointer',transition:'background .15s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(203,162,59,0.13)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(203,162,59,0.07)'}>
            {user.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} alt="" style={{width:22,height:22,borderRadius:'50%',objectFit:'cover'}}/>
            )}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(203,162,59,0.6)" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>

          {open && (
            <div style={{
              position:'absolute', top:'calc(100% + 8px)', left:0, right:'auto',
              background:'rgba(14,13,10,0.98)',
              border:'1px solid rgba(203,162,59,0.15)',
              borderRadius:14, padding:6, minWidth:190, zIndex:200,
              boxShadow:'0 20px 60px rgba(0,0,0,0.7)',
              backdropFilter:'blur(20px)',
              animation:'fadeIn .15s ease forwards',
              direction:'rtl',
            }}>
              {user.user_metadata?.full_name && (
                <>
                  <div style={{padding:'8px 12px 4px',fontSize:'.78rem',color:'rgba(203,162,59,0.5)',fontFamily:"'Tajawal',sans-serif"}}>{user.user_metadata.full_name}</div>
                  <div style={{height:1,background:'rgba(203,162,59,0.1)',margin:'4px 0'}}/>
                </>
              )}
              {[
                {icon:'🏠', label:'الرئيسية',       path:'/'},
                {icon:'📊', label:'تقدمك',       path:'/dashboard'},
                {icon:'🫵', label:'جسمك بالذكاء',   path:'/body'},
                {icon:'🍽️', label:'تغذيتك',          path:'/meals'},
                {icon:'📚', label:'مكتبة التمارين',      path:'/exercises'},
                {icon:'⚙️', label:'الإعدادات',       path:'/settings'},
              ].map(item => (
                <button key={item.path} onClick={() => go(item.path)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:9,cursor:'pointer',fontFamily:"'Tajawal',sans-serif",fontSize:'.92rem',fontWeight:500,color:'rgba(236,227,207,0.6)',transition:'all .12s',border:'none',background:'none',width:'100%',textAlign:'right',direction:'rtl'}}
                  onMouseEnter={e=>{e.currentTarget.style.background='rgba(203,162,59,0.08)';e.currentTarget.style.color='#ECE3CF'}}
                  onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='rgba(236,227,207,0.6)'}}>
                  <span>{item.icon}</span>{item.label}
                </button>
              ))}
              <div style={{height:1,background:'rgba(203,162,59,0.1)',margin:'4px 0'}}/>
              <button onClick={() => { setOpen(false); onSignOut && onSignOut() }}
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:9,cursor:'pointer',fontFamily:"'Tajawal',sans-serif",fontSize:'.92rem',fontWeight:500,color:'rgba(248,113,113,0.7)',transition:'all .12s',border:'none',background:'none',width:'100%',textAlign:'right',direction:'rtl'}}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.08)';e.currentTarget.style.color='#f87171'}}
                onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='rgba(248,113,113,0.7)'}}>
                <span>👋</span> تسجيل الخروج
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function BottomTabs({ active }) {
  const router = useRouter()
  const [hasSession, setHasSession] = React.useState(false)

  React.useEffect(() => {
    try {
      const keys = ['gt_v5','gt_v4','gt_v3','gym_session']
      for (const k of keys) {
        const s = localStorage.getItem(k)
        if (s) {
          const d = JSON.parse(s)
          if (d.screen && !['auth','home','done',undefined,null].includes(d.screen)) {
            setHasSession(true); return
          }
        }
      }
    } catch(e) {}
    setHasSession(false)
  }, [active])

  const tabs = [
    { id:'home',      icon:'🏠', label: hasSession ? '🔴 جارٍ' : 'الرئيسية', path:'/' },
    { id:'dashboard', icon:'📊', label:'التقدم', path:'/progress' },
    { id:'meals',     icon:'🍽️', label:'التغذية', path:'/meals' },
    { id:'program',   icon:'📅', label:'برنامجي', path:'/program' },
    { id:'exercises', icon:'📚', label:'المكتبة', path:'/exercises' },
  ]

  return (
    <div style={{
      position:'fixed', bottom:0, left:0, right:0, zIndex:100,
      background:'var(--card)',
      borderBlockStart:'1px solid rgba(0,0,0,0.08)',
      display:'flex', alignItems:'center', justifyContent:'space-around',
      paddingBlock:'8px',
      paddingBlockEnd:'calc(8px + env(safe-area-inset-bottom))',
      height:'calc(60px + env(safe-area-inset-bottom))',
      direction:'rtl',
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => router.push(t.path)}
          style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            paddingBlock:'5px', paddingInline:'14px',
            borderRadius:'var(--radius-md)', cursor:'pointer',
            transition:'all .15s', background:'transparent', border:'none',
            color: active===t.id ? '#111111' : '#A1A1AA',
            minWidth:56,
          }}>
          <span style={{fontSize:'1.25rem',lineHeight:1}}>{t.icon}</span>
          <span style={{fontSize:'.65rem',fontWeight:700,fontFamily:"'Tajawal',sans-serif"}}>{t.label}</span>
        </button>
      ))}
    </div>
  )
}
