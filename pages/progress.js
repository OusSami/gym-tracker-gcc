import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { BottomTabs } from '../components/Nav'

const G = 'var(--accent)', F = "'Tajawal',sans-serif"
const B = { minHeight: '100vh', background: 'var(--surface)', color: 'var(--text-primary)', fontFamily: F, direction: 'rtl' }

export default function Progress() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [program, setProgram] = useState(null)
  const [dayRecords, setDayRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [dayModal, setDayModal] = useState(null)
  const [dayReport, setDayReport] = useState(null)
  const [dayReportLoading, setDayReportLoading] = useState(false)
  const [profileSex, setProfileSex] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/'); return }
      setUser(session.user)
      try {
        const [sr, pr] = await Promise.all([
          fetch('/api/packages/status?userId=' + session.user.id).then(r => r.json()),
          fetch('/api/profile?userId=' + session.user.id).then(r => r.json()).catch(() => ({})),
        ])
        setProfileSex(pr.profile?.sex || null)
        if (sr.program) {
          setProgram(sr.program)
          const dr = await fetch('/api/packages/days?programId=' + sr.program.id).then(r => r.json()).catch(() => ({ days: [] }))
          setDayRecords(dr.days || [])
        }
      } catch (e) {}
      setLoading(false)
    })
  }, [])

  const openDayReport = async (dayNum) => {
    setDayModal({ dayNumber: dayNum }); setDayReport(null); setDayReportLoading(true)
    try {
      const r = await fetch('/api/packages/day-report?programId=' + program.id + '&dayNumber=' + dayNum + '&userId=' + user.id)
      setDayReport(await r.json())
    } catch (e) {}
    setDayReportLoading(false)
  }

  if (loading) return (
    <div style={{ ...B, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--text-muted)' }}>
      <div style={{ width: 28, height: 28, border: '3px solid var(--accent-dim)', borderTopColor: G, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const heroImg = profileSex === 'female' ? '/gender-female.webp' : '/gender-male.webp'

  if (!program) return (
    <div style={{ ...B, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <img src={heroImg} alt="" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center 15%', marginBottom: 20, border: '3px solid var(--border-accent)' }} />
      <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: 8 }}>ما عندك برنامج نشط</div>
      <div style={{ fontSize: '.88rem', color: 'var(--text-muted)', marginBottom: 24 }}>ابدأ برنامجك لمتابعة تقدمك</div>
      <button onClick={() => router.push('/packages')} style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', border: 'none', borderRadius: 14, padding: '14px 32px', fontFamily: F, fontWeight: 900, fontSize: '1rem', cursor: 'pointer' }}>ابدأ برنامجي 🚀</button>
      <BottomTabs active="dashboard" />
    </div>
  )

  const days = program.roadmap?.days || []
  const totalDays = program.total_days || 21
  const currentDay = program.current_day || 1
  const completedCount = dayRecords.filter(d => ['completed', 'partial'].includes(d.checkin_status)).length
  const pct = Math.round((completedCount / totalDays) * 100)

  // Streak — consecutive checked-in days going backwards from yesterday
  let streak = 0
  for (let d = currentDay - 1; d >= 1; d--) {
    const rec = dayRecords.find(r => r.day_number === d)
    if (rec && ['completed', 'partial', 'rest'].includes(rec.checkin_status)) streak++
    else break
  }

  // This week's summary
  const weekStart = currentDay - ((currentDay - 1) % 7)
  const weekDays = dayRecords.filter(r => r.day_number >= weekStart && r.day_number < currentDay)
  const weekCompleted = weekDays.filter(r => ['completed', 'partial'].includes(r.checkin_status)).length
  const weekTotal = Math.min(7, currentDay - weekStart)

  // Milestones
  const MILESTONES = [
    { label: 'أول تمرين', icon: '🏆', need: 1 },
    { label: '3 أيام',    icon: '🔥', need: 3 },
    { label: 'أسبوع كامل',icon: '⭐', need: 7 },
    { label: '10 أيام',   icon: '💪', need: 10 },
    { label: 'النصف',     icon: '🥇', need: Math.ceil(totalDays / 2) },
    { label: 'الإنهاء',   icon: '🎯', need: totalDays },
  ]

  return (
    <div style={B}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} .fu{animation:fu .3s ease}`}</style>

      {/* Top bar */}
      <div style={{ background: 'var(--card)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)', padding: '13px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: 'var(--shadow-card)' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '.88rem' }}>{program.roadmap?.program_name || program.package_name}</div>
          <div style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>اليوم {currentDay} من {totalDays}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ height: 4, width: 60, background: 'var(--accent-faint)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: pct + '%', background: 'var(--accent)', borderRadius: 10, transition: 'width .5s' }} />
          </div>
          <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '.92rem', color: G }}>{pct}%</div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 100px' }} className="fu">

        {/* Zero-workouts motivational banner */}
        {completedCount === 0 && (
          <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
            <img src={heroImg} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center 15%', border: '3px solid var(--border-accent)' }} />
            <div style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: 10, fontWeight: 600 }}>جاهز تبدأ؟ اليوم الأول أصعب خطوة</div>
          </div>
        )}

        {/* Stats panel */}
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--border)', marginBottom: 12, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,var(--accent),transparent)' }} />
          <div style={{ display: 'flex' }}>
            {[
              ['مكتملة', completedCount, '#22c55e'],
              ['اليوم', currentDay, '#60a5fa'],
              ['متبقية', Math.max(0, totalDays - currentDay + 1), G],
            ].map(([l, v, c], i) => (
              <div key={l} style={{ flex: 1, textAlign: 'center', padding: '11px 4px', borderInlineEnd: i < 2 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.15rem', color: c, lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: '.5rem', color: 'var(--text-muted)', marginTop: 5, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Sans',sans-serif" }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,var(--border-subtle),transparent)', marginInline: 16 }} />
          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '9px 4px', borderInlineEnd: '1px solid var(--border-subtle)' }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1rem', color: streak >= 3 ? '#f97316' : 'var(--text-muted)', lineHeight: 1 }}>
                {streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : '💧'} {streak}
              </div>
              <div style={{ fontSize: '.5rem', color: 'var(--text-muted)', marginTop: 4, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Sans',sans-serif" }}>streak</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '9px 4px', borderInlineEnd: '1px solid var(--border-subtle)' }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1rem', color: '#22c55e', lineHeight: 1 }}>
                {weekCompleted}<span style={{ color: 'var(--text-muted)', fontSize: '.68rem' }}>/{weekTotal}</span>
              </div>
              <div style={{ fontSize: '.5rem', color: 'var(--text-muted)', marginTop: 4, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Sans',sans-serif" }}>this week</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '9px 4px' }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1rem', color: 'var(--text-muted)', lineHeight: 1 }}>{totalDays}</div>
              <div style={{ fontSize: '.5rem', color: 'var(--text-muted)', marginTop: 4, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Sans',sans-serif" }}>total</div>
            </div>
          </div>
          <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,var(--accent-dim),transparent)' }} />
        </div>

        {/* Milestones */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: '.75rem', color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: 1 }}>الإنجازات</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MILESTONES.map(m => {
              const done = completedCount >= m.need
              return (
                <div key={m.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 52, opacity: done ? 1 : 0.3, filter: done ? 'none' : 'grayscale(1)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: done ? 'var(--accent-dim)' : 'var(--surface-inset)', border: `2px solid ${done ? 'var(--accent)' : 'var(--border-subtle)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', boxShadow: done ? 'var(--shadow-glow)' : 'none' }}>{m.icon}</div>
                  <div style={{ fontSize: '.58rem', color: done ? G : 'var(--text-muted)', fontWeight: done ? 700 : 400, textAlign: 'center' }}>{m.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>تقدم البرنامج</span>
            <span style={{ color: G, fontWeight: 700, fontFamily: 'monospace' }}>{pct}%</span>
          </div>
          <div style={{ height: 10, background: 'var(--accent-faint)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: pct + '%', background: 'linear-gradient(90deg,var(--accent-soft),var(--accent))', borderRadius: 10, transition: 'width 1s ease', boxShadow: 'var(--shadow-glow)' }} />
          </div>
        </div>

        {/* Day grid */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: '.78rem', color: 'var(--text-secondary)', marginBottom: 10 }}>خريطة البرنامج <span style={{ fontWeight: 400, fontSize: '.68rem', color: 'var(--text-muted)' }}>· اضغط على يوم لترى تقريره</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 8 }}>
            {['أح', 'إث', 'ث', 'أر', 'خ', 'ج', 'س'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: '.58rem', color: 'var(--text-muted)', fontWeight: 700 }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
            {Array.from({ length: totalDays }, (_, i) => {
              const dn = i + 1
              const rec = dayRecords.find(d => d.day_number === dn)
              const tgt = days[i] || {}
              const isRestDot = tgt.day_type === 'راحة' || tgt.day_type === 'نشاط خفيف'
              const isCur = dn === currentDay
              const cs = rec?.checkin_status
              const bg = isCur ? 'var(--accent-dim)' : cs === 'completed' ? 'rgba(34,197,94,0.2)' : cs === 'partial' ? 'rgba(251,146,60,0.15)' : cs === 'missed' ? 'rgba(239,68,68,0.15)' : isRestDot && dn < currentDay ? 'rgba(59,130,246,0.1)' : 'var(--surface-inset)'
              const border = isCur ? 'var(--accent)' : cs === 'completed' ? 'rgba(34,197,94,0.5)' : cs === 'partial' ? 'rgba(251,146,60,0.4)' : cs === 'missed' ? 'rgba(239,68,68,0.4)' : 'var(--border-subtle)'
              const lbl = isCur ? '▶' : cs === 'completed' ? '✓' : cs === 'partial' ? '◑' : cs === 'missed' ? '✕' : isRestDot && dn <= currentDay ? '💤' : ''
              const col = isCur ? G : cs === 'completed' ? '#22c55e' : cs === 'partial' ? '#f97316' : cs === 'missed' ? '#ef4444' : 'var(--text-muted)'
              const clickable = dn < currentDay && cs
              return (
                <div key={dn} onClick={clickable ? () => openDayReport(dn) : undefined}
                  style={{ aspectRatio: '1', background: bg, border: `1.5px solid ${border}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: lbl.length > 1 ? '.52rem' : '.7rem', color: col, fontWeight: isCur ? 900 : 600, cursor: clickable ? 'pointer' : 'default', transition: 'all .15s', boxShadow: isCur ? 'var(--shadow-glow)' : clickable && cs ? 'var(--shadow-card)' : 'none' }}
                  onTouchStart={e => clickable && (e.currentTarget.style.transform = 'scale(.9)')}
                  onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}>
                  {lbl}
                </div>
              )
            })}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            {[['✓ مكتمل', '#22c55e'], ['◑ جزئي', '#f97316'], ['✕ غاب', '#ef4444'], ['💤 راحة', '#3b82f6'], ['▶ اليوم', G]].map(([l, c]) => (
              <div key={l} style={{ fontSize: '.62rem', color: c }}>{l}</div>
            ))}
          </div>
        </div>

        {/* Weekly themes */}
        {program.roadmap?.weekly_overview?.length > 0 && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '.78rem', color: 'var(--text-secondary)', marginBottom: 10 }}>أهداف الأسابيع</div>
            {program.roadmap.weekly_overview.map(w => {
              const active = w.week === Math.ceil(currentDay / 7)
              return (
                <div key={w.week} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8, opacity: active ? 1 : 0.4 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: active ? 'var(--accent-dim)' : 'var(--surface-inset)', border: `1px solid ${active ? 'var(--border-accent)' : 'var(--border-subtle)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.68rem', fontWeight: 800, color: active ? G : 'var(--text-muted)', flexShrink: 0 }}>{w.week}</div>
                  <div><div style={{ fontWeight: 700, fontSize: '.82rem', marginBottom: 2 }}>{w.theme}</div><div style={{ fontSize: '.72rem', color: 'var(--text-secondary)' }}>{w.key_objective}</div></div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Day report modal */}
      {dayModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => { setDayModal(null); setDayReport(null) }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} />
          <div style={{ position: 'relative', background: 'var(--card)', borderRadius: '28px 28px 0 0', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)', borderBottom: 'none', boxShadow: '0 -12px 40px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: `linear-gradient(90deg,transparent,var(--accent),transparent)`, flexShrink: 0 }} />
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-subtle)' }} />
            </div>
            <div style={{ padding: '4px 20px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>تقرير اليوم</div>
                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--text-primary)', lineHeight: 1 }}>{dayModal.dayNumber}</div>
                {dayReport?.sessionDate && <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 4, fontFamily: F }}>{new Date(dayReport.sessionDate).toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}</div>}
              </div>
              <button onClick={() => { setDayModal(null); setDayReport(null) }} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-inset)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem', flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 32px' }}>
              {dayReportLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12 }}>
                  <div style={{ width: 28, height: 28, border: '3px solid var(--accent-dim)', borderTopColor: G, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                  <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>جاري تحميل التقرير...</div>
                </div>
              )}
              {dayReport && !dayReportLoading && (<>
                {dayReport.summary && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 20, background: `${dayReport.summary.color}12`, border: `1px solid ${dayReport.summary.color}30`, marginBottom: 18 }}>
                    <span style={{ fontSize: '1rem' }}>{dayReport.summary.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: '.85rem', color: dayReport.summary.color }}>{dayReport.summary.text}</span>
                  </div>
                )}
                {/* Session */}
                {dayReport.session ? (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: '.68rem', fontWeight: 700, color: G, letterSpacing: 2, textTransform: 'uppercase' }}>🏋️ أداء التمرين</div>
                      {dayReport.session.compliance_pct != null && (
                        <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '.95rem', color: dayReport.session.compliance_pct >= 80 ? '#22c55e' : dayReport.session.compliance_pct >= 60 ? '#f97316' : '#ef4444' }}>
                          {dayReport.session.compliance_pct}%
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                      {[['التكرارات', dayReport.session.total_actual_reps || 0, 'var(--text-primary)'], ['المجموعات', dayReport.session.total_sets || 0, G], ['الهدف', dayReport.session.total_target_reps || '—', 'var(--text-muted)']].map(([l, v, c2]) => (
                        <div key={l} style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                          <div style={{ fontWeight: 900, fontSize: '1rem', color: c2, fontFamily: 'monospace', lineHeight: 1 }}>{v}</div>
                          <div style={{ fontSize: '.6rem', color: 'var(--text-muted)', marginTop: 4 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '12px 14px', marginBottom: 10 }}>
                      {(dayReport.session.exercises || []).slice(0, 6).map((ex, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <div>
                            <div style={{ fontSize: '.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{ex.name?.split('|')[0].trim()}</div>
                            {ex.muscle && <div style={{ fontSize: '.63rem', color: 'var(--text-muted)', marginTop: 1 }}>{ex.muscle}</div>}
                          </div>
                          <div style={{ textAlign: 'end', flexShrink: 0 }}>
                            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#22c55e', fontSize: '.82rem' }}>{ex.reps} تكرار</div>
                            <div style={{ fontSize: '.6rem', color: 'var(--text-muted)' }}>{ex.sets} مجموعة</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { router.push(dayReport.session.id ? '/dashboard?session=' + dayReport.session.id : '/dashboard'); setDayModal(null) }}
                      style={{ width: '100%', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', color: G, borderRadius: 11, padding: '10px', fontFamily: F, fontWeight: 700, cursor: 'pointer', fontSize: '.82rem', letterSpacing: .5 }}>
                      عرض التفاصيل الكاملة في السجل ←
                    </button>
                  </div>
                ) : dayReport.dayRecord?.checkin_status === 'completed' ? (
                  <div style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '20px', marginBottom: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>🏋️</div>
                    <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      التمرين مكتمل لكن تفاصيل المجموعات غير متوفرة<br />
                      <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>بيانات التمارين تُحفظ منذ v5.6</span>
                    </div>
                    <button onClick={() => { router.push('/dashboard'); setDayModal(null) }}
                      style={{ marginTop: 12, background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', color: G, borderRadius: 10, padding: '8px 18px', fontFamily: F, fontWeight: 700, cursor: 'pointer', fontSize: '.78rem' }}>
                      عرض السجل ←
                    </button>
                  </div>
                ) : null}
                {/* Meals */}
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#22c55e', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>🍽️ التغذية</div>
                  {dayReport.meals?.length > 0 ? (<>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7, marginBottom: 10 }}>
                      {[['السعرات', dayReport.nutrition?.totalCals, G], ['بروتين', dayReport.nutrition?.totalProtein + 'g', '#3b82f6'], ['كارب', dayReport.nutrition?.totalCarbs + 'g', '#f97316'], ['دهون', dayReport.nutrition?.totalFat + 'g', '#22c55e']].map(([l, v, c2]) => (
                        <div key={l} style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, color: c2, fontFamily: 'monospace', fontSize: '.78rem', lineHeight: 1 }}>{v}</div>
                          <div style={{ fontSize: '.58rem', color: 'var(--text-muted)', marginTop: 3 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '10px 14px', marginBottom: 10 }}>
                      {dayReport.meals.slice(0, 5).map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                          <div>
                            <div style={{ fontSize: '.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>{m.meal_name || m.meal_type}</div>
                            <div style={{ fontSize: '.63rem', color: 'var(--text-muted)' }}>{m.meal_type}</div>
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: '.76rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{m.total_calories || 0} سعرة</div>
                        </div>
                      ))}
                    </div>
                  </>) : (
                    <div style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '20px', textAlign: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>لم تسجّل وجبات لهذا اليوم</div>
                    </div>
                  )}
                  <button onClick={() => { router.push('/meals' + (dayReport.sessionDate ? '?date=' + dayReport.sessionDate : '')); setDayModal(null) }}
                    style={{ width: '100%', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', borderRadius: 11, padding: '10px', fontFamily: F, fontWeight: 700, cursor: 'pointer', fontSize: '.82rem' }}>
                    {dayReport.meals?.length > 0 ? 'عرض كل الوجبات ←' : 'سجّل وجبات هذا اليوم ←'}
                  </button>
                </div>
              </>)}
            </div>
          </div>
        </div>
      )}

      <BottomTabs active="dashboard" />
    </div>
  )
}
