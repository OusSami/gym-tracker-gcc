import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabase'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL
const G = '#CBA23B', F = "'Tajawal',sans-serif"
const C = ['#CBA23B','#3b82f6','#22c55e','#a855f7','#ef4444','#06b6d4','#f97316']
const GOAL_AR = {muscle:'أبي أبني عضل أكثر',weight:'أبي أنزل دهون وأشد جسمي',strength:'أبي أزيد قوتي',endurance:'أبي أرفع تحملي',general:'تحسين اللياقة العامة'}
const ST = {approved:{l:'نشط',c:'#22c55e',b:'rgba(34,197,94,0.12)',br:'rgba(34,197,94,0.3)'},pending:{l:'انتظار',c:'#f97316',b:'rgba(251,146,60,0.12)',br:'rgba(251,146,60,0.3)'},suspended:{l:'موقوف',c:'#ef4444',b:'rgba(239,68,68,0.12)',br:'rgba(239,68,68,0.3)'}}
const card = {background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.1)',borderRadius:16,padding:20}

const Tip = ({active,payload,label}) => active&&payload?.length ? (
  <div style={{background:'#111009',border:'1px solid rgba(203,162,59,0.2)',borderRadius:10,padding:'10px 14px',fontSize:'.78rem',fontFamily:F,direction:'rtl'}}>
    <div style={{color:'rgba(255,255,255,0.4)',marginBottom:5}}>{label}</div>
    {payload.map(p=><div key={p.name} style={{color:p.color,fontWeight:700}}>{p.name}: {p.value}</div>)}
  </div>
) : null

