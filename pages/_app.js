import '../styles/globals.css'
export const APP_VERSION = 'v5.1'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import React from 'react'
import ChatWidget from '../components/ChatWidget'

// ── Error Boundary ─────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('App error:', error, info) }
  render() {
    if (this.state.hasError) return (
      <div style={{minHeight:'100vh',background:'var(--surface)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center',direction:'rtl'}}>
        <div style={{fontSize:'2.5rem',marginBottom:16}}>⚠️</div>
        <div style={{fontFamily:"'Tajawal',sans-serif",fontWeight:800,fontSize:'1.2rem',color:'var(--text-primary)',marginBottom:8}}>صار خطأ غير متوقع</div>
        <div style={{fontFamily:"'Tajawal',sans-serif",fontSize:'.85rem',color:'var(--text-secondary)',marginBottom:24}}>نعتذر — جرّب تحديث الصفحة.</div>
        <button onClick={()=>window.location.reload()} style={{background:'#111111',color:'#FFFFFF',border:'none',borderRadius:9999,padding:'14px 32px',fontFamily:"'Tajawal',sans-serif",fontWeight:800,fontSize:'.95rem',cursor:'pointer'}}>
          تحديث الصفحة
        </button>
        {process.env.NODE_ENV === 'development' && (
          <pre style={{marginTop:16,fontSize:'.7rem',color:'#ef4444',textAlign:'left',maxWidth:500,overflow:'auto'}}>
            {this.state.error?.toString()}
          </pre>
        )}
      </div>
    )
    return this.props.children
  }
}

// ── Status Gate — checks if user is approved ────────────
const PUBLIC_ROUTES = ['/', '/landing', '/pending', '/suspended', '/admin']
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL

function StatusGate({ children }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Don't check on public/landing routes
    if (PUBLIC_ROUTES.includes(router.pathname)) { setChecked(true); return }

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setChecked(true); return }

      // Admin always passes
      if (session.user.email === ADMIN_EMAIL || session.user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        setChecked(true); return
      }

      try {
        const r = await fetch(`/api/profile?userId=${session.user.id}`)
        const d = await r.json()
        const status = d.profile?.status
        if (status === 'pending') { router.replace('/pending'); return }
        if (status === 'suspended') { router.replace('/suspended'); return }
      } catch(e) {}
      setChecked(true)
    }
    check()
  }, [router.pathname])

  if (!checked && !PUBLIC_ROUTES.includes(router.pathname)) return (
    <div style={{minHeight:'100vh',background:'#09090B',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,border:'3px solid rgba(203,162,59,0.2)',borderTopColor:'#CBA23B',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  return children
}

// ── PWA Install Banner ──────────────────────────────────
function PWABanner() {
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa_dismissed')
    if (dismissed) return

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show) return null

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShow(false)
    }
  }

  return (
    <div style={{position:'fixed',bottom:80,left:16,right:16,zIndex:500,background:'#1A1710',border:'1px solid rgba(203,162,59,0.3)',borderRadius:16,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,direction:'rtl',boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
      <div style={{fontSize:'1.6rem',flexShrink:0}}>📲</div>
      <div style={{flex:1}}>
        <div style={{fontFamily:"'Tajawal',sans-serif",fontWeight:700,fontSize:'.88rem',color:'#ECE3CF'}}>نزّل التطبيق على شاشتك</div>
        <div style={{fontFamily:"'Tajawal',sans-serif",fontSize:'.72rem',color:'#6B5F47'}}>وصول أسرع بدون متصفح</div>
      </div>
      <button onClick={install} style={{background:'#CBA23B',color:'#09090B',border:'none',borderRadius:10,padding:'8px 16px',fontFamily:"'Tajawal',sans-serif",fontWeight:800,fontSize:'.8rem',cursor:'pointer',flexShrink:0}}>تثبيت</button>
      <button onClick={()=>{setShow(false);localStorage.setItem('pwa_dismissed','1')}} style={{background:'none',border:'none',color:'#6B5F47',cursor:'pointer',fontSize:'1.2rem',flexShrink:0,lineHeight:1}}>×</button>
    </div>
  )
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    document.documentElement.setAttribute('lang', 'ar')
    document.documentElement.setAttribute('dir', 'rtl')
  }, [])

  return (
    <ErrorBoundary>
      <Head>
        <title>GYM TRACKER GCC</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0C0B0D" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="description" content="برنامج تمرين مخصص بالذكاء الاصطناعي للخليج" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏋️</text></svg>" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;700;900&family=Tajawal:wght@300;400;500;700&family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <StatusGate>
        <Component {...pageProps} />
        <PWABanner />
          <ChatWidget />
      </StatusGate>
    </ErrorBoundary>
  )
}
