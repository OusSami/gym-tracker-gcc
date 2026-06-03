import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL
const G = '#CBA23B', F = "'Tajawal',sans-serif"
const C = ['#CBA23B','#3b82f6','#22c55e','#a855f7','#ef4444','#06b6d4','#f97316','#ec4899']
const GOAL_AR = {muscle:'بناء عضل',weight:'خفض دهون',strength:'زيادة قوة',endurance:'تحمل',general:'لياقة عامة'}
const ST = {approved:{l:'نشط',c:'#22c55e',b:'rgba(34,197,94,0.12)',br:'rgba(34,197,94,0.3)'},pending:{l:'انتظار',c:'#f97316',b:'rgba(251,146,60,0.12)',br:'rgba(251,146,60,0.3)'},suspended:{l:'موقوف',c:'#ef4444',b:'rgba(239,68,68,0.12)',br:'rgba(239,68,68,0.3)'}}
const card = {background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.1)',borderRadius:16,padding:20}

const Tip = ({active,payload,label}) => active&&payload?.length ? (
  <div style={{background:'#111009',border:'1px solid rgba(203,162,59,0.2)',borderRadius:10,padding:'10px 14px',fontSize:'.78rem',fontFamily:F,direction:'rtl'}}>
    <div style={{color:'rgba(255,255,255,0.4)',marginBottom:5}}>{label}</div>
    {payload.map(p=><div key={p.name} style={{color:p.color,fontWeight:700}}>{p.name}: {typeof p.value==='number'&&p.value<1?p.value.toFixed(4):p.value}</div>)}
  </div>
) : null

const KPI = ({label,value,color=G,sub,onClick}) => (
  <div style={{...card,cursor:onClick?'pointer':'default'}} onClick={onClick}
    onMouseEnter={e=>onClick&&(e.currentTarget.style.borderColor='rgba(203,162,59,0.25)')}
    onMouseLeave={e=>onClick&&(e.currentTarget.style.borderColor='rgba(203,162,59,0.1)')}>
    <div style={{fontSize:'.63rem',fontWeight:700,letterSpacing:2,color:'rgba(255,255,255,0.25)',marginBottom:8,textTransform:'uppercase',fontFamily:F}}>{label}</div>
    <div style={{fontSize:'1.9rem',fontWeight:900,color,lineHeight:1,fontFamily:'monospace'}}>{value??'—'}</div>
    {sub&&<div style={{fontSize:'.7rem',color:'rgba(255,255,255,0.22)',marginTop:5,fontFamily:F}}>{sub}</div>}
  </div>
)

