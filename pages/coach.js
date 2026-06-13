import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { BottomTabs } from '../components/Nav'

const DAILY_LIMIT = 20
const CHAT_KEY = 'gcc_coach_chat'
const gold = '#111111'

function saveChat(userId, messages) {
  try {
    const stored = JSON.parse(localStorage.getItem(CHAT_KEY) || '{}')
    stored[userId] = { messages, savedAt: Date.now() }
    localStorage.setItem(CHAT_KEY, JSON.stringify(stored))
  } catch(e) {}
}

function loadChat(userId) {
  try {
    const stored = JSON.parse(localStorage.getItem(CHAT_KEY) || '{}')
    const userChat = stored[userId]
    if (!userChat) return null
    // Keep history for 7 days
    if (Date.now() - userChat.savedAt > 7 * 24 * 60 * 60 * 1000) return null
    return userChat.messages
  } catch(e) { return null }
}

export default function CoachPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [usageCount, setUsageCount] = useState(0)
  const [profile, setProfile] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/'); return }
      const u = session.user
      setUser(u)

      // Load profile for context
      try {
        const r = await fetch(`/api/profile?userId=${u.id}`)
        const d = await r.json()
        setProfile(d.profile)
      } catch(e) {}

      // Load usage count
      try {
        const ur = await fetch(`/api/coach?action=usage&userId=${u.id}`)
        const ud = await ur.json()
        setUsageCount(ud.count || 0)
        const remaining = DAILY_LIMIT - (ud.count || 0)

        // Restore saved chat history
        const saved = loadChat(u.id)
        if (saved && saved.length > 0) {
          setMessages(saved)
        } else {
          // First visit — show welcome message
          setMessages([{
            role: 'assistant',
            text: `أهلاً! أنا مدرّبك الشخصي. 💪\n\nاسألني عن:\n• تمارين الجيم والبيت\n• التغذية وحساب السعرات\n• الأكل الخليجي وكيف تتحكم فيه\n• التعافي والنوم\n\nعندي ${remaining} رد متبقي اليوم.`,
            time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
          }])
        }
      } catch(e) {}

      setInitialized(true)
    })
  }, [])

  // Save chat whenever messages change
  useEffect(() => {
    if (!user?.id || !initialized || messages.length === 0) return
    saveChat(user.id, messages)
  }, [messages, user?.id, initialized])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading || usageCount >= DAILY_LIMIT) return

    const userMsg = {
      role: 'user', text,
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    }
    setMessages(p => [...p, userMsg])
    setInput('')
    if (inputRef.current) { inputRef.current.style.height = 'auto' }
    setLoading(true)

    try {
      const r = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          message: text,
          profile,
          history: messages.slice(-8).map(m => ({ role: m.role, content: m.text }))
        })
      })
      const d = await r.json()
      const reply = r.status === 429
        ? 'وصلت لحد الردود اليومية (20 رد). رجّع باكر 💪'
        : d.reply || 'تعذر الاتصال. حاول مرة ثانية.'

      setMessages(p => [...p, {
        role: 'assistant', text: reply,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
      }])
      if (r.status !== 429) setUsageCount(p => p + 1)
    } catch(e) {
      setMessages(p => [...p, { role: 'assistant', text: 'تعذر الاتصال. حاول مرة ثانية.', time: '' }])
    }
    setLoading(false)
  }

  const clearChat = () => {
    if (!confirm('مسح كل المحادثة؟')) return
    if (user?.id) {
      try {
        const stored = JSON.parse(localStorage.getItem(CHAT_KEY) || '{}')
        delete stored[user.id]
        localStorage.setItem(CHAT_KEY, JSON.stringify(stored))
      } catch(e) {}
    }
    setMessages([{
      role: 'assistant',
      text: `تم مسح المحادثة. كيف أقدر أساعدك؟ 💪`,
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    }])
  }

  const QUICK = [
    'كيف أحسب بروتيني اليومي؟',
    'تمرين كور للمبتدئين',
    'كم سعرة في الكبسة؟',
    'كيف أحسّن نومي للتعافي؟',
  ]

  const remaining = DAILY_LIMIT - usageCount

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', color: 'var(--text-primary)', direction: 'rtl', display: 'flex', flexDirection: 'column' }}>

      {/* IMG-PLACEHOLDER: coach-hero · 21:9 · AI coach hero banner */}
      <div className="img-placeholder" style={{width:'100%',aspectRatio:'21/9',borderRadius:'0 0 24px 24px',flexShrink:0}}/>

      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBlockEnd: '1px solid rgba(0,0,0,0.07)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem', padding: '4px 8px', flexShrink: 0 }}>←</button>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>🤖</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Tajawal',sans-serif", fontWeight: 800, fontSize: '.92rem' }}>مدرّبك الشخصي</div>
          <div style={{ fontSize: '.65rem', color: 'rgba(0,0,0,0.25)', fontFamily: "'Tajawal',sans-serif" }}>
            {remaining > 0 ? `${remaining} رد متبقي اليوم` : 'وصلت لحد اليوم — رجّع باكر'}
          </div>
        </div>
        {/* Usage indicator */}
        <div style={{ width: 60, display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
          <div style={{ height: 3, background: 'rgba(0,0,0,0.10)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (usageCount / DAILY_LIMIT) * 100)}%`, background: remaining < 5 ? '#ef4444' : '#111111', transition: 'width .3s', borderRadius: 10 }} />
          </div>
          <div style={{ fontSize: '.6rem', color: 'rgba(0,0,0,0.25)', textAlign: 'start', fontFamily: "'IBM Plex Mono',monospace" }}>{usageCount}/{DAILY_LIMIT}</div>
        </div>
        {/* Clear chat button */}
        {messages.length > 1 && (
          <button onClick={clearChat} style={{ background: 'none', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: '.72rem', fontFamily: "'Tajawal',sans-serif", flexShrink: 0 }}>
            مسح
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 160 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end', marginBottom: 14, alignItems: 'flex-end', gap: 8 }}>
            {m.role === 'assistant' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem', flexShrink: 0, marginBottom: 2 }}>🤖</div>
            )}
            <div style={{ maxWidth: '80%' }}>
              <div style={{
                background: m.role === 'user' ? 'rgba(0,0,0,0.05)' : 'var(--card)',
                border: `1px solid ${m.role === 'user' ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                padding: '11px 15px'
              }}>
                <div style={{ fontFamily: "'Tajawal',sans-serif", fontSize: '.88rem', lineHeight: 1.75, whiteSpace: 'pre-wrap', color: m.role === 'user' ? 'var(--text-primary)' : 'var(--text-primary)' }}>{m.text}</div>
              </div>
              {m.time && <div style={{ fontSize: '.62rem', color: 'rgba(0,0,0,0.20)', marginTop: 4, paddingInlineEnd: 4, paddingInlineStart: 4 }}>{m.time}</div>}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14, gap: 8, alignItems: 'flex-end' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem', flexShrink: 0 }}>🤖</div>
            <div style={{ background: 'var(--card)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '4px 18px 18px 18px', padding: '14px 18px', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#111111', animation: `bounce .9s ${i * .15}s infinite ease-in-out` }} />
              ))}
              <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts — show only if first message */}
      {messages.length <= 1 && !loading && (
        <div style={{ padding: '0 14px 10px', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {QUICK.map(q => (
            <button key={q} onClick={() => setInput(q)} style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.10)', color: 'var(--text-primary)', padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: "'Tajawal',sans-serif", fontSize: '.76rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{ position: 'fixed', bottom: 64, insetInlineStart: 0, insetInlineEnd: 0, background: 'var(--surface)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(0,0,0,0.08)', padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={remaining <= 0 ? 'وصلت لحد اليوم — رجّع باكر' : 'اسألني عن التمرين أو التغذية...'}
          disabled={remaining <= 0}
          rows={1}
          style={{ flex: 1, background: 'rgba(0,0,0,0.04)', border: `1px solid ${remaining <= 0 ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.18)'}`, color: 'var(--text-primary)', padding: '11px 14px', borderRadius: 14, outline: 'none', fontFamily: "'Tajawal',sans-serif", fontSize: '.88rem', resize: 'none', direction: 'rtl', lineHeight: 1.55, overflow: 'hidden', maxHeight: 100, transition: 'border .2s' }}
        />
        <button onClick={send} disabled={!input.trim() || loading || remaining <= 0}
          style={{ width: 44, height: 44, borderRadius: 12, background: input.trim() && !loading && remaining > 0 ? '#111111' : 'rgba(0,0,0,0.04)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !loading && remaining > 0 ? 'pointer' : 'not-allowed', flexShrink: 0, transition: 'background .2s', fontSize: '1.1rem', color: input.trim() && !loading && remaining > 0 ? '#FFFFFF' : 'var(--text-secondary)' }}>
          ←
        </button>
      </div>

      <div style={{ height: 'calc(64px + env(safe-area-inset-bottom))' }} />
      <BottomTabs active="coach" />
    </div>
  )
}
