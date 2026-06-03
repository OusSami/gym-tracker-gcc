import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function SuspendedPage() {
  const router = useRouter()
  const signOut = () => supabase.auth.signOut().then(() => router.replace('/'))

  return (
    <div style={{minHeight:'100vh',background:'#09090B',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:28,direction:'rtl',fontFamily:"'Tajawal',sans-serif"}}>
      <div style={{maxWidth:400,width:'100%',textAlign:'center'}}>
        <div style={{fontWeight:900,fontSize:'1.4rem',letterSpacing:1,marginBottom:32}}>
          GYM<span style={{color:'#CBA23B'}}>TRACKER</span> GCC
        </div>
        <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(239,68,68,0.1)',border:'2px solid rgba(239,68,68,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem',margin:'0 auto 24px'}}>🚫</div>
        <h1 style={{fontSize:'1.3rem',fontWeight:800,color:'#ECE3CF',marginBottom:10}}>تم تعليق حسابك</h1>
        <p style={{fontSize:'.88rem',color:'#6B5F47',lineHeight:1.7,marginBottom:28}}>
          حسابك موقوف مؤقتاً.<br/>
          للاستفسار تواصل معنا على:<br/>
          <strong style={{color:'#CBA23B'}}>support@gymtrackergcc.com</strong>
        </p>
        <button onClick={signOut} style={{background:'none',border:'1px solid rgba(255,255,255,0.1)',color:'#6B5F47',borderRadius:10,padding:'10px 20px',fontFamily:"'Tajawal',sans-serif",fontSize:'.82rem',cursor:'pointer'}}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  )
}
