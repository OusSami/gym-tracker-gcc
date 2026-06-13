import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { TopNav, BottomTabs } from '../components/Nav'
import { supabase } from '../lib/supabase'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

const fmtDate = d => { try { return new Date((d||'')+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) } catch(e) { return d||'' } }

const Tip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null
  return <div style={{background:'var(--card)',border:'1px solid rgba(0,0,0,0.10)',borderRadius:8,padding:'8px 12px',fontSize:12,color:'var(--text-primary)'}}><div style={{color:'var(--text-secondary)',marginBottom:4,fontSize:11}}>{label}</div>{payload.map((p,i)=><div key={i} style={{color:p.color||'#111111'}}>{p.name}: <b>{p.value}</b></div>)}</div>
}

const ScoreRing = ({ value, label, color, size=80 }) => {
  const r = (size-10)/2, circ = 2*Math.PI*r, pct = Math.min(100,Math.max(0,value||0))
  return (
    <div style={{textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth={8}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${(pct/100)*circ} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:'stroke-dasharray .8s ease'}}/>
        <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={size*0.22} fontFamily="'Bebas Neue','Noto Kufi Arabic',sans-serif">{Math.round(pct)}</text>
      </svg>
      <div style={{fontSize:'.65rem',color:'var(--text-secondary)',letterSpacing:.5,fontWeight:600}}>{label}</div>
    </div>
  )
}

const Bar = ({ value, max=10, color, label }) => (
  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
    <div style={{width:80,fontSize:'.78rem',color:'var(--text-secondary)',flexShrink:0}}>{label}</div>
    <div style={{flex:1,height:8,background:'rgba(0,0,0,0.08)',borderRadius:4,overflow:'hidden'}}>
      <div style={{height:'100%',width:`${(value/max)*100}%`,background:color,borderRadius:4,transition:'width .8s ease'}}/>
    </div>
    <div style={{fontSize:'.78rem',color:color,minWidth:24,textAlign:'right',fontWeight:700}}>{value}/{max}</div>
  </div>
)