export default function UserDetail() {
  const router = useRouter()
  const { id } = router.query
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [d, setD] = useState(null)
  const [busy, setBusy] = useState(null)
  const [tab, setTab] = useState('overview')

  // Program tab state
  const [prog, setProg] = useState(null)      // { program, days, stats }
  const [progLoading, setProgLoading] = useState(false)
  const [confirm, setConfirm] = useState(null) // { action, label, desc, payload }
  const [targetDay, setTargetDay] = useState('')
  const [progMsg, setProgMsg] = useState(null) // { ok, text }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || session.user.email !== ADMIN_EMAIL) { router.replace('/'); return }
      setAuthed(true)
    })
  }, [])

  useEffect(() => {
    if (!authed || !id) return
    fetch(`/api/admin?action=user_full&userId=${id}`)
      .then(r => r.json())
      .then(data => { setD(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [authed, id])

  const approve = async () => { setBusy('a'); await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', userId: id }) }); const r = await fetch(`/api/admin?action=user_full&userId=${id}`); setD(await r.json()); setBusy(null) }
  const suspend = async () => { if (!window.confirm('إيقاف؟')) return; setBusy('s'); await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'suspend', userId: id }) }); const r = await fetch(`/api/admin?action=user_full&userId=${id}`); setD(await r.json()); setBusy(null) }

  const loadProg = async () => {
    if (progLoading) return
    setProgLoading(true)
    setProg(null)
    try {
      const r = await fetch(`/api/admin?action=program_status&userId=${id}`)
      const data = await r.json()
      setProg(data)
    } catch (e) {
      setProg({ program: null, error: e.message })
    }
    setProgLoading(false)
  }

  const runProgAction = async () => {
    if (!confirm) return
    setBusy('prog')
    setProgMsg(null)
    try {
      const r = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirm.action, userId: id, ...confirm.payload }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'خطأ')
      setProgMsg({ ok: true, text: confirm.successText })
      await loadProg()
    } catch (e) {
      setProgMsg({ ok: false, text: e.message })
    }
    setConfirm(null)
    setBusy(null)
  }

  useEffect(() => { if (tab === 'program' && authed && id) loadProg() }, [tab, authed, id])

  if (!authed) return null

  const TABS = [['overview','نظرة عامة'],['sessions','التمارين'],['nutrition','التغذية'],['body','الجسم'],['program','البرنامج'],['costs','تكاليف API'],['apptime','وقت التطبيق']]

  const st = d?.profile ? (ST[d.profile.status] || { l: d.profile.status, c: '#888', b: 'rgba(255,255,255,0.05)', br: 'rgba(255,255,255,0.1)' }) : null

  return (
    <div style={{ minHeight: '100vh', background: '#09090B', color: '#ECE3CF', fontFamily: F, direction: 'rtl' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} body{margin:0}`}</style>

      {/* TOP BAR */}
      <div style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(203,162,59,0.1)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '.85rem', fontFamily: F, display: 'flex', alignItems: 'center', gap: 6 }}>← المستخدمون</button>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ fontWeight:700, fontSize: '.9rem' }}>{d?.profile?.full_name || 'ملف المستخدم'}</div>
        {st && <span style={{ background: st.b, color: st.c, border: `1px solid ${st.br}`, padding: '3px 10px', borderRadius: 20, fontSize: '.7rem', fontWeight: 700 }}>{st.l}</span>}
        <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
          {d?.profile?.status !== 'approved' && <button onClick={approve} disabled={busy==='a'} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', padding: '7px 14px', borderRadius: 9, cursor: 'pointer', fontSize: '.78rem', fontFamily: F }}>{busy==='a'?'...':'✓ قبول'}</button>}
          {d?.profile?.status !== 'suspended' && <button onClick={suspend} disabled={busy==='s'} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '7px 14px', borderRadius: 9, cursor: 'pointer', fontSize: '.78rem', fontFamily: F }}>{busy==='s'?'...':'✕ إيقاف'}</button>}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 14, color: 'rgba(255,255,255,0.25)' }}>
          <div style={{ width: 26, height: 26, border: '3px solid rgba(203,162,59,0.15)', borderTopColor: G, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          جاري تحميل بيانات المستخدم...
        </div>
      ) : d && (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>

          {/* PROFILE HEADER CARD */}
          <div style={{ ...card, marginBottom: 20, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(203,162,59,0.1)', border: `2px solid ${G}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
              {d.profile?.full_name?.[0] || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 900, fontSize: '1.2rem', marginBottom: 4 }}>{d.profile?.full_name || 'بدون اسم'}</div>
              <div style={{ fontSize: '.82rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{d.profile?.email}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  ['الهدف', GOAL_AR[d.profile?.goal] || d.profile?.goal || '—'],
                  ['المستوى', d.profile?.fitness_level || '—'],
                  ['وحدة القياس', d.profile?.unit_system === 'imperial' ? 'رطل' : 'كجم'],
                  ['تاريخ الانضمام', d.profile?.created_at ? new Date(d.profile.created_at).toLocaleDateString('ar-SA') : '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '5px 12px', fontSize: '.75rem' }}>
                    <span style={{ color: 'rgba(255,255,255,0.35)' }}>{k}: </span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Quick KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, minWidth: 400 }}>
              {[
                ['تمارين كلية', d.stats?.total_sessions, G],
                ['آخر وزن', d.stats?.latest_weight ? `${d.stats.latest_weight} كجم` : '—', '#3b82f6'],
                ['السلسلة الحالية', d.stats?.streak ? `${d.stats.streak} يوم` : '—', '#22c55e'],
                ['تكلفة API/شهر', `$${d.costs?.monthly || '0.0000'}`, '#a855f7'],
              ].map(([l, v, c]) => (
                <div key={l} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: c, lineHeight: 1, fontFamily: 'monospace' }}>{v}</div>
                  <div style={{ fontSize: '.65rem', color: 'rgba(255,255,255,0.3)', marginTop: 5, fontFamily: F }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SUB TABS */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 20, display: 'flex', gap: 0, overflowX: 'auto' }}>
            {TABS.map(([id2, lbl]) => (
              <button key={id2} onClick={() => setTab(id2)} style={{ background: 'none', border: 'none', borderBottom: tab === id2 ? `2px solid ${G}` : '2px solid transparent', color: tab === id2 ? G : 'rgba(255,255,255,0.35)', padding: '11px 16px', cursor: 'pointer', fontFamily: F, fontWeight: 700, fontSize: '.82rem', transition: 'all .15s', marginBottom: -1, whiteSpace: 'nowrap' }}>
                {lbl}
              </button>
            ))}
          </div>

          {/* ═══ OVERVIEW TAB ═══ */}
          {tab === 'overview' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
                {[
                  ['إجمالي التمارين', d.stats?.total_sessions, G],
                  ['هذا الأسبوع', d.stats?.sessions_this_week, '#3b82f6'],
                  ['هذا الشهر', d.stats?.sessions_this_month, '#22c55e'],
                  ['إجمالي الحجم', d.stats?.total_volume_kg ? `${Math.round(d.stats.total_volume_kg/1000)}k كجم` : '—', '#a855f7'],
                  ['إجمالي المجموعات', d.stats?.total_sets, '#f97316'],
                  ['متوسط مدة التمرين', d.stats?.avg_duration ? `${Math.round(d.stats.avg_duration/60)} د` : '—', '#06b6d4'],
                  ['الوجبات المسجلة', d.stats?.total_meals, '#ec4899'],
                  ['إجمالي التكلفة', `$${d.costs?.total || '0.0000'}`, '#ef4444'],
                ].map(([l, v, c]) => (
                  <div key={l} style={card}>
                    <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.22)', marginBottom: 8, textTransform: 'uppercase', fontFamily: F }}>{l}</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: c, lineHeight: 1, fontFamily: 'monospace' }}>{v ?? '—'}</div>
                  </div>
                ))}
              </div>

              {/* Volume over time */}
              {(d.charts?.volumeBySession?.length > 0) && (
                <div style={{ ...card, marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: '.83rem', marginBottom: 14, color: 'rgba(255,255,255,0.7)' }}>تطور الحجم التدريبي (كجم لكل تمرين)</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={d.charts.volumeBySession} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                      <defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={G} stopOpacity={0.3} /><stop offset="95%" stopColor={G} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: F }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<Tip />} />
                      <Area type="monotone" dataKey="volume" name="الحجم كجم" stroke={G} strokeWidth={2} fill="url(#vg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Weight history */}
              {(d.charts?.weightHistory?.length > 0) && (
                <div style={card}>
                  <div style={{ fontWeight: 700, fontSize: '.83rem', marginBottom: 14, color: 'rgba(255,255,255,0.7)' }}>تطور الوزن (كجم)</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={d.charts.weightHistory} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: F }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip content={<Tip />} />
                      <Line type="monotone" dataKey="weight" name="الوزن كجم" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ═══ SESSIONS TAB ═══ */}
          {tab === 'sessions' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                {/* Sessions per week */}
                {d.charts?.sessionsPerWeek?.length > 0 && (
                  <div style={card}>
                    <div style={{ fontWeight: 700, fontSize: '.83rem', marginBottom: 14, color: 'rgba(255,255,255,0.7)' }}>التمارين الأسبوعية</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={d.charts.sessionsPerWeek} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: F }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} />
                        <Tooltip content={<Tip />} />
                        <Bar dataKey="count" name="تمارين" fill={G} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* Muscle distribution pie */}
                {d.charts?.musclesDist?.length > 0 && (
                  <div style={card}>
                    <div style={{ fontWeight: 700, fontSize: '.83rem', marginBottom: 14, color: 'rgba(255,255,255,0.7)' }}>توزيع العضلات المُدرَّبة</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={d.charts.musclesDist} cx="50%" cy="50%" outerRadius={80} dataKey="count">
                          {d.charts.musclesDist.map((_, i) => <Cell key={i} fill={C[i % C.length]} fillOpacity={0.85} />)}
                        </Pie>
                        <Tooltip content={<Tip />} />
                        <Legend iconType="circle" iconSize={7} formatter={v => <span style={{ fontSize: '.7rem', color: 'rgba(255,255,255,0.45)', fontFamily: F }}>{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Recent sessions list */}
              <div style={card}>
                <div style={{ fontWeight: 700, fontSize: '.83rem', marginBottom: 14, color: 'rgba(255,255,255,0.7)' }}>آخر التمارين</div>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {(d.recentSessions || []).map(sess => (
                    <div key={sess.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '12px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: '.88rem' }}>
                          {new Date(sess.session_date + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: '.75rem', color: 'rgba(255,255,255,0.4)' }}>
                          <span>{sess.exercises?.length || 0} تمرين</span>
                          <span>{sess.exercises?.reduce((a, e) => a + (e.sets?.length || 0), 0) || 0} مجموعة</span>
                          {sess.total_volume_kg && <span>{Math.round(sess.total_volume_kg)} كجم</span>}
                        </div>
                      </div>
                      {sess.muscles_trained?.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {sess.muscles_trained.map(m => (
                            <span key={m} style={{ background: 'rgba(203,162,59,0.1)', color: G, border: '1px solid rgba(203,162,59,0.2)', padding: '2px 8px', borderRadius: 12, fontSize: '.68rem', fontWeight: 600 }}>{m}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {!d.recentSessions?.length && <div style={{ color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 30, fontFamily: F }}>لا تمارين مسجلة</div>}
                </div>
              </div>
            </div>
          )}

          {/* ═══ NUTRITION TAB ═══ */}
          {tab === 'nutrition' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  ['إجمالي الوجبات', d.stats?.total_meals, G],
                  ['متوسط سعرات/يوم', d.stats?.avg_calories ? Math.round(d.stats.avg_calories) : '—', '#f97316'],
                  ['متوسط بروتين/يوم', d.stats?.avg_protein ? `${Math.round(d.stats.avg_protein)}g` : '—', '#3b82f6'],
                  ['أيام التسجيل', d.stats?.meal_log_days || '—', '#22c55e'],
                ].map(([l, v, c]) => (
                  <div key={l} style={card}>
                    <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.22)', marginBottom: 8, fontFamily: F, textTransform: 'uppercase' }}>{l}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: c, fontFamily: 'monospace' }}>{v ?? '—'}</div>
                  </div>
                ))}
              </div>
              {d.charts?.caloriesHistory?.length > 0 && (
                <div style={card}>
                  <div style={{ fontWeight: 700, fontSize: '.83rem', marginBottom: 14, color: 'rgba(255,255,255,0.7)' }}>السعرات اليومية</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={d.charts.caloriesHistory} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: F }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="calories" name="سعرات" fill="#f97316" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ═══ BODY TAB ═══ */}
          {tab === 'body' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  ['آخر وزن', d.stats?.latest_weight ? `${d.stats.latest_weight} كجم` : '—', G],
                  ['تغير الشهر', d.stats?.month_change !== undefined ? `${d.stats.month_change > 0 ? '+' : ''}${d.stats.month_change} كجم` : '—', d.stats?.month_change < 0 ? '#22c55e' : '#ef4444'],
                  ['قياس الخصر', d.profile?.waist_cm ? `${d.profile.waist_cm} سم` : '—', '#3b82f6'],
                  ['تحليلات الجسم', d.stats?.body_analyses || 0, '#a855f7'],
                ].map(([l, v, c]) => (
                  <div key={l} style={card}>
                    <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.22)', marginBottom: 8, fontFamily: F, textTransform: 'uppercase' }}>{l}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: c, fontFamily: 'monospace' }}>{v}</div>
                  </div>
                ))}
              </div>
              {d.charts?.weightHistory?.length > 0 && (
                <div style={card}>
                  <div style={{ fontWeight: 700, fontSize: '.83rem', marginBottom: 14, color: 'rgba(255,255,255,0.7)' }}>تطور الوزن الكامل</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={d.charts.weightHistory} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: F }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip content={<Tip />} />
                      <Line type="monotone" dataKey="weight" name="الوزن كجم" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ═══ PROGRAM TAB ═══ */}
          {tab === 'program' && (
            <div>
              {/* Feedback banner */}
              {progMsg && (
                <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: progMsg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${progMsg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: progMsg.ok ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: '.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {progMsg.text}
                  <button onClick={() => setProgMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </div>
              )}

              {progLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: 'rgba(255,255,255,0.3)' }}>
                  <div style={{ width: 20, height: 20, border: '3px solid rgba(203,162,59,0.15)', borderTopColor: G, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  جاري تحميل البرنامج...
                </div>
              ) : !prog?.program ? (
                <div style={{ ...card, textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: '2rem', marginBottom: 12 }}>📋</div>
                  <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>لا يوجد برنامج نشط لهذا المستخدم</div>
                  <button onClick={loadProg} style={{ background: 'rgba(203,162,59,0.1)', border: `1px solid ${G}40`, color: G, borderRadius: 9, padding: '8px 20px', fontFamily: F, fontWeight: 700, fontSize: '.82rem', cursor: 'pointer' }}>
                    🔄 إعادة تحميل
                  </button>
                  {prog?.error && <div style={{ marginTop: 12, fontSize: '.72rem', color: '#ef4444', fontFamily: 'monospace' }}>{prog.error}</div>}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Program status card */}
                  <div style={{ ...card }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: '.75rem', letterSpacing: 1.5, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
                        {prog.program.package_name || prog.program.package_id} — {prog.program.total_days} يوم
                      </div>
                      <button onClick={loadProg} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '.8rem', fontFamily: F }}>🔄 تحديث</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginBottom: 14 }}>
                      {[
                        ['اليوم الحالي', `${prog.program.current_day} / ${prog.program.total_days}`, G],
                        ['الأيام المكتملة', prog.stats?.completed ?? '—', '#22c55e'],
                        ['الأيام الغائبة', prog.stats?.missed ?? '—', '#ef4444'],
                        ['الالتزام', prog.stats?.compliance != null ? `${prog.stats.compliance}%` : '—', '#3b82f6'],
                        ['التمارين المولّدة', prog.stats?.withWorkout ?? '—', '#a855f7'],
                      ].map(([l, v, c]) => (
                        <div key={l} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: c, fontFamily: 'monospace', lineHeight: 1 }}>{v}</div>
                          <div style={{ fontSize: '.62rem', color: 'rgba(255,255,255,0.3)', marginTop: 5, fontFamily: F }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {/* Day grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(28px,1fr))', gap: 4 }}>
                      {(prog.days || []).map(day => {
                        const isCur = day.day_number === prog.program.current_day
                        const cs = day.checkin_status
                        const bg = isCur ? `${G}30` : cs === 'completed' ? 'rgba(34,197,94,0.2)' : cs === 'partial' ? 'rgba(251,146,60,0.15)' : cs === 'missed' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)'
                        const border = isCur ? `${G}80` : cs === 'completed' ? 'rgba(34,197,94,0.5)' : cs === 'partial' ? 'rgba(251,146,60,0.4)' : cs === 'missed' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'
                        const lbl = isCur ? '▶' : cs === 'completed' ? '✓' : cs === 'partial' ? '◑' : cs === 'missed' ? '✕' : ''
                        const col = isCur ? G : cs === 'completed' ? '#22c55e' : cs === 'partial' ? '#f97316' : cs === 'missed' ? '#ef4444' : 'rgba(255,255,255,0.2)'
                        return (
                          <div key={day.day_number} title={`يوم ${day.day_number}`} style={{ aspectRatio: '1', background: bg, border: `1.5px solid ${border}`, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: lbl.length > 1 ? '.5rem' : '.65rem', color: col, fontWeight: 700 }}>
                            {lbl || day.day_number}
                          </div>
                        )
                      })}
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                      {[['▶ اليوم الحالي', G], ['✓ مكتمل', '#22c55e'], ['◑ جزئي', '#f97316'], ['✕ غاب', '#ef4444']].map(([l, c]) => (
                        <span key={l} style={{ fontSize: '.65rem', color: c }}>{l}</span>
                      ))}
                    </div>
                  </div>

                  {/* Status badge if paused */}
                  {prog.program.status !== 'active' && (
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: '.82rem', color: '#f87171' }}>
                      ⚠️ البرنامج حالياً: <strong>{prog.program.status}</strong> — استخدم "إعادة تعيين" لإعادة تفعيله.
                    </div>
                  )}

                  {/* ── Actions ── */}

                  {/* 1. Set to specific day */}
                  <div style={{ ...card }}>
                    <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: 4 }}>📅 الانتقال إلى يوم محدد</div>
                    <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
                      يضبط اليوم الحالي على الرقم الذي تختاره ويمسح تقدم كل يوم بعده. إذا كان البرنامج موقوفاً سيُعاد تفعيله تلقائياً.
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        type="number" min="1" max={prog.program.total_days}
                        value={targetDay}
                        onChange={e => setTargetDay(e.target.value)}
                        placeholder={`1 — ${prog.program.total_days}`}
                        style={{ width: 110, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '9px 12px', color: '#ECE3CF', fontFamily: F, fontSize: '.88rem', outline: 'none' }}
                      />
                      <button
                        disabled={!targetDay || parseInt(targetDay) < 1 || parseInt(targetDay) > prog.program.total_days || busy === 'prog'}
                        onClick={() => setConfirm({
                          action: 'program_set_day',
                          payload: { targetDay: parseInt(targetDay), programId: prog.program.id },
                          label: `الانتقال إلى اليوم ${targetDay}`,
                          desc: `سيتم ضبط البرنامج على اليوم ${targetDay} ومسح بيانات الأيام ${targetDay}–${prog.program.total_days} بالكامل. لا يمكن التراجع.`,
                          successText: `✓ تم الانتقال إلى اليوم ${targetDay}`,
                        })}
                        style={{ background: G, color: '#09090B', border: 'none', borderRadius: 9, padding: '9px 18px', fontFamily: F, fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', opacity: (!targetDay || parseInt(targetDay) < 1 || parseInt(targetDay) > prog.program.total_days) ? 0.4 : 1 }}>
                        انتقل
                      </button>
                    </div>
                  </div>

                  {/* 2. Reset to day 1 */}
                  <div style={{ ...card }}>
                    <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: 4 }}>🔄 إعادة تعيين للبداية (اليوم 1)</div>
                    <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
                      يمسح كامل تقدم البرنامج ويعيد المستخدم لليوم الأول ويُعيد تفعيل البرنامج. التواريخ تُعاد من اليوم.
                    </div>
                    <button
                      disabled={busy === 'prog'}
                      onClick={() => setConfirm({
                        action: 'program_reset',
                        payload: { programId: prog.program.id },
                        label: 'إعادة تعيين كامل للبرنامج',
                        desc: `سيتم مسح جميع بيانات الأيام الـ ${prog.program.total_days} وإعادة المستخدم لليوم 1. لا يمكن التراجع.`,
                        successText: '✓ تم إعادة تعيين البرنامج لليوم 1',
                      })}
                      style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)', color: '#f97316', borderRadius: 9, padding: '9px 18px', fontFamily: F, fontWeight: 700, fontSize: '.82rem', cursor: 'pointer' }}>
                      إعادة تعيين للبداية
                    </button>
                  </div>

                  {/* 3. Regen today's workout */}
                  <div style={{ ...card }}>
                    <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: 4 }}>⚡ إعادة توليد تمرين اليوم</div>
                    <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
                      يمسح تمرين اليوم الحالي (اليوم {prog.program.current_day}) فقط — سيُولَّد تمرين جديد عند فتح المستخدم التطبيق.
                    </div>
                    <button
                      disabled={busy === 'prog'}
                      onClick={() => setConfirm({
                        action: 'program_regen_today',
                        payload: { programId: prog.program.id },
                        label: `إعادة توليد تمرين اليوم ${prog.program.current_day}`,
                        desc: `سيتم مسح التمرين المحفوظ لليوم ${prog.program.current_day} فقط. سيُولَّد من جديد عند فتح التطبيق.`,
                        successText: `✓ تم مسح تمرين اليوم ${prog.program.current_day}`,
                      })}
                      style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', borderRadius: 9, padding: '9px 18px', fontFamily: F, fontWeight: 700, fontSize: '.82rem', cursor: 'pointer' }}>
                      إعادة توليد تمرين اليوم
                    </button>
                  </div>

                  {/* 4. End program */}
                  <div style={{ ...card, border: '1px solid rgba(239,68,68,0.15)' }}>
                    <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: 4, color: '#ef4444' }}>🛑 إنهاء / إيقاف البرنامج</div>
                    <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
                      يوقف البرنامج ويجعله غير مرئي للمستخدم. البيانات تُحفظ ويمكن إعادة التفعيل بـ"إعادة تعيين".
                    </div>
                    <button
                      disabled={busy === 'prog' || prog.program.status === 'paused'}
                      onClick={() => setConfirm({
                        action: 'program_end',
                        payload: { programId: prog.program.id },
                        label: 'إنهاء البرنامج',
                        desc: 'سيتم إيقاف البرنامج. لن يراه المستخدم حتى يُعاد تفعيله أو يُنشئ برنامجاً جديداً.',
                        successText: '✓ تم إيقاف البرنامج',
                      })}
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: prog.program.status === 'paused' ? 'rgba(255,255,255,0.2)' : '#ef4444', borderRadius: 9, padding: '9px 18px', fontFamily: F, fontWeight: 700, fontSize: '.82rem', cursor: prog.program.status === 'paused' ? 'not-allowed' : 'pointer' }}>
                      {prog.program.status === 'paused' ? 'موقوف بالفعل' : 'إنهاء البرنامج'}
                    </button>
                  </div>

                </div>
              )}

              {/* ── Confirmation modal ── */}
              {confirm && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                  onClick={() => { if (busy !== 'prog') setConfirm(null) }}>
                  <div onClick={e => e.stopPropagation()} style={{ background: '#0F0E0B', border: `1px solid ${G}30`, borderRadius: 18, padding: 24, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
                    <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: 8, color: G }}>⚠️ تأكيد: {confirm.label}</div>
                    <div style={{ fontSize: '.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 20 }}>{confirm.desc}</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={runProgAction} disabled={busy === 'prog'}
                        style={{ flex: 1, background: G, color: '#09090B', border: 'none', borderRadius: 10, padding: '12px', fontFamily: F, fontWeight: 900, fontSize: '.88rem', cursor: 'pointer' }}>
                        {busy === 'prog' ? '...' : 'نعم، نفّذ'}
                      </button>
                      <button onClick={() => setConfirm(null)} disabled={busy === 'prog'}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '12px', fontFamily: F, fontWeight: 700, fontSize: '.88rem', cursor: 'pointer' }}>
                        إلغاء
      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ COSTS TAB ═══ */}
          {tab === 'costs' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  ['إجمالي التكلفة', `$${d.costs?.total || '0.0000'}`, G],
                  ['هذا الشهر', `$${d.costs?.monthly || '0.0000'}`, '#22c55e'],
                  ['إجمالي المكالمات', d.costs?.total_calls || 0, '#3b82f6'],
                ].map(([l, v, c]) => (
                  <div key={l} style={card}>
                    <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.22)', marginBottom: 8, fontFamily: F, textTransform: 'uppercase' }}>{l}</div>
                    <div style={{ fontSize: '1.7rem', fontWeight: 900, color: c, fontFamily: 'monospace' }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                {/* Cost pie by endpoint */}
                <div style={card}>
                  <div style={{ fontWeight: 700, fontSize: '.83rem', marginBottom: 14, color: 'rgba(255,255,255,0.7)' }}>التكلفة حسب الخدمة</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={(d.costs?.by_endpoint || []).map(e => ({ name: e.endpoint, value: parseFloat(e.total_cost) || 0 }))}
                        cx="50%" cy="50%" outerRadius={85} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}>
                        {(d.costs?.by_endpoint || []).map((_, i) => <Cell key={i} fill={C[i % C.length]} fillOpacity={0.85} />)}
                      </Pie>
                      <Tooltip content={<Tip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Cost by endpoint list */}
                <div style={card}>
                  <div style={{ fontWeight: 700, fontSize: '.83rem', marginBottom: 14, color: 'rgba(255,255,255,0.7)' }}>تفاصيل الاستخدام</div>
                  {(d.costs?.by_endpoint || []).map((ep, i) => (
                    <div key={ep.endpoint} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px', gap: 8, padding: '10px 12px', borderRadius: 10, marginBottom: 4, background: 'rgba(255,255,255,0.02)', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: C[i % C.length], flexShrink: 0 }} />
                        <span style={{ fontSize: '.82rem', fontWeight: 600 }}>{ep.endpoint}</span>
                      </div>
                      <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontFamily: F }}>{ep.calls} مكالمة</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#22c55e', fontSize: '.8rem', textAlign: 'left' }}>${ep.total_cost}</div>
                    </div>
                  ))}
                  {!d.costs?.by_endpoint?.length && <div style={{ color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 20, fontFamily: F }}>لا استخدام مسجّل</div>}
                </div>
              </div>

              {/* Cost timeline */}
              {d.charts?.userDailyCost?.length > 0 && (
                <div style={card}>
                  <div style={{ fontWeight: 700, fontSize: '.83rem', marginBottom: 14, color: 'rgba(255,255,255,0.7)' }}>تكلفة API اليومية لهذا المستخدم</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={d.charts.userDailyCost} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                      <defs><linearGradient id="ucg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontFamily: F }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<Tip />} />
                      <Area type="monotone" dataKey="cost" name="$ التكلفة" stroke="#22c55e" strokeWidth={2} fill="url(#ucg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ═══ APP TIME TAB ═══ */}
          {tab === 'apptime' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  ['إجمالي وقت التطبيق', d.stats?.total_app_time ? `${Math.round(d.stats.total_app_time / 60)} د` : '—', G],
                  ['متوسط يومي', d.stats?.avg_daily_time ? `${Math.round(d.stats.avg_daily_time / 60)} د` : '—', '#3b82f6'],
                  ['آخر جلسة', d.stats?.last_app_session ? new Date(d.stats.last_app_session).toLocaleDateString('ar-SA') : '—', '#22c55e'],
                ].map(([l, v, c]) => (
                  <div key={l} style={card}>
                    <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.22)', marginBottom: 8, fontFamily: F, textTransform: 'uppercase' }}>{l}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: c, fontFamily: 'monospace' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* App sessions list */}
              <div style={card}>
                <div style={{ fontWeight: 700, fontSize: '.83rem', marginBottom: 14, color: 'rgba(255,255,255,0.7)' }}>سجل جلسات التطبيق</div>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {(d.appSessions || []).length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 30, fontFamily: F }}>لا جلسات مسجلة بعد</div>
                  ) : (d.appSessions || []).map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '.82rem' }}>{new Date(s.started_at).toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,0.4)', fontFamily: F }}>
                        {s.duration_seconds ? `${Math.round(s.duration_seconds / 60)} دقيقة` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