export default function Admin() {
  const router = useRouter()
  const [authed,setAuthed] = useState(false)
  const [tab,setTab] = useState('overview')
  const [loading,setLoading] = useState(true)
  const [data,setData] = useState(null)
  const [search,setSearch] = useState('')
  const [stFilter,setStFilter] = useState('all')
  const [busy,setBusy] = useState(null)

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(!session?.user||session.user.email!==ADMIN_EMAIL){router.replace('/');return}
      setAuthed(true); load()
    })
  },[])

  const load = async()=>{
    setLoading(true)
    try {
      const [u,c,s,g] = await Promise.all([
        fetch('/api/admin?action=users').then(r=>r.json()),
        fetch('/api/admin?action=costs').then(r=>r.json()),
        fetch('/api/admin?action=stats').then(r=>r.json()),
        fetch('/api/admin?action=charts').then(r=>r.json()),
      ])
      setData({users:u.users||[],costs:c,stats:s,charts:g})
    }catch(e){console.error(e)}
    setLoading(false)
  }

  const approve = async(id)=>{setBusy(id+'a');await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'approve',userId:id})});await load();setBusy(null)}
  const suspend = async(id)=>{if(!confirm('إيقاف؟'))return;setBusy(id+'s');await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'suspend',userId:id})});await load();setBusy(null)}

  const users = (data?.users||[]).filter(u=>
    (stFilter==='all'||u.status===stFilter)&&
    (!search||u.email?.toLowerCase().includes(search.toLowerCase())||u.full_name?.toLowerCase().includes(search.toLowerCase()))
  )

  if(!authed) return null

  const TABS = [['overview','📊 نظرة عامة'],['users','👥 المستخدمون'],['costs','💰 تكاليف API'],['analytics','📈 تحليلات']]

  return (
    <div style={{minHeight:'100vh',background:'#09090B',color:'#ECE3CF',fontFamily:F,direction:'rtl'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} body{margin:0}`}</style>

      {/* TOP BAR */}
      <div style={{background:'rgba(0,0,0,0.8)',backdropFilter:'blur(16px)',borderBottom:'1px solid rgba(203,162,59,0.1)',padding:'12px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{fontWeight:900,fontSize:'1rem',letterSpacing:.5}}>GYM<span style={{color:G}}>TRACKER</span> <span style={{fontSize:'.72rem',color:'rgba(255,255,255,0.25)',fontWeight:400}}>لوحة التحكم</span></div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={load} style={{background:'rgba(203,162,59,0.1)',border:'1px solid rgba(203,162,59,0.2)',color:G,padding:'7px 14px',borderRadius:9,cursor:'pointer',fontSize:'.78rem',fontFamily:F}}>↺ تحديث</button>
          <button onClick={()=>router.push('/')} style={{background:'none',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.35)',padding:'7px 14px',borderRadius:9,cursor:'pointer',fontSize:'.78rem',fontFamily:F}}>← التطبيق</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{borderBottom:'1px solid rgba(255,255,255,0.05)',padding:'0 24px',display:'flex',gap:0}}>
        {TABS.map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{background:'none',border:'none',borderBottom:tab===id?`2px solid ${G}`:'2px solid transparent',color:tab===id?G:'rgba(255,255,255,0.38)',padding:'13px 18px',cursor:'pointer',fontFamily:F,fontWeight:700,fontSize:'.83rem',transition:'all .15s',marginBottom:-1,whiteSpace:'nowrap'}}>
            {lbl}
          </button>
        ))}
      </div>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'26px 20px'}}>
        {loading?(
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:80,gap:14,color:'rgba(255,255,255,0.25)',fontFamily:F}}>
            <div style={{width:26,height:26,border:'3px solid rgba(203,162,59,0.15)',borderTopColor:G,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
            جاري تحميل البيانات...
          </div>
        ):data&&(
          <>
            {/* ═══ OVERVIEW ═══ */}
            {tab==='overview'&&(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:24}}>
                  <KPI label="إجمالي المستخدمين" value={data.stats?.total_users} color="#ECE3CF"/>
                  <KPI label="نشطون اليوم" value={data.stats?.active_today} color="#3b82f6"/>
                  <KPI label="نشطون هذا الأسبوع" value={data.stats?.active_week} color="#a855f7"/>
                  <KPI label="بانتظار الموافقة" value={data.stats?.pending} color="#f97316" onClick={()=>{setTab('users');setStFilter('pending')}}/>
                  <KPI label="تكلفة اليوم" value={'$'+(data.costs?.today||'0.0000')} color="#22c55e"/>
                  <KPI label="تكلفة الشهر" value={'$'+(data.costs?.month||'0.0000')} color="#ef4444"/>
                  <KPI label="إجمالي التمارين" value={data.stats?.total_sessions}/>
                  <KPI label="جدد هذا الشهر" value={data.stats?.new_this_month} color="#06b6d4"/>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  <div style={card}>
                    <div style={{fontWeight:700,fontSize:'.83rem',marginBottom:14,color:'rgba(255,255,255,0.7)'}}>التمارين اليومية — آخر 30 يوم</div>
                    <ResponsiveContainer width="100%" height={190}>
                      <AreaChart data={data.charts?.dailySessions||[]} margin={{top:5,right:0,bottom:0,left:-25}}>
                        <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={G} stopOpacity={0.3}/><stop offset="95%" stopColor={G} stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                        <XAxis dataKey="date" tick={{fontSize:9,fill:'rgba(255,255,255,0.3)',fontFamily:F}} tickLine={false} axisLine={false}/>
                        <YAxis tick={{fontSize:9,fill:'rgba(255,255,255,0.3)'}} tickLine={false} axisLine={false}/>
                        <Tooltip content={<Tip/>}/>
                        <Area type="monotone" dataKey="count" name="تمارين" stroke={G} strokeWidth={2} fill="url(#sg)"/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={card}>
                    <div style={{fontWeight:700,fontSize:'.83rem',marginBottom:14,color:'rgba(255,255,255,0.7)'}}>المستخدمون الجدد — آخر 30 يوم</div>
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={data.charts?.newUsers||[]} margin={{top:5,right:0,bottom:0,left:-25}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                        <XAxis dataKey="date" tick={{fontSize:9,fill:'rgba(255,255,255,0.3)',fontFamily:F}} tickLine={false} axisLine={false}/>
                        <YAxis tick={{fontSize:9,fill:'rgba(255,255,255,0.3)'}} tickLine={false} axisLine={false}/>
                        <Tooltip content={<Tip/>}/>
                        <Bar dataKey="count" name="مستخدمون" fill="#3b82f6" radius={[3,3,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:14}}>
                  <div style={card}>
                    <div style={{fontWeight:700,fontSize:'.83rem',marginBottom:14,color:'rgba(255,255,255,0.7)'}}>تكلفة API اليومية — آخر 30 يوم ($)</div>
                    <ResponsiveContainer width="100%" height={190}>
                      <AreaChart data={data.charts?.dailyCost||[]} margin={{top:5,right:0,bottom:0,left:-10}}>
                        <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                        <XAxis dataKey="date" tick={{fontSize:9,fill:'rgba(255,255,255,0.3)',fontFamily:F}} tickLine={false} axisLine={false}/>
                        <YAxis tick={{fontSize:9,fill:'rgba(255,255,255,0.3)'}} tickLine={false} axisLine={false}/>
                        <Tooltip content={<Tip/>}/>
                        <Area type="monotone" dataKey="cost" name="$ التكلفة" stroke="#22c55e" strokeWidth={2} fill="url(#cg)"/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={card}>
                    <div style={{fontWeight:700,fontSize:'.83rem',marginBottom:14,color:'rgba(255,255,255,0.7)'}}>توزيع المستخدمين</div>
                    <ResponsiveContainer width="100%" height={190}>
                      <PieChart>
                        <Pie data={[{name:'نشط',value:data.stats?.approved||0},{name:'انتظار',value:data.stats?.pending||0},{name:'موقوف',value:data.stats?.suspended||0}]}
                          cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="value">
                          {['#22c55e','#f97316','#ef4444'].map((c,i)=><Cell key={i} fill={c} fillOpacity={0.85}/>)}
                        </Pie>
                        <Tooltip content={<Tip/>}/>
                        <Legend iconType="circle" iconSize={7} formatter={v=><span style={{fontSize:'.72rem',color:'rgba(255,255,255,0.45)',fontFamily:F}}>{v}</span>}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ USERS ═══ */}
            {tab==='users'&&(
              <div>
                <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو الإيميل..."
                    style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(203,162,59,0.15)',color:'#ECE3CF',padding:'9px 14px',borderRadius:10,outline:'none',flex:1,minWidth:200,fontFamily:F,direction:'rtl',fontSize:'.85rem'}}/>
                  {['all','approved','pending','suspended'].map(s=>(
                    <button key={s} onClick={()=>setStFilter(s)} style={{background:stFilter===s?'rgba(203,162,59,0.12)':'rgba(255,255,255,0.03)',border:`1px solid ${stFilter===s?'rgba(203,162,59,0.3)':'rgba(255,255,255,0.08)'}`,color:stFilter===s?G:'rgba(255,255,255,0.4)',padding:'9px 14px',borderRadius:10,cursor:'pointer',fontFamily:F,fontSize:'.78rem',fontWeight:600}}>
                      {{all:'الكل',approved:`نشط (${(data.users||[]).filter(u=>u.status==='approved').length})`,pending:`انتظار (${(data.users||[]).filter(u=>u.status==='pending').length})`,suspended:`موقوف (${(data.users||[]).filter(u=>u.status==='suspended').length})`}[s]}
                    </button>
                  ))}
                  <div style={{fontSize:'.75rem',color:'rgba(255,255,255,0.25)',fontFamily:F,marginRight:'auto'}}>{users.length} نتيجة</div>
                </div>

                <div style={{background:'rgba(0,0,0,0.3)',borderRadius:16,border:'1px solid rgba(255,255,255,0.05)',overflow:'hidden'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr 80px 70px 90px 80px 150px',gap:8,padding:'11px 16px',borderBottom:'1px solid rgba(255,255,255,0.05)',fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'rgba(255,255,255,0.22)',textTransform:'uppercase',fontFamily:F}}>
                    <span>المستخدم</span><span>الهدف / المستوى</span><span style={{textAlign:'center'}}>الحالة</span><span style={{textAlign:'center'}}>تمارين</span><span style={{textAlign:'center'}}>آخر دخول</span><span style={{textAlign:'center'}}>التكلفة</span><span style={{textAlign:'center'}}>إجراء</span>
                  </div>
                  {users.length===0?<div style={{padding:40,textAlign:'center',color:'rgba(255,255,255,0.2)',fontFamily:F}}>لا نتائج</div>:
                  users.map(u=>{
                    const st=ST[u.status]||{l:u.status,c:'#888',b:'rgba(255,255,255,0.05)',br:'rgba(255,255,255,0.1)'}
                    return (
                      <div key={u.id} style={{display:'grid',gridTemplateColumns:'1.5fr 1fr 80px 70px 90px 80px 150px',gap:8,padding:'13px 16px',borderBottom:'1px solid rgba(255,255,255,0.03)',alignItems:'center',transition:'background .1s'}}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.014)'}
                        onMouseLeave={e=>e.currentTarget.style.background='none'}>
                        <div style={{cursor:'pointer'}} onClick={()=>router.push(`/admin/user/${u.id}`)}>
                          <div style={{fontWeight:700,fontSize:'.87rem',marginBottom:2}}>{u.full_name||'بدون اسم'}</div>
                          <div style={{fontSize:'.7rem',color:'rgba(255,255,255,0.28)'}}>{u.email}</div>
                          <div style={{fontSize:'.65rem',color:'rgba(255,255,255,0.18)',marginTop:2}}>{new Date(u.created_at).toLocaleDateString('ar-SA')}</div>
                        </div>
                        <div style={{fontSize:'.78rem',color:'rgba(255,255,255,0.4)',fontFamily:F}}>
                          <div>{GOAL_AR[u.goal]||'—'}</div>
                          <div style={{fontSize:'.7rem',marginTop:2,color:'rgba(255,255,255,0.25)'}}>{u.fitness_level||'—'}</div>
                        </div>
                        <div style={{textAlign:'center'}}>
                          <span style={{background:st.b,color:st.c,border:`1px solid ${st.br}`,padding:'3px 9px',borderRadius:20,fontSize:'.67rem',fontWeight:700,fontFamily:F,whiteSpace:'nowrap'}}>{st.l}</span>
                        </div>
                        <div style={{textAlign:'center',fontSize:'.82rem',color:'rgba(255,255,255,0.5)'}}>{u.session_count||0}</div>
                        <div style={{textAlign:'center',fontSize:'.73rem',color:'rgba(255,255,255,0.32)',fontFamily:F}}>
                          {u.last_active?new Date(u.last_active).toLocaleDateString('ar-SA',{month:'short',day:'numeric'}):'—'}
                        </div>
                        <div style={{textAlign:'center',fontSize:'.78rem',color:'#22c55e',fontFamily:'monospace'}}>${u.monthly_cost||'0.00'}</div>
                        <div style={{display:'flex',gap:5,justifyContent:'center',flexWrap:'wrap'}}>
                          <button onClick={()=>router.push(`/admin/user/${u.id}`)} style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.25)',color:'#3b82f6',padding:'5px 10px',borderRadius:7,cursor:'pointer',fontSize:'.7rem',fontFamily:F}}>ملف كامل</button>
                          {u.status!=='approved'&&<button onClick={()=>approve(u.id)} disabled={busy===u.id+'a'} style={{background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.25)',color:'#22c55e',padding:'5px 10px',borderRadius:7,cursor:'pointer',fontSize:'.7rem',fontFamily:F}}>{busy===u.id+'a'?'...':'✓ قبول'}</button>}
                          {u.status!=='suspended'&&<button onClick={()=>suspend(u.id)} disabled={busy===u.id+'s'} style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#ef4444',padding:'5px 10px',borderRadius:7,cursor:'pointer',fontSize:'.7rem',fontFamily:F}}>{busy===u.id+'s'?'...':'✕ إيقاف'}</button>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ═══ COSTS ═══ */}
            {tab==='costs'&&(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
                  <KPI label="اليوم" value={'$'+(data.costs?.today||0)} color="#22c55e" sub="24 ساعة الماضية"/>
                  <KPI label="هذا الأسبوع" value={'$'+(data.costs?.week||0)} color={G}/>
                  <KPI label="هذا الشهر" value={'$'+(data.costs?.month||0)} color="#a855f7"/>
                  <KPI label="متوسط/مستخدم/يوم" value={'$'+(data.costs?.avg_per_user||'0.0000')} color="#3b82f6"/>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  <div style={card}>
                    <div style={{fontWeight:700,fontSize:'.83rem',marginBottom:14,color:'rgba(255,255,255,0.7)'}}>التكلفة حسب الخدمة (هذا الشهر)</div>
                    <ResponsiveContainer width="100%" height={230}>
                      <PieChart>
                        <Pie data={(data.costs?.by_endpoint||[]).map(e=>({name:e.endpoint,value:parseFloat(e.total_cost)||0}))}
                          cx="50%" cy="50%" outerRadius={90} dataKey="value"
                          label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={{stroke:'rgba(255,255,255,0.2)'}}>
                          {(data.costs?.by_endpoint||[]).map((_,i)=><Cell key={i} fill={C[i%C.length]} fillOpacity={0.85}/>)}
                        </Pie>
                        <Tooltip content={<Tip/>}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={card}>
                    <div style={{fontWeight:700,fontSize:'.83rem',marginBottom:14,color:'rgba(255,255,255,0.7)'}}>أعلى استهلاكاً (هذا الشهر)</div>
                    <div style={{maxHeight:230,overflowY:'auto'}}>
                      {(data.costs?.top_users||[]).map((u,i)=>(
                        <div key={u.user_id} onClick={()=>router.push(`/admin/user/${u.user_id}`)}
                          style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 12px',borderRadius:10,marginBottom:4,background:'rgba(255,255,255,0.02)',cursor:'pointer',transition:'background .1s'}}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}
                          onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}>
                          <div style={{display:'flex',gap:10,alignItems:'center'}}>
                            <div style={{width:22,height:22,borderRadius:'50%',background:C[i%C.length]+'22',border:`1px solid ${C[i%C.length]}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.7rem',fontWeight:800,color:C[i%C.length],flexShrink:0}}>{i+1}</div>
                            <div>
                              <div style={{fontSize:'.8rem',fontWeight:600}}>{u.email||u.user_id?.slice(0,8)}</div>
                              <div style={{fontSize:'.67rem',color:'rgba(255,255,255,0.28)',fontFamily:F}}>{u.calls} مكالمة</div>
                            </div>
                          </div>
                          <div style={{fontFamily:'monospace',fontWeight:700,color:'#22c55e',fontSize:'.83rem'}}>${u.total_cost}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={card}>
                  <div style={{fontWeight:700,fontSize:'.83rem',marginBottom:14,color:'rgba(255,255,255,0.7)'}}>تكلفة API يومياً حسب الخدمة (آخر 30 يوم)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data.charts?.dailyCostByEndpoint||[]} margin={{top:5,right:5,bottom:0,left:-10}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                      <XAxis dataKey="date" tick={{fontSize:9,fill:'rgba(255,255,255,0.3)',fontFamily:F}} tickLine={false} axisLine={false}/>
                      <YAxis tick={{fontSize:9,fill:'rgba(255,255,255,0.3)'}} tickLine={false} axisLine={false}/>
                      <Tooltip content={<Tip/>}/>
                      <Legend iconType="circle" iconSize={7} formatter={v=><span style={{fontSize:'.7rem',color:'rgba(255,255,255,0.45)',fontFamily:F}}>{v}</span>}/>
                      {['analyze','report','coach','meal','body','weekly'].map((ep,i)=>(
                        <Area key={ep} type="monotone" dataKey={ep} name={ep} stackId="1" stroke={C[i]} fill={C[i]} fillOpacity={0.65} strokeWidth={1}/>
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ═══ ANALYTICS ═══ */}
            {tab==='analytics'&&(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  <div style={card}>
                    <div style={{fontWeight:700,fontSize:'.83rem',marginBottom:14,color:'rgba(255,255,255,0.7)'}}>توزيع الأهداف</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={data.charts?.goalsDist||[]} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="count">
                          {(data.charts?.goalsDist||[]).map((_,i)=><Cell key={i} fill={C[i%C.length]} fillOpacity={0.85}/>)}
                        </Pie>
                        <Tooltip content={<Tip/>}/>
                        <Legend iconType="circle" iconSize={7} formatter={v=><span style={{fontSize:'.72rem',color:'rgba(255,255,255,0.45)',fontFamily:F}}>{v}</span>}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={card}>
                    <div style={{fontWeight:700,fontSize:'.83rem',marginBottom:14,color:'rgba(255,255,255,0.7)'}}>توزيع المستويات</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.charts?.levelsDist||[]} margin={{top:5,right:5,bottom:0,left:-20}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                        <XAxis dataKey="level" tick={{fontSize:10,fill:'rgba(255,255,255,0.4)',fontFamily:F}} tickLine={false} axisLine={false}/>
                        <YAxis tick={{fontSize:9,fill:'rgba(255,255,255,0.3)'}} tickLine={false} axisLine={false}/>
                        <Tooltip content={<Tip/>}/>
                        <Bar dataKey="count" name="مستخدمون" fill={G} radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={card}>
                  <div style={{fontWeight:700,fontSize:'.83rem',marginBottom:14,color:'rgba(255,255,255,0.7)'}}>التمارين حسب يوم الأسبوع</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.charts?.sessionsByDay||[]} margin={{top:5,right:5,bottom:0,left:-20}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                      <XAxis dataKey="day" tick={{fontSize:11,fill:'rgba(255,255,255,0.4)',fontFamily:F}} tickLine={false} axisLine={false}/>
                      <YAxis tick={{fontSize:9,fill:'rgba(255,255,255,0.3)'}} tickLine={false} axisLine={false}/>
                      <Tooltip content={<Tip/>}/>
                      <Bar dataKey="count" name="تمارين" radius={[4,4,0,0]}>
                        {(data.charts?.sessionsByDay||[]).map((_,i)=><Cell key={i} fill={C[i%C.length]} fillOpacity={0.8}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
