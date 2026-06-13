import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const G = '#111111', F = "'Tajawal',sans-serif"
const DAILY_LIMIT = 20
const KEY = 'gcc_chat_v4'
const HIDE = ['/landing','/pending','/suspended','/onboarding']

const CTX = {
  '/meals':     { id:'meals',    title:'مستشار التغذية', icon:'🥗',  color:'#22c55e', intro:'أهلاً! اسألني عن الأكل والسعرات والوجبات الخليجية.', quick:['كم سعرة في الكبسة؟','أفضل فطور لخسارة الوزن؟','هل التمر مناسب؟'], scope:'التغذية' },
  '/program':   { id:'program',  title:'مدرب التمرين',   icon:'🏋️', color:G,          intro:'أهلاً! اسألني عن التمرين والأداء والبرنامج.', quick:['كيف أؤدي البلانك صح؟','كم أيام راحة أحتاج؟'], scope:'التمرين' },
  '/dashboard': { id:'progress', title:'محلل التقدم',    icon:'📊',  color:'#3b82f6', intro:'اسألني عن تقدمك وأرقامك.', quick:['لماذا توقف وزني؟','كم كجم أخسر شهرياً؟'], scope:'التقدم' },
  '/weight':    { id:'progress', title:'متابع الوزن',    icon:'⚖️',  color:'#3b82f6', intro:'اسألني عن وزنك وكيف تتحكم فيه.', quick:['متى أوزن نفسي؟','ما معنى Plateau؟'], scope:'الوزن' },
  default:      { id:'default',  title:'مدرّبك الشخصي',  icon:'🤖',  color:G,          intro:'أهلاً! اسألني عن التمرين أو الأكل الصحي.', quick:['كيف أبدأ رحلتي؟','كم سعرة أحتاج؟','تمارين للبطن؟'], scope:'اللياقة والتغذية' },
}

function getCtx(p) {
  for (const [path, c] of Object.entries(CTX)) {
    if (path !== 'default' && p.startsWith(path)) return c
  }
  return CTX.default
}

function save(uid, msgs) { try { localStorage.setItem(KEY + uid, JSON.stringify({ msgs, t: Date.now() })) } catch(e){} }
function load(uid) { try { const d = JSON.parse(localStorage.getItem(KEY + uid) || 'null'); return (!d || Date.now() - d.t > 7*86400000) ? null : d.msgs } catch(e) { return null } }