export default function BodyAnalysis() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [frontB64, setFrontB64] = useState(null)
  const [frontMime, setFrontMime] = useState('image/jpeg')
  const [frontPreview, setFrontPreview] = useState(null)
  const [backB64, setBackB64] = useState(null)
  const [backMime, setBackMime] = useState('image/jpeg')
  const [backPreview, setBackPreview] = useState(null)
  const [analysisDate, setAnalysisDate] = useState(new Date().toISOString().split('T')[0])
  const [selected, setSelected] = useState(null)
  const [hiddenPhotos, setHiddenPhotos] = useState({}) // analysisId -> bool
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('upload')
  const frontRef = useRef(null)
  const backRef = useRef(null)

  const loadData = async (uid) => {
    const [pr, ar] = await Promise.all([
      fetch(`/api/profile?userId=${uid}`).then(r=>r.json()),
      fetch(`/api/body?userId=${uid}`).then(r=>r.json())
    ])
    setProfile(pr.profile||null)
    const list = ar.analyses||[]
    setAnalyses(list)
    if (list.length && !selected) setSelected(list[0])
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data:{session} }) => {
      if (!session?.user) { router.push('/'); return }
      setUser(session.user)
      await loadData(session.user.id)
      setLoading(false)
    })
  }, [])

  const loadImg = (file, side) => {
    if (!file?.type.startsWith('image/')) { setErr('Please upload an image file.'); return }
    setErr('')
    const mime = file.type||'image/jpeg'
    const r = new FileReader()
    r.onload = e => {
      const d = e.target.result
      const b64 = d.split(',')[1]
      if (side === 'front') { setFrontPreview(d); setFrontB64(b64); setFrontMime(mime) }
      else { setBackPreview(d); setBackB64(b64); setBackMime(mime) }
    }
    r.readAsDataURL(file)
  }

  const analyze = async () => {
    if (!frontB64) { setErr('Please upload at least a front photo.'); return }
    setAnalyzing(true); setErr('')
    try {
      const age = profile?.birthday ? Math.floor((Date.now()-new Date(profile.birthday).getTime())/(365.25*86400000)) : null
      const r = await fetch('/api/body', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          userId: user.id,
          imageBase64: frontB64, imageMime: frontMime,
          backImageBase64: backB64||null, backImageMime: backMime,
          analysisDate,
          userProfile: { age, weight_kg: profile?.weight_kg, height_cm: profile?.height_cm, fitness_level: profile?.fitness_level, goal: profile?.goal }
        })
      })
      const d = await r.json()
      if (!r.ok||d.error) { setErr(d.error||'Analysis failed'); setAnalyzing(false); return }
      await loadData(user.id)
      setSelected(d.analysis)
      setTab('history')
      setFrontB64(null); setFrontPreview(null); setBackB64(null); setBackPreview(null)
    } catch(e) { setErr('Connection error: '+e.message) }
    setAnalyzing(false)
  }

  const deleteAnalysis = async (id) => {
    if (!confirm('Delete this analysis?')) return
    await fetch('/api/body', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id, userId:user.id}) })
    await loadData(user.id)
    setSelected(analyses.find(a=>a.id!==id)||null)
  }

  // History chart data
  const historyData = analyses.slice().reverse().map(a=>({
    date: fmtDate(a.analyzed_at),
    'Overall': a.overall_score,
    'Definition': a.muscle_definition,
    'Symmetry': a.symmetry_score,
    'Body fat%': a.body_fat_estimate,
  }))

  const radarData = selected ? [
    { muscle:'الصدر', value: selected.chest_dev },
    { muscle:'الظهر', value: selected.back_dev },
    { muscle:'الأكتاف', value: selected.shoulders_dev },
    { muscle:'الأذرع', value: selected.arms_dev },
    { muscle:'البطن', value: selected.core_dev },
    { muscle:'الأرجل', value: selected.legs_dev },
  ] : []

  const MG_COLORS = { Chest:'#ef4444',Back:'#3b82f6',Shoulders:'#a855f7',Arms:'#f97316',Core:'#eab308',Legs:'#22c55e' }

  if (loading) return <Loader/>

  return (
    <div style={{minHeight:'100vh',background:'var(--surface)',color:'var(--text-primary)',fontFamily:"'DM Sans','Tajawal',sans-serif",maxWidth:700,margin:'0 auto',padding:'0 0 80px'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .bb{font-family:'Bebas Neue','Noto Kufi Arabic',sans-serif;letter-spacing:2px}
        .card{background:var(--card);border:1px solid rgba(0,0,0,0.08);border-radius:14px;padding:18px}
        .card-sm{background:var(--card);border:1px solid rgba(0,0,0,0.08);border-radius:10px;padding:14px}
        .btn{display:block;width:100%;padding:15px;border:none;border-radius:9999px;font-family:'Bebas Neue','Noto Kufi Arabic',sans-serif;font-size:1.1rem;letter-spacing:2px;cursor:pointer;transition:all .15s;text-align:center}
        .btn-y{background:#111111;color:#FFFFFF}.btn-y:hover:not(:disabled){background:#333333}.btn-y:disabled{opacity:.35;cursor:not-allowed}
        .btn-sm{background:var(--card);border:1px solid rgba(0,0,0,0.10);color:var(--text-secondary);font-family:'DM Sans','Tajawal',sans-serif;font-size:.75rem;padding:7px 13px;border-radius:8px;cursor:pointer}.btn-sm:hover{border-color:rgba(0,0,0,0.25);color:var(--text-primary)}
        .tab{background:transparent;border:none;border-bottom:2px solid transparent;color:var(--text-secondary);font-family:'DM Sans','Tajawal',sans-serif;font-size:.9rem;padding:10px 16px;cursor:pointer;transition:all .15s;font-weight:500}
        .tab.on{color:var(--text-primary);border-bottom-color:var(--text-primary)}
        input[type=file]{display:none}
        ::placeholder{color:rgba(0,0,0,0.25)}
      `}</style>

      {/* IMG-PLACEHOLDER: body-hero · 16:9 · body analysis hero */}
      <div className="img-placeholder" style={{width:'100%',aspectRatio:'16/9',borderRadius:'0 0 24px 24px'}}/>

      {/* Header */}
      <div className="screen-header">
        <button onClick={()=>router.push('/')} style={{background:'none',border:'none',color:'var(--text-secondary)',cursor:'pointer',fontSize:'1.2rem',padding:'0 0 8px',display:'block'}}>←</button>
        <div className="screen-title">تحليل جسمك</div>
        <div className="screen-sub">AI-powered physique analysis · Track your transformation</div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:'1px solid rgba(0,0,0,0.08)',padding:'0 20px',marginBottom:20}}>
        <button className={`tab${tab==='upload'?' on':''}`} onClick={()=>setTab('upload')}>📷 New Analysis</button>
        <button className={`tab${tab==='history'?' on':''}`} onClick={()=>setTab('history')}>📊 سجل التحليلات {analyses.length>0&&`(${analyses.length})`}</button>
      </div>

      <div style={{padding:'0 20px'}}>

        {/* ── UPLOAD TAB ── */}
        {tab === 'upload' && (
          <div className="up">
            {/* How it works */}
            <div style={{background:'var(--card)',border:'1px solid rgba(0,0,0,0.08)',borderRadius:12,padding:'14px 16px',marginBottom:16}}>
              <div className="bb" style={{fontSize:'.72rem',color:'var(--text-secondary)',letterSpacing:2,marginBottom:6}}>كيف يعمل</div>
              <div style={{color:'var(--text-secondary)',fontSize:'.82rem',lineHeight:1.7}}>
                Upload front and/or back photos. AI analyzes muscle development, body composition, symmetry and gives you a personalised improvement plan.
                <br/><span style={{color:'var(--text-secondary)',fontSize:'.78rem'}}>💡 Good lighting · neutral pose · minimal clothing for best results.</span>
              </div>
            </div>

            {/* Date picker */}
            <div style={{marginBottom:14}}>
              <div style={{color:'var(--text-secondary)',fontSize:'.75rem',fontWeight:600,marginBottom:6}}>تاريخ الصورة</div>
              <input type="date" value={analysisDate} max={new Date().toISOString().split('T')[0]}
                onChange={e=>setAnalysisDate(e.target.value)}
                style={{background:'rgba(0,0,0,0.04)',border:'1px solid rgba(0,0,0,0.10)',color:'var(--text-primary)',padding:'11px 14px',borderRadius:10,outline:'none',width:'100%',fontSize:'.9rem'}}/>
              {analysisDate !== new Date().toISOString().split('T')[0] &&
                <div style={{color:'#eab308',fontSize:'.75rem',marginTop:6}}>📅 Using past date — great for tracking old photos</div>}
            </div>

            {/* Front photo */}
            <div style={{marginBottom:12}}>
              <div style={{color:'var(--text-secondary)',fontSize:'.75rem',fontWeight:600,marginBottom:6}}>FRONT PHOTO <span style={{color:'var(--text-primary)'}}>*</span></div>
              <div onClick={()=>frontRef.current?.click()}
                style={{border:`2px dashed ${frontPreview?'rgba(0,0,0,0.10)':'rgba(0,0,0,0.12)'}`,borderRadius:12,overflow:'hidden',cursor:'pointer',minHeight:frontPreview?0:130,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.03)',transition:'all .2s',marginBottom:6}}>
                {frontPreview ? (
                  <img src={frontPreview} alt="Front" style={{width:'100%',maxHeight:260,objectFit:'contain',display:'block'}}/>
                ) : (
                  <div style={{textAlign:'center',padding:'24px 20px'}}>
                    <div style={{fontSize:'2rem',marginBottom:6}}>🧍</div>
                    <div className="bb" style={{color:'var(--text-secondary)',fontSize:'.9rem',letterSpacing:2}}>الصورة الأمامية</div>
                    <div style={{color:'var(--text-secondary)',fontSize:'.72rem',marginTop:4}}>أمامياً · وجهك للكاميرا · يداك جانبك</div>
                  </div>
                )}
              </div>
              <input ref={frontRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>loadImg(e.target.files[0],'front')}/>
              <div style={{display:'flex',gap:6}}>
                <button className="btn-sm" style={{flex:1}} onClick={()=>{frontRef.current.removeAttribute('capture');frontRef.current.click()}}>🖼 Gallery</button>
                <button className="btn-sm" style={{flex:1}} onClick={()=>{frontRef.current.setAttribute('capture','user');frontRef.current.click()}}>🤳 Camera</button>
                {frontPreview && <button className="btn-sm" style={{color:'#ef4444',borderColor:'rgba(239,68,68,0.25)'}} onClick={()=>{setFrontB64(null);setFrontPreview(null)}}>✕</button>}
              </div>
            </div>

            {/* Back photo */}
            <div style={{marginBottom:16}}>
              <div style={{color:'var(--text-secondary)',fontSize:'.75rem',fontWeight:600,marginBottom:6}}>BACK PHOTO <span style={{color:'var(--text-secondary)',fontSize:'.7rem'}}>(optional but recommended)</span></div>
              <div onClick={()=>backRef.current?.click()}
                style={{border:`2px dashed ${backPreview?'rgba(0,0,0,0.10)':'rgba(0,0,0,0.08)'}`,borderRadius:12,overflow:'hidden',cursor:'pointer',minHeight:backPreview?0:100,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.03)',transition:'all .2s',marginBottom:6}}>
                {backPreview ? (
                  <img src={backPreview} alt="Back" style={{width:'100%',maxHeight:220,objectFit:'contain',display:'block'}}/>
                ) : (
                  <div style={{textAlign:'center',padding:'20px'}}>
                    <div style={{fontSize:'1.8rem',marginBottom:5}}>🔙</div>
                    <div className="bb" style={{color:'var(--text-secondary)',fontSize:'.85rem',letterSpacing:2}}>الصورة الخلفية</div>
                    <div style={{color:'var(--text-secondary)',fontSize:'.72rem',marginTop:3}}>تكشف الظهر والعريضة والأرداف</div>
                  </div>
                )}
              </div>
              <input ref={backRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>loadImg(e.target.files[0],'back')}/>
              <div style={{display:'flex',gap:6}}>
                <button className="btn-sm" style={{flex:1}} onClick={()=>{backRef.current.removeAttribute('capture');backRef.current.click()}}>🖼 Gallery</button>
                <button className="btn-sm" style={{flex:1}} onClick={()=>{backRef.current.setAttribute('capture','user');backRef.current.click()}}>🤳 Camera</button>
                {backPreview && <button className="btn-sm" style={{color:'#ef4444',borderColor:'rgba(239,68,68,0.25)'}} onClick={()=>{setBackB64(null);setBackPreview(null)}}>✕</button>}
              </div>
            </div>

            {err && <div style={{color:'#fca5a5',fontSize:'.85rem',marginBottom:12,padding:'12px 16px',background:'rgba(239,68,68,.1)',borderRadius:10,border:'1px solid rgba(239,68,68,.25)'}}>{err}</div>}

            {analyzing ? (
              <div style={{textAlign:'center',padding:'30px'}}>
                <div style={{width:48,height:48,border:'3px solid rgba(0,0,0,0.08)',borderTopColor:'#111111',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 16px'}}/>
                <div className="bb" style={{color:'var(--text-primary)',fontSize:'1.4rem',letterSpacing:3}}>ANALYZING…</div>
                <div style={{color:'var(--text-secondary)',fontSize:'.82rem',marginTop:6}}>جاري تحليل جسمك — يستغرق أقل من 30 ثانية</div>
              </div>
            ) : (
              <button className="btn btn-y" onClick={analyze} disabled={!frontB64}>تحليل الجسم</button>
            )}

            {analyses.length > 0 && (
              <div style={{textAlign:'center',marginTop:14}}>
                <button onClick={()=>setTab('history')} style={{background:'none',border:'none',color:'var(--text-secondary)',cursor:'pointer',fontSize:'.8rem',textDecoration:'underline'}}>View {analyses.length} previous analysis{analyses.length>1?'es':''}</button>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div>
            {analyses.length === 0 ? (
              <div style={{textAlign:'center',padding:'60px 20px',color:'var(--text-secondary)'}}>
                <div style={{fontSize:'3rem',marginBottom:12}}>📊</div>
                <div className="bb" style={{fontSize:'1.3rem',letterSpacing:2}}>NO ANALYSES YET</div>
                <div style={{fontSize:'.88rem',marginTop:8,marginBottom:20}}>Upload your first photo to get started.</div>
                <button className="btn btn-y" style={{maxWidth:200,margin:'0 auto'}} onClick={()=>setTab('upload')}>UPLOAD PHOTO ←</button>
              </div>
            ) : (
              <>
                {/* Progress charts if 2+ analyses */}
                {analyses.length >= 2 && (
                  <div className="card" style={{marginBottom:16}}>
                    <div className="bb" style={{fontSize:'.85rem',color:'var(--text-primary)',letterSpacing:2,marginBottom:14}}>تطور جسمك</div>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={historyData} margin={{top:5,right:5,bottom:0,left:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)"/>
                        <XAxis dataKey="date" tick={{fill:'var(--text-secondary)',fontSize:10}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fill:'var(--text-secondary)',fontSize:10}} axisLine={false} tickLine={false} width={30} domain={[0,100]}/>
                        <Tooltip content={<Tip/>}/>
                        <Line type="monotone" dataKey="Overall" stroke="#111111" strokeWidth={2.5} dot={{fill:'#111111',r:4,strokeWidth:0}}/>
                        <Line type="monotone" dataKey="Definition" stroke="#3b82f6" strokeWidth={2} dot={{fill:'#3b82f6',r:3,strokeWidth:0}}/>
                        <Line type="monotone" dataKey="Symmetry" stroke="#22c55e" strokeWidth={2} dot={{fill:'#22c55e',r:3,strokeWidth:0}}/>
                      </LineChart>
                    </ResponsiveContainer>
                    <div style={{display:'flex',gap:14,justifyContent:'center',marginTop:10}}>
                      {[['Overall','#111111'],['Definition','#3b82f6'],['Symmetry','#22c55e']].map(([l,c])=>(
                        <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:'.72rem',color:'var(--text-secondary)'}}>
                          <div style={{width:8,height:8,borderRadius:'50%',background:c}}/>
                          {l}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Analysis selector */}
                {analyses.length > 1 && (
                  <div style={{display:'flex',gap:8,marginBottom:14,overflowX:'auto',paddingBottom:4}}>
                    {analyses.map((a,i)=>(
                      <button key={a.id} onClick={()=>setSelected(a)}
                        style={{flexShrink:0,padding:'6px 12px',background:selected?.id===a.id?'rgba(0,0,0,0.07)':'var(--card)',border:`1px solid ${selected?.id===a.id?'rgba(0,0,0,0.18)':'rgba(0,0,0,0.08)'}`,borderRadius:8,color:selected?.id===a.id?'var(--text-primary)':'var(--text-secondary)',fontSize:'.78rem',cursor:'pointer',fontFamily:'DM Sans,sans-serif',whiteSpace:'nowrap'}}>
                        {fmtDate(a.analyzed_at)} {i===0?'(Latest)':''}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected analysis detail */}
                {selected && (
                  <div className="up">
                    {/* Photo + scores */}
                    <div style={{display:'grid',gridTemplateColumns:selected.image_url?'1fr 1fr':'1fr',gap:14,marginBottom:16}}>
                      {selected.image_url && (
                        <div>
                          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:6}}>
                            <button onClick={()=>setHiddenPhotos(p=>({...p,[selected.id]:!p[selected.id]}))}
                              style={{background:'rgba(0,0,0,0.04)',border:'1px solid rgba(0,0,0,0.10)',borderRadius:8,color:'var(--text-secondary)',fontSize:'.72rem',padding:'4px 10px',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif"}}>
                              {hiddenPhotos[selected.id]?'👁 Show photo':'🙈 Hide photo'}
                            </button>
                          </div>
                          {!hiddenPhotos[selected.id] && (
                            <img src={selected.image_url} alt="" style={{width:'100%',borderRadius:12,objectFit:'cover',maxHeight:280}}/>
                          )}
                          {hiddenPhotos[selected.id] && (
                            <div style={{height:100,background:'rgba(0,0,0,0.03)',border:'1px solid rgba(0,0,0,0.08)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-secondary)',fontSize:'.8rem'}}>Photo hidden</div>
                          )}
                        </div>
                      )}
                      <div>
                        <div style={{color:'var(--text-secondary)',fontSize:'.72rem',fontWeight:600,marginBottom:10}}>{fmtDate(selected.analyzed_at)}</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                          <ScoreRing value={selected.overall_score} label="OVERALL" color="#111111" size={76}/>
                          <ScoreRing value={selected.muscle_definition} label="DEFINITION" color="#3b82f6" size={76}/>
                          <ScoreRing value={selected.symmetry_score} label="SYMMETRY" color="#22c55e" size={76}/>
                          <ScoreRing value={100-(selected.body_fat_estimate||20)*2.5} label="LEANNESS" color="#a855f7" size={76}/>
                        </div>
                        <div style={{background:'rgba(0,0,0,0.04)',borderRadius:8,padding:'8px 12px',textAlign:'center'}}>
                          <div className="bb" style={{fontSize:'1.4rem',color:'#f97316'}}>{selected.body_fat_estimate}%</div>
                          <div style={{fontSize:'.65rem',color:'var(--text-secondary)',letterSpacing:1}}>BODY FAT EST.</div>
                        </div>
                      </div>
                    </div>

                    {/* Muscle development radar */}
                    <div className="card" style={{marginBottom:12}}>
                      <div className="bb" style={{fontSize:'.8rem',color:'var(--text-primary)',letterSpacing:2,marginBottom:10}}>تطور العضلات</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'center'}}>
                        <ResponsiveContainer width="100%" height={160}>
                          <RadarChart data={radarData} margin={{top:10,right:20,bottom:10,left:20}}>
                            <PolarGrid stroke="rgba(0,0,0,0.08)"/>
                            <PolarAngleAxis dataKey="muscle" tick={{fill:'var(--text-secondary)',fontSize:10}}/>
                            <Radar dataKey="value" stroke="#111111" fill="#111111" fillOpacity={.08} strokeWidth={2}/>
                            <Tooltip content={<Tip/>}/>
                          </RadarChart>
                        </ResponsiveContainer>
                        <div>
                          {[['الصدر',selected.chest_dev,'#ef4444'],['الظهر',selected.back_dev,'#3b82f6'],['الأكتاف',selected.shoulders_dev,'#a855f7'],['الأذرع',selected.arms_dev,'#f97316'],['البطن',selected.core_dev,'#eab308'],['الأرجل',selected.legs_dev,'#22c55e']].map(([l,v,c])=>(
                            <Bar key={l} label={l} value={v||0} color={c}/>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Comparison with previous if exists */}
                    {analyses.length >= 2 && selected.id === analyses[0].id && (
                      <div className="card" style={{marginBottom:12,background:'rgba(74,222,128,0.05)',borderColor:'rgba(74,222,128,0.18)'}}>
                        <div className="bb" style={{fontSize:'.8rem',color:'#4ade80',letterSpacing:2,marginBottom:10}}>مقارنة مع التحليل السابق</div>
                        {(() => {
                          const prev = analyses[1]
                          const diff = (key) => {
                            const d = (selected[key]||0)-(prev[key]||0)
                            return d > 0 ? `+${d}` : String(d)
                          }
                          const col = (key) => (selected[key]||0) >= (prev[key]||0) ? '#4ade80' : '#ef4444'
                          return (
                            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                              {[['Overall',diff('overall_score'),col('overall_score')],['Definition',diff('muscle_definition'),col('muscle_definition')],['Symmetry',diff('symmetry_score'),col('symmetry_score')]].map(([l,d,c])=>(
                                <div key={l} style={{textAlign:'center',background:'rgba(0,0,0,0.04)',borderRadius:8,padding:'10px 8px'}}>
                                  <div className="bb" style={{fontSize:'1.3rem',color:c}}>{d}</div>
                                  <div style={{fontSize:'.62rem',color:'var(--text-secondary)',letterSpacing:.5}}>{l}</div>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {/* Strengths & weaknesses */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                      <div className="card-sm">
                        <div className="bb" style={{fontSize:'.72rem',color:'#4ade80',letterSpacing:2,marginBottom:10}}>✓ STRENGTHS</div>
                        {selected.strengths?.map((s,i)=>(
                          <div key={i} style={{display:'flex',gap:8,marginBottom:7,alignItems:'flex-start'}}>
                            <span style={{color:'#4ade80',fontSize:'.9rem',flexShrink:0,marginTop:1}}>▸</span>
                            <span style={{fontSize:'.8rem',color:'var(--text-primary)',lineHeight:1.4}}>{s}</span>
                          </div>
                        ))}
                      </div>
                      <div className="card-sm">
                        <div className="bb" style={{fontSize:'.72rem',color:'#f87171',letterSpacing:2,marginBottom:10}}>⚠ WEAKNESSES</div>
                        {selected.weaknesses?.map((s,i)=>(
                          <div key={i} style={{display:'flex',gap:8,marginBottom:7,alignItems:'flex-start'}}>
                            <span style={{color:'#f87171',fontSize:'.9rem',flexShrink:0,marginTop:1}}>▸</span>
                            <span style={{fontSize:'.8rem',color:'var(--text-primary)',lineHeight:1.4}}>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Focus muscles */}
                    {selected.focus_muscles?.length > 0 && (
                      <div className="card-sm" style={{marginBottom:12,background:'rgba(129,140,248,0.05)',borderColor:'rgba(129,140,248,0.18)'}}>
                        <div className="bb" style={{fontSize:'.72rem',color:'#818cf8',letterSpacing:2,marginBottom:8}}>ركّز عليه أولاً</div>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                          {selected.focus_muscles.map((m,i)=>(
                            <span key={i} style={{background:'rgba(129,140,248,.15)',border:'1px solid rgba(129,140,248,.3)',color:'#818cf8',borderRadius:20,padding:'5px 12px',fontSize:'.8rem',fontWeight:600}}>{m}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    <div className="card" style={{marginBottom:12}}>
                      <div className="bb" style={{fontSize:'.8rem',color:'var(--text-primary)',letterSpacing:2,marginBottom:12}}>توصياتنا لك</div>
                      {selected.recommendations?.map((r,i)=>(
                        <div key={i} style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-start'}}>
                          <div style={{width:24,height:24,borderRadius:'50%',background:'#111111',color:'#FFFFFF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.72rem',fontWeight:700,flexShrink:0,marginTop:1}}>{i+1}</div>
                          <span style={{fontSize:'.85rem',color:'var(--text-primary)',lineHeight:1.5}}>{r}</span>
                        </div>
                      ))}
                    </div>

                    {/* Full report */}
                    {selected.full_report && (
                      <div className="card" style={{marginBottom:12}}>
                        <div className="bb" style={{fontSize:'.8rem',color:'var(--text-primary)',letterSpacing:2,marginBottom:12}}>التقرير الكامل</div>
                        <div style={{fontSize:'.85rem',color:'var(--text-secondary)',lineHeight:1.8,whiteSpace:'pre-wrap'}}>{selected.full_report}</div>
                      </div>
                    )}

                    <button onClick={()=>deleteAnalysis(selected.id)} style={{display:'block',width:'100%',padding:'11px',background:'transparent',border:'1px solid rgba(239,68,68,0.25)',borderRadius:8,color:'#ef4444',fontSize:'.82rem',cursor:'pointer',fontFamily:'DM Sans,sans-serif',marginBottom:8}}>
                      Delete this analysis
                    </button>
                    <button className="btn btn-y" onClick={()=>setTab('upload')}>أعد التحليل مرة ثانية 🧠</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div style={{height:'calc(72px + env(safe-area-inset-bottom))'}}/>
      <BottomTabs active="body"/>
    </div>
  )
}

function Loader() {
  return <div style={{minHeight:'100vh',background:'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:32,height:32,border:'3px solid rgba(0,0,0,0.08)',borderTopColor:'#111111',borderRadius:'50%',animation:'spin .8s linear infinite'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
}
