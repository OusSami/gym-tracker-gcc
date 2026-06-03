import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function PendingPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setEmail(session.user.email || '')
      // Poll every 10s to auto-redirect when approved
      const poll = setInterval(async () => {
        try {
          const r = await fetch(`/api/profile?userId=${session.user.id}`)
          const d = await r.json()
          if (d.profile?.status === 'approved') {
            clearInterval(poll)
            router.replace('/')
          }
        } catch(e) {}
      }, 10000)
      return () => clearInterval(poll)
    })
  }, [])

  const signOut = () => supabase.auth.signOut().then(() => router.replace('/'))

  return (
    <div style={{minHeight:'100vh',background:'#09090B',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:28,direction:'rtl',fontFamily:"'Tajawal',sans-serif"}}>
      <div style={{maxWidth:420,width:'100%',textAlign:'center'}}>
        {/* Logo */}
        <div style={{marginBottom:32}}>
          <div style={{fontWeight:900,fontSize:'1.4rem',letterSpacing:1,marginBottom:4}}>
            GYM<span style={{color:'#CBA23B'}}>TRACKER</span> GCC
          </div>
        </div>

        {/* Icon */}
        <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(203,162,59,0.1)',border:'2px solid rgba(203,162,59,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem',margin:'0 auto 24px'}}>
          ⏳
        </div>

        <h1 style={{fontSize:'1.4rem',fontWeight:800,color:'#ECE3CF',marginBottom:10}}>
          طلبك قيد المراجعة
        </h1>
        <p style={{fontSize:'.9rem',color:'#6B5F47',lineHeight:1.7,marginBottom:24}}>
          شكراً لاشتراكك في GYM TRACKER GCC.<br/>
          سيتم مراجعة طلبك والتواصل معك خلال <strong style={{color:'#ECE3CF'}}>24 ساعة</strong> على بريدك الإلكتروني.
        </p>

        {/* Email display */}
        {email && (
          <div style={{background:'rgba(203,162,59,0.08)',border:'1px solid rgba(203,162,59,0.2)',borderRadius:12,padding:'12px 16px',marginBottom:24,fontSize:'.85rem',color:'#CBA23B',fontWeight:600}}>
            {email}
          </div>
        )}

        {/* What happens next */}
        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:16,padding:20,marginBottom:24,textAlign:'right'}}>
          <div style={{fontWeight:700,fontSize:'.85rem',marginBottom:12,color:'#ECE3CF'}}>ماذا يحدث الآن؟</div>
          {[
            ['1', 'سيتحقق فريقنا من طلبك', '#CBA23B'],
            ['2', 'ستصلك رسالة تفعيل على بريدك', '#3b82f6'],
            ['3', 'تدخل وتبدأ برنامجك فوراً 🔥', '#22c55e'],
          ].map(([n, text, color]) => (
            <div key={n} style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:10}}>
              <div style={{width:22,height:22,borderRadius:'50%',background:color+'22',border:`1px solid ${color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.7rem',fontWeight:800,color,flexShrink:0,marginTop:1}}>{n}</div>
              <div style={{fontSize:'.83rem',color:'#6B5F47',lineHeight:1.5}}>{text}</div>
            </div>
          ))}
        </div>

        <p style={{fontSize:'.75rem',color:'#3A3020',marginBottom:20}}>
          هذه الصفحة تتحقق تلقائياً — ستُنقل للتطبيق فور الموافقة
        </p>

        <button onClick={signOut} style={{background:'none',border:'1px solid rgba(255,255,255,0.1)',color:'#6B5F47',borderRadius:10,padding:'10px 20px',fontFamily:"'Tajawal',sans-serif",fontSize:'.82rem',cursor:'pointer'}}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  )
}