export default function ChatWidget() {
  const router = useRouter()
  const ctx = getCtx(router.pathname)
  const [open, setOpen] = useState(false)
  const [uid, setUid] = useState(null)
  const [userData, setUserData] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [usage, setUsage] = useState(0)
  const [ready, setReady] = useState(false)
  const [unread, setUnread] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const openRef = useRef(false)

  const hide = HIDE.some(p => router.pathname.startsWith(p))
  useEffect(() => { openRef.current = open }, [open])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return
      const id = session.user.id
      setUid(id); setReady(true)
      const t = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      // Load history — async IIFE inside .then()
      (async () => {
        try {
          const r = await fetch('/api/chat-history?userId=' + id)
          const d = await r.json()
          if (d.messages?.length) {
            setMsgs(d.messages.map(m => ({ role: m.role, text: m.text, t: new Date(m.created_at).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}) })))
          } else {
            const saved = load(id)
            setMsgs(saved?.length ? saved : [{ role: 'bot', text: ctx.intro, t }])
          }
        } catch(e) {
          const saved = load(id)
          setMsgs(saved?.length ? saved : [{ role: 'bot', text: ctx.intro, t }])
        }
      })()
      Promise.all([
        fetch(`/api/profile?userId=${id}`).then(r => r.json()),
        fetch(`/api/packages/status?userId=${id}`).then(r => r.json()),
        fetch(`/api/coach?action=usage&userId=${id}`).then(r => r.json()),
      ]).then(([pr, prog, ur]) => {
        const p = pr.profile || {}
        const bmi = p.weight_kg && p.height_cm ? Math.round(p.weight_kg / Math.pow(p.height_cm / 100, 2) * 10) / 10 : null
        setUserData({ weight: p.weight_kg, height: p.height_cm, goal: p.goal, bmi, bf: p.body_fat_pct, calorieTarget: p.calorie_target, programName: prog.program?.package_name, programDay: prog.program?.current_day, programTotal: prog.program?.total_days, programPct: prog.program ? Math.round(((prog.completedDays || 0) / prog.program.total_days) * 100) : null })
        setUsage(ur.count || 0)
      }).catch(() => {})
    }).catch(() => {})
  }, [])

  // Context switches silently — header/pills update, NO auto messages injected
  // (messages only sent when user explicitly types)

  useEffect(() => {
    if (!uid || !msgs.length) return
    save(uid, msgs)
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    // unread is set only inside send() after a real bot reply
  }, [msgs])

  useEffect(() => {
    if (!open) return
    setUnread(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    setTimeout(() => inputRef.current?.focus(), 180)
  }, [open])

  const send = async () => {
    const text = input.trim()
    if (!text || busy || usage >= DAILY_LIMIT || !uid) return
    const t = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    setMsgs(p => [...p, { role: 'user', text, t }])
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setBusy(true)
    // Save user message to DB (fire and forget)
    fetch('/api/chat-history', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:uid,role:'user',text,context:ctx.id})}).catch(()=>{})
    try {
      const r = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid, message: text, context: ctx.id, userData, history: msgs.slice(-8).map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text })) }) })
      const d = await r.json()
      const reply = r.status === 429 ? 'وصلت للحد اليومي. رجّع باكر 💪' : d.reply || 'تعذر الاتصال.'
      setMsgs(p => [...p, { role: 'bot', text: reply, t: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) }])
      if (r.status !== 429) setUsage(p => p + 1)
      // Save bot reply to DB
      fetch('/api/chat-history', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:uid,role:'bot',text:reply,context:ctx.id})}).catch(()=>{})
      if (!open) setUnread(true)  // badge only on real reply when chat is closed
    } catch(e) { setMsgs(p => [...p, { role: 'bot', text: 'تعذر الاتصال.', t: '' }]) }
    setBusy(false)
  }

  const clearChat = () => {
    if (!uid) return
    const t = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    const fresh = [{ role: 'bot', text: ctx.intro, t }]
    setMsgs(fresh)
    save(uid, fresh)
    // Also clear from DB
    fetch('/api/chat-history?userId=' + uid, { method: 'DELETE' }).catch(()=>{})
  }

  if (hide || !ready) return null

  const remaining = DAILY_LIMIT - usage
  const showQuick = msgs.filter(m => m.role === 'user').length === 0

  return (
    <>
      <style>{`
        @keyframes cw-pop { 0%{opacity:0;transform:scale(.85) translateY(10px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes cw-dot { 0%,100%{opacity:.3;transform:translateY(0)} 50%{opacity:1;transform:translateY(-3px)} }
        @keyframes cw-badge { 0%,100%{transform:scale(1)} 60%{transform:scale(1.3)} }
        @keyframes cw-glow { 0%,100%{box-shadow:0 2px 14px rgba(0,0,0,0.18)} 50%{box-shadow:0 4px 24px rgba(0,0,0,0.30)} }
      `}</style>

      {/* ── COMPACT FLOATING PANEL ── */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 148,
          insetInline: 14,
          width: 'min(340px, calc(100vw - 28px))',
          marginInlineStart: 'auto',
          height: 460,
          background: 'var(--card)',
          borderRadius: 18,
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          direction: 'rtl',
          fontFamily: F,
          zIndex: 9998,
          overflow: 'hidden',
          animation: 'cw-pop .22s cubic-bezier(.2,.8,.3,1)',
        }}>

          {/* HEADER */}
          <div style={{ padding: '12px 14px 10px', borderBlockEnd: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'rgba(0,0,0,0.02)' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: `rgba(0,0,0,0.05)`, border: `1.5px solid ${ctx.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.95rem', flexShrink: 0 }}>
              {ctx.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '.84rem', color: 'var(--text-primary)' }}>{ctx.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }}/>
                <div style={{ fontSize: '.6rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{remaining} رد · {ctx.scope}</div>
              </div>
            </div>
            {/* clear + close */}
            {msgs.length > 1 && (
              <button onClick={clearChat} title="مسح المحادثة" style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.28)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, flexShrink: 0, transition: 'color .15s' }}
                onMouseEnter={e => e.currentTarget.style.color='#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color='rgba(0,0,0,0.28)'}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            )}
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.35)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* MESSAGES */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row' : 'row-reverse', alignItems: 'flex-end', gap: 6 }}>
                {m.role === 'bot' && (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.05)', border: `1px solid ${ctx.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.6rem', flexShrink: 0 }}>{ctx.icon}</div>
                )}
                <div style={{
                  maxWidth: '82%',
                  background: m.role === 'user' ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.03)',
                  border: m.role === 'user' ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(0,0,0,0.06)',
                  borderInlineStart: m.role === 'bot' ? `2px solid ${ctx.color}45` : undefined,
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  padding: '8px 12px',
                }}>
                  <div style={{ fontSize: '.82rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{m.text}</div>
                  {m.t && <div style={{ fontSize: '.55rem', color: 'var(--text-secondary)', marginTop: 3, textAlign: m.role === 'user' ? 'end' : 'start' }}>{m.t}</div>}
                </div>
              </div>
            ))}
            {busy && (
              <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.05)', border: `1px solid ${ctx.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.6rem' }}>{ctx.icon}</div>
                <div style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', borderInlineStart: `2px solid ${ctx.color}45`, borderRadius: '14px 14px 14px 4px', padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(0,0,0,0.25)', animation: `cw-dot .8s ${i*.15}s ease-in-out infinite` }}/>)}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* QUICK PILLS */}
          {showQuick && (
            <div style={{ padding: '4px 12px 6px', display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
              {ctx.quick.map(q => (
                <button key={q} onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 40) }}
                  style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.10)', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: 12, cursor: 'pointer', fontFamily: F, fontSize: '.68rem', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = ctx.color + '55'; e.currentTarget.style.color = ctx.color }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.10)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* INPUT */}
          <div style={{ padding: '8px 12px 12px', borderBlockStart: '1px solid rgba(0,0,0,0.07)', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0, background: 'rgba(0,0,0,0.02)' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 72) + 'px' }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={remaining <= 0 ? 'وصلت للحد اليومي' : `اسألني عن ${ctx.scope}...`}
              disabled={remaining <= 0}
              rows={1}
              style={{ flex: 1, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.12)', color: 'var(--text-primary)', padding: '9px 12px', borderRadius: 11, fontFamily: F, fontSize: '.83rem', resize: 'none', direction: 'rtl', lineHeight: 1.5, maxHeight: 72, overflow: 'hidden', outline: 'none', transition: 'border-color .2s' }}
              onFocus={e => e.target.style.borderColor = 'rgba(17,17,17,0.35)'}
              onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.12)'}
            />
            <button onClick={send} disabled={!input.trim() || busy || remaining <= 0}
              style={{ width: 36, height: 36, borderRadius: 10, background: input.trim() && !busy && remaining > 0 ? '#111111' : 'rgba(0,0,0,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !busy && remaining > 0 ? 'pointer' : 'not-allowed', flexShrink: 0, transition: 'all .2s', color: input.trim() && !busy && remaining > 0 ? '#FFFFFF' : 'rgba(0,0,0,0.22)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── FAB BUTTON ── */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{ position: 'fixed', bottom: 82, insetInlineEnd: 18, zIndex: 9999, width: 48, height: 48, borderRadius: '50%', background: open ? 'rgba(0,0,0,0.08)' : '#111111', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s', border: '1px solid rgba(0,0,0,0.15)', animation: open ? 'none' : 'cw-glow 2.5s ease-in-out infinite' }}
      >
        {open
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
        {unread && !open && <div style={{ position: 'absolute', top: 1, insetInlineEnd: 1, width: 11, height: 11, borderRadius: '50%', background: '#ef4444', border: '2px solid var(--card)', animation: 'cw-badge 1.5s infinite' }}/>}
      </div>
    </>
  )
}
