import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

const G = '#CBA23B'

export default function Landing() {
  const [timeLeft, setTimeLeft] = useState(900)
  const [openFaq, setOpenFaq] = useState(null)

  // Countdown persists across refreshes
  useEffect(() => {
    const key = 'gtc_end'
    let end = +localStorage.getItem(key)
    if (!end || end < Date.now()) { end = Date.now() + 15 * 60 * 1000; localStorage.setItem(key, end) }
    const tick = () => setTimeLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)))
    tick(); const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Scroll reveal
  useEffect(() => {
    const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.style.opacity = '1'; e.target.style.transform = 'translateY(0)' } }), { threshold: 0.08 })
    document.querySelectorAll('.rv').forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)'; el.style.transition = 'opacity .55s ease, transform .55s ease'; obs.observe(el) })
    return () => obs.disconnect()
  }, [])

  const mm = Math.floor(timeLeft / 60).toString().padStart(2, '0')
  const ss = (timeLeft % 60).toString().padStart(2, '0')

  const faqs = [
    ['هل البرنامج مناسب للمبتدئين؟', 'نعم. البرنامج يبدأ بتقييم مستواك الحالي ويبني عليه. سواء ما دخلت جيم من قبل أو كنت نشيطاً — البرنامج يتكيف.'],
    ['ماذا لو فاتني أيام؟', 'هذا بالضبط ما يفرق GYM TRACKER GCC. إذا غبت يوماً أو أكثر، النظام يعدّل ويعيدك للمسار تدريجياً. ما في "انتهى كل شيء".'],
    ['هل يلزمني جيم؟', 'لا. البرنامج يتكيف مع ما متاح عندك — جيم متكامل، دمبل فقط، أو وزن الجسم في البيت.'],
    ['كيف يعمل المدرب الذكي؟', 'مدرب متخصص في اللياقة والتغذية الخليجية، يرد فوراً بالعربي على أسئلتك المتعلقة بالتمرين والأكل والتعافي.'],
    ['هل التطبيق آمن وخاص؟', 'بياناتك محمية ومشفرة. تحليل الجسم بالصورة اختياري — تقدر تحصل على نفس النتائج عبر القياسات فقط.'],
    ['ماذا بعد الـ 21 يوم؟', 'النظام يقيّم تقدمك ويوصي بالمرحلة التالية. الاشتراك مستمر شهرياً وتحصل على برامج جديدة باستمرار.'],
    ['متى أحصل على الدخول؟', 'بعد تأكيد الاشتراك نتواصل معك خلال 24 ساعة لتفعيل حسابك.'],
  ]

  const F = "'Tajawal', 'IBM Plex Mono', sans-serif"
  const btn = {display:'flex',alignItems:'center',justifyContent:'center',gap:10,background:G,color:'#080807',padding:'17px 36px',borderRadius:14,fontFamily:"'Tajawal',sans-serif",fontWeight:900,fontSize:'1.05rem',border:'none',cursor:'pointer',textDecoration:'none',width:'100%',maxWidth:420,margin:'0 auto',boxShadow:'0 8px 40px rgba(203,162,59,0.28)',transition:'all .2s'}

  return (
    <>
      <Head>
        <title>GYM TRACKER GCC — حوّل جسمك خلال 21 يوماً</title>
        <meta name="description" content="التطبيق الأول في الخليج لبناء عادة التمرين الحقيقية."/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet"/>
      </Head>

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{background:#080807;color:#ECE3CF;font-family:'Tajawal',sans-serif;direction:rtl;overflow-x:hidden;line-height:1.65}
        a{text-decoration:none;color:inherit}
        .mx{max-width:700px;margin:0 auto;padding:0 20px}
        .sec{padding:72px 0}
        .dv{height:1px;background:linear-gradient(90deg,transparent,rgba(203,162,59,0.2),transparent)}
        .card{background:#111009;border:1px solid rgba(203,162,59,0.12);border-radius:20px;padding:28px}
        .xl{font-size:clamp(2rem,6.5vw,4rem);font-weight:900;line-height:1.05}
        .lg{font-size:clamp(1.4rem,3.5vw,2.2rem);font-weight:800;line-height:1.2}
        .md{font-size:clamp(1rem,2.5vw,1.3rem);font-weight:700;line-height:1.3}
        .lbl{font-size:.68rem;font-weight:700;letter-spacing:3.5px;text-transform:uppercase;color:#6B5F47}
        .muted{color:#6B5F47;font-size:.88rem;line-height:1.75}
        .gold{color:#CBA23B}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        .glow{width:7px;height:7px;border-radius:50%;background:#CBA23B;display:inline-block;animation:pulse 2s infinite}
        .sympt{display:flex;align-items:flex-start;gap:14px;padding:18px 20px;border-radius:14px;background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.04);margin-bottom:10px;transition:border-color .2s}
        .sympt:hover{border-color:rgba(203,162,59,0.15)}
        .phase{border-radius:20px;padding:26px 28px;margin-bottom:12px}
        .ph1{background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.18)}
        .ph2{background:rgba(203,162,59,0.07);border:1px solid rgba(203,162,59,0.25)}
        .ph3{background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.18)}
        .phitem{display:flex;align-items:flex-start;gap:9px;font-size:.84rem;margin-top:9px}
        .phitem::before{content:'✓';color:#CBA23B;font-weight:900;flex-shrink:0;margin-top:1px}
        .bene{display:flex;align-items:flex-start;gap:16px;padding:20px 22px;background:#111009;border:1px solid rgba(203,162,59,0.08);border-radius:16px;margin-bottom:10px;transition:all .2s}
        .bene:hover{border-color:rgba(203,162,59,0.22);transform:translateX(-3px)}
        .bnum{font-size:1.7rem;font-weight:900;color:rgba(203,162,59,0.18);font-family:'IBM Plex Mono',monospace;flex-shrink:0;line-height:1;min-width:34px}
        .fgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .fcard{border-radius:18px;padding:22px}
        .fitem{display:flex;align-items:flex-start;gap:9px;font-size:.85rem;line-height:1.5;margin-top:11px}
        .ctbl{width:100%;border-collapse:collapse}
        .ctbl th,.ctbl td{padding:13px 11px;font-size:.8rem;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center}
        .ctbl th{font-weight:700;font-size:.7rem;letter-spacing:1px;color:#6B5F47}
        .ctbl td:first-child{text-align:right;font-weight:600}
        .ctbl tr:last-child td{border-bottom:none}
        .cus{color:#CBA23B;font-weight:800}
        .tst{background:#111009;border:1px solid rgba(203,162,59,0.1);border-radius:18px;padding:24px;margin-bottom:11px;position:relative}
        .tst::before{content:'"';position:absolute;top:10px;left:16px;font-size:5rem;line-height:1;color:rgba(203,162,59,0.07);font-family:Georgia,serif;pointer-events:none}
        .sbar{position:fixed;bottom:0;left:0;right:0;z-index:200;background:rgba(8,8,7,.97);backdrop-filter:blur(20px);border-top:1px solid rgba(203,162,59,.14);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px}
        @media(max-width:560px){.fgrid{grid-template-columns:1fr}.sec{padding:52px 0}}
      `}</style>

      {/* COUNTDOWN BAR */}
      <div style={{background:'linear-gradient(90deg,rgba(203,162,59,.12),rgba(203,162,59,.06),rgba(203,162,59,.12))',borderBottom:'1px solid rgba(203,162,59,.18)',padding:'10px 20px',textAlign:'center',fontSize:'.82rem',fontWeight:700}}>
        ⚡ &nbsp;سعر التأسيس ينتهي خلال&nbsp;
        <span style={{color:G,fontFamily:"'IBM Plex Mono',monospace",fontSize:'.95rem',letterSpacing:1}}>{mm}:{ss}</span>
        &nbsp; — 149 ر.س بدلاً من 299 ر.س
      </div>

      {/* NAV */}
      <nav style={{position:'sticky',top:0,zIndex:100,background:'rgba(8,8,7,.95)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(203,162,59,.08)',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontWeight:900,fontSize:'1.05rem',letterSpacing:1}}>GYM<span style={{color:G}}>TRACKER</span> GCC</div>
        <a href="#checkout" style={{background:'transparent',border:'1px solid rgba(203,162,59,.3)',color:G,padding:'10px 20px',borderRadius:11,fontFamily:"'Tajawal',sans-serif",fontWeight:700,fontSize:'.88rem',cursor:'pointer'}}>ابدأ الآن</a>
      </nav>

      {/* ── HERO ── */}
      <section className="sec" style={{position:'relative',overflow:'hidden',paddingTop:64,paddingBottom:80}}>
        <div style={{position:'absolute',top:-80,left:'50%',transform:'translateX(-50%)',width:700,height:500,background:'radial-gradient(ellipse,rgba(203,162,59,.055) 0%,transparent 68%)',pointerEvents:'none'}}/>
        <div className="mx" style={{textAlign:'center',position:'relative'}}>
          <div className="rv" style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(203,162,59,.1)',border:'1px solid rgba(203,162,59,.22)',borderRadius:100,padding:'6px 14px',fontSize:'.73rem',fontWeight:700,color:G,marginBottom:22}}>
            <span className="glow"/> الباقة التأسيسية · أول 500 عضو فقط
          </div>
          <h1 className="xl rv" style={{marginBottom:14}}>لسنين وأنت<br/><span className="gold">تبدأ وتوقف.</span></h1>
          <p className="rv" style={{fontSize:'1.05rem',color:'#6B5F47',maxWidth:480,margin:'0 auto 10px',lineHeight:1.7}}>
            المشكلة مو في إرادتك.<br/>المشكلة إن ما عندك <strong style={{color:'#ECE3CF'}}>نظام حقيقي يحاسبك ويتكيف معك.</strong>
          </p>
          <div className="rv" style={{display:'inline-flex',alignItems:'center',gap:14,background:'rgba(203,162,59,.07)',border:'1px solid rgba(203,162,59,.18)',borderRadius:14,padding:'14px 22px',margin:'26px auto'}}>
            <div>
              <div style={{fontSize:'2.4rem',fontWeight:900,color:G,lineHeight:1,fontFamily:"'IBM Plex Mono',monospace"}}>149</div>
              <div style={{fontSize:'.78rem',color:'#6B5F47'}}>ر.س / شهر</div>
            </div>
            <div style={{borderRight:'1px solid rgba(255,255,255,.08)',paddingRight:16,textAlign:'right'}}>
              <div style={{fontSize:'.95rem',color:'#6B5F47',textDecoration:'line-through'}}>299 ر.س</div>
              <div style={{fontSize:'.72rem',color:G,fontWeight:700}}>وفّر 150 ر.س</div>
              <div style={{fontSize:'.68rem',color:'#6B5F47'}}>عرض محدود</div>
            </div>
          </div>
          <div className="rv">
            <a href="#checkout" style={btn}>ابدأ برنامجي الآن 🔥</a>
            <div style={{fontSize:'.73rem',color:'#6B5F47',marginTop:12}}>✓ برنامج مخصص بالذكاء · ✓ أكل خليجي · ✓ دخول فوري</div>
          </div>
          <div className="rv" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginTop:48}}>
            {[['21','يوم للتغيير'],['100%','مخصص لجسمك'],['GCC','مطبخ خليجي']].map(([v,l])=>(
              <div key={l} className="card" style={{padding:'18px 12px',textAlign:'center'}}>
                <div style={{fontSize:'1.7rem',fontWeight:900,color:G,lineHeight:1,fontFamily:"'IBM Plex Mono',monospace"}}>{v}</div>
                <div style={{fontSize:'.7rem',color:'#6B5F47',marginTop:5}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="dv"/>

      {/* ── PAIN ── */}
      <section className="sec">
        <div className="mx">
          <div className="lbl rv" style={{marginBottom:14}}>هل هذا أنت؟</div>
          <h2 className="lg rv" style={{marginBottom:6}}>متى أصبح التمرين<br/><span className="gold">"بكرة أبدأ"؟</span></h2>
          <p className="muted rv" style={{marginBottom:32}}>كل هذه الأنماط تعيشها — وكلها تأتي من نفس المشكلة.</p>
          {[
            ['📱','تشترك في التطبيقات وتتركها بعد أسبوع','اشتريت اشتراكات، شاهدت يوتيوب — لكن ما ثبّتت أكثر من أسبوعين.'],
            ['🍔','تتمرن ثم تكافئ نفسك وتخرب الحساب','أسبوع التزام — عطلة نهاية الأسبوع تمحو كل شيء وتبدأ من الصفر.'],
            ['🥗','التغذية مترجمة من أمريكا — ما تلائم أكلنا','تقول أكل كبسة؟ — يعطيك علامات استفهام. ما في حل للمطبخ الخليجي.'],
            ['📉','تغيّب يوم واحد وتحس إنك خسرت كل شيء','مناسبة، سفر، يوم تعبان — وتقرر إنك ستبدأ من الأول الأسبوع الجاي.'],
            ['🏋️','كل شخص يقول شيء مختلف — ضعت في التعليمات','كارديو أو وزن؟ كيتو أو كارب؟ ما تعرف من تصدق.'],
          ].map(([icon,title,desc])=>(
            <div key={title} className="sympt rv">
              <div style={{fontSize:'1.25rem',flexShrink:0,marginTop:3}}>{icon}</div>
              <div>
                <div style={{fontWeight:700,fontSize:'.93rem',marginBottom:5}}>{title}</div>
                <div style={{fontSize:'.8rem',color:'#6B5F47',lineHeight:1.55}}>{desc}</div>
              </div>
            </div>
          ))}
          <blockquote className="rv" style={{borderRight:`3px solid ${G}`,padding:'14px 20px',marginTop:28,fontStyle:'italic',color:'#6B5F47',fontSize:'.9rem',lineHeight:1.7}}>
            "ما كنت هكذا دائماً... أصبحت أبدأ وأوقف، أبدأ وأوقف، حتى ظننت إن الاستمرار مو من طبيعتي."
          </blockquote>
        </div>
      </section>

      <div className="dv"/>

      {/* ── ROOT PROBLEM ── */}
      <section className="sec">
        <div className="mx">
          <div className="lbl rv" style={{marginBottom:14}}>سبب المشكلة الحقيقي</div>
          <h2 className="lg rv" style={{marginBottom:14}}>المشكلة مو في إرادتك.<br/><span className="gold">المشكلة غياب النظام الكامل.</span></h2>
          <p className="muted rv" style={{marginBottom:32}}>في علم السلوك، الالتزام ما يأتي من الحماس — يأتي من البنية التي ترشدك يومياً وتتكيف معك.</p>
          <div className="card rv" style={{marginBottom:16}}>
            <div className="md" style={{marginBottom:20,textAlign:'center'}}>دائرة "أبدأ وأوقف" المتكررة</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[['01','حماس البداية','تشتري ملابس، تتابع محتوى، تبدأ بطاقة عالية.','rgba(203,162,59,0.18)'],['02','أول عائق','يوم مشغول، مناسبة عيلية، تعب — تغيب يومين.','rgba(203,162,59,0.18)'],['03','الشعور بالفشل','"خربت كل شيء — بكرة أبدأ من الصفر."','rgba(203,162,59,0.18)'],['04','توقف كامل','وتكرر نفس الدائرة الشهر القادم.','rgba(239,68,68,0.25)']].map(([n,t,d,c])=>(
                <div key={n} style={{background:'#111009',border:`1px solid ${n==='04'?'rgba(239,68,68,0.2)':'rgba(203,162,59,0.08)'}`,borderRadius:14,padding:20}}>
                  <div style={{fontSize:'1.8rem',fontWeight:900,color:c,fontFamily:"'IBM Plex Mono',monospace",lineHeight:1,marginBottom:8}}>{n}</div>
                  <div style={{fontWeight:700,fontSize:'.9rem',marginBottom:5,color:n==='04'?'#ef4444':'#ECE3CF'}}>{t}</div>
                  <div style={{fontSize:'.78rem',color:'#6B5F47'}}>{d}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card rv" style={{background:'rgba(239,68,68,.04)',border:'1px solid rgba(239,68,68,.2)'}}>
            <div className="md" style={{marginBottom:10}}>ماذا لو استمرت الدائرة؟</div>
            <p className="muted" style={{marginBottom:16}}>سنة وأنت في نفس المكان. الجسم اللي تريده يبتعد كل يوم تؤجله.</p>
            {['صحة تتراجع ببطء دون أن تحس','ثقة بالنفس تنهار مع كل بداية فاشلة','الجسم اللي تريده يصبح حلماً بعيداً'].map(t=>(
              <div key={t} style={{fontSize:'.84rem',display:'flex',gap:10,marginBottom:6}}><span style={{color:'#ef4444',flexShrink:0}}>✗</span>{t}</div>
            ))}
          </div>
        </div>
      </section>

      <div className="dv"/>

      {/* ── SOLUTION ── */}
      <section className="sec" style={{background:'linear-gradient(180deg,transparent,rgba(203,162,59,.025),transparent)'}}>
        <div className="mx">
          <div className="lbl rv" style={{marginBottom:14}}>الحل</div>
          <h2 className="lg rv" style={{marginBottom:14}}>GYM TRACKER GCC<br/><span className="gold">نظامك الشخصي للتحول الحقيقي.</span></h2>
          <p className="muted rv" style={{marginBottom:36}}>مو مجرد تطبيق تتبع. <strong style={{color:'#ECE3CF'}}>مدرب ذكي يعرف جسمك، يفهم أكلك الخليجي، ويبني خطتك يومياً</strong> بناءً على ما حصل بالفعل.</p>
          {[
            ['الأيام 1 – 7','ph1','rgba(239,68,68,.12)','#ef4444','بناء الأساس الحقيقي','تحليل جسمك الفعلي — قياسات + هدف + مستوى. برنامج مخصص من اليوم الأول.',['فهم جسمك وأين أنت الآن بالأرقام','برنامج تمرين خليجي (جيم أو بيت)','خطة تغذية من أكل تعرفه — كبسة، مندي، حمص، شاورما']],
            ['الأيام 8 – 14 ← المرحلة الأهم','ph2','rgba(203,162,59,.12)',G,'النظام يتكيف معك — لا يعاقبك','فاتك يوم؟ عندك مناسبة؟ النظام يعدّل ويكمل.',['محاسبة يومية ذكية — تقدير لا مثالية','مدرب ذكي بالعربي يرد فوراً','الخطة تتكيف مع حياتك']],
            ['الأيام 15 – 21','ph3','rgba(34,197,94,.1)','#22c55e','التحول يصبح عادة','قياس النتائج وتوصية المرحلة التالية.',['قياس النتائج الحقيقية بالأرقام','توصية الباقة التالية بناءً على تقدمك','أنت الآن تعرف كيف تستمر']],
          ].map(([badge,cls,bg,color,title,desc,items])=>(
            <div key={badge} className={`phase ${cls} rv`}>
              <div style={{display:'inline-block',padding:'4px 13px',borderRadius:100,fontSize:'.68rem',fontWeight:700,letterSpacing:.8,marginBottom:12,background:bg,color}}>{badge}</div>
              <div className="md" style={{marginBottom:6}}>{title}</div>
              <p className="muted" style={{marginBottom:12}}>{desc}</p>
              {items.map(i=><div key={i} className="phitem">{i}</div>)}
            </div>
          ))}
        </div>
      </section>

      <div className="dv"/>

      {/* ── BENEFITS ── */}
      <section className="sec">
        <div className="mx">
          <div className="lbl rv" style={{marginBottom:14}}>ما ستحصل عليه</div>
          <h2 className="lg rv" style={{marginBottom:30}}>6 تحولات حقيقية<br/><span className="gold">خلال 21 يوماً</span></h2>
          {[
            ['01','برنامج تمرين مخصص 100% لجسمك','ليس برنامجاً عاماً. برنامج يعرف وزنك، مستواك، معداتك، والوقت المتاح عندك.'],
            ['02','تغذية من مطبخك الخليجي الحقيقي','أول تطبيق يحتوي الكبسة، المندي، الحمص، الفول، والشاورما بقيم غذائية دقيقة.'],
            ['03','نظام يتكيف مع حياتك — مو يوقفها','فاتك يوم؟ مناسبة؟ النظام يعدّل ويعيدك بشكل تدريجي. ما في "من الصفر".'],
            ['04','مدرب ذكي بالعربي 24/7','اسأل عن التمرين، التغذية، التعافي — ردود متخصصة، بأسلوب خليجي.'],
            ['05','محاسبة يومية بالأرقام الحقيقية','وزنك، خصرك، تمارينك، سعراتك — كل شيء في مكان. الأرقام لا تكذب.'],
            ['06','تحليل الجسم — مع أو بدون صورة','نسبة دهونك وأولوياتك بدقة — عبر القياسات فقط. خصوصيتك محفوظة.'],
          ].map(([n,t,d])=>(
            <div key={n} className="bene rv">
              <div className="bnum">{n}</div>
              <div>
                <div style={{fontWeight:700,fontSize:'.93rem',marginBottom:5}}>{t}</div>
                <div style={{fontSize:'.82rem',color:'#6B5F47',lineHeight:1.65}}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="dv"/>

      {/* ── FOR/NOT FOR ── */}
      <section className="sec">
        <div className="mx">
          <div className="lbl rv" style={{marginBottom:14,textAlign:'center'}}>هذا البرنامج ليس للجميع</div>
          <div className="md rv" style={{marginBottom:26,textAlign:'center'}}>الصدق هو ما يصنع النتائج.</div>
          <div className="fgrid rv">
            <div className="fcard" style={{background:'rgba(239,68,68,.05)',border:'1px solid rgba(239,68,68,.18)'}}>
              <div style={{fontWeight:800,color:'#ef4444',fontSize:'.9rem',marginBottom:4}}>✕ مو مناسب لك إذا</div>
              {['تبحث عن حلول بدون أي جهد','تريد نتائج أسبوع بدون تغيير','غير مستعد تتحمل مسؤولية أكلك'].map(t=>(
                <div key={t} className="fitem"><span style={{color:'#ef4444',flexShrink:0}}>✗</span>{t}</div>
              ))}
            </div>
            <div className="fcard" style={{background:'rgba(34,197,94,.05)',border:'1px solid rgba(34,197,94,.18)'}}>
              <div style={{fontWeight:800,color:'#22c55e',fontSize:'.9rem',marginBottom:4}}>✓ مناسب لك تماماً إذا</div>
              {['تعبت من "بكرة أبدأ" وجاهز لنظام','تريد برنامجاً يفهم حياتك الخليجية','مستعد تلتزم 21 يوماً ولو جزئياً'].map(t=>(
                <div key={t} className="fitem"><span style={{color:'#22c55e',flexShrink:0}}>✓</span>{t}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="dv"/>

      {/* ── COMPARISON ── */}
      <section className="sec">
        <div className="mx">
          <div className="lbl rv" style={{marginBottom:14}}>المقارنة</div>
          <div className="md rv" style={{marginBottom:26}}>لماذا GYM TRACKER GCC؟</div>
          <div className="card rv" style={{overflowX:'auto',padding:0}}>
            <table className="ctbl">
              <thead><tr>
                <th style={{textAlign:'right',padding:16}}>الميزة</th>
                <th>يوتيوب/سوشيال</th><th>مدرب شخصي</th>
                <th className="cus">GYM TRACKER GCC</th>
              </tr></thead>
              <tbody>
                {[['برنامج لجسمك تحديداً','✗','✓','✓'],['أكل خليجي بالماكروز','✗','نادراً','✓'],['متاح 24/7 بالعربي','✗','✗','✓'],['يتكيف مع انقطاعك','✗','أحياناً','✓ دائماً'],['التكلفة الشهرية','مجاني','+1500 ر.س','149 ر.س']].map(([f,a,b,c])=>(
                  <tr key={f}><td>{f}</td><td style={{color:'rgba(255,255,255,.3)'}}>{a}</td><td style={{color:'rgba(255,255,255,.3)'}}>{b}</td><td className="cus">{c}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="dv"/>

      {/* ── TESTIMONIALS ── */}
      <section className="sec">
        <div className="mx">
          <div className="lbl rv" style={{marginBottom:14}}>من جربوه</div>
          <div className="md rv" style={{marginBottom:26}}>من "بكرة أبدأ"…<br/><span className="gold">إلى نتائج حقيقية</span></div>
          {[
            ['خ','خالد العنزي — الرياض','بعد 21 يوماً','أول مرة في حياتي أكمل أكثر من أسبوعين. الفرق في الميزان؟ 3.2 كجم في 21 يوم والخصر نزل 4 سم.'],
            ['م','محمد الدوسري — الكويت','الأسبوع الثالث','اللي أعجبني إنه يفهم إني آكل كبسة وشاورما. ما طالب مني آكل سلطة وبروتين شيك.'],
            ['ع','عبدالله المطيري — أبوظبي','بعد 30 يوماً','عندي مناسبة في اليوم العاشر وأكلت بدون حساب. رجعت للتطبيق قال لي "عدنا — اليوم نكمل من هنا."'],
            ['ف','فيصل الشهري — جدة','عضو مؤسس','جربت 4 تطبيقات قبله. هذا أول تطبيق يحسسني إنه مبني لي أنا — خليجي بحياة خليجية.'],
            ['س','سلطان القحطاني — الدوحة','مشترك شهرين','المدرب الذكي أعطاني برنامجاً للتمرين في الفندق ومعي 20 دقيقة فقط — في 30 ثانية.'],
          ].map(([av,name,time,text])=>(
            <div key={name} className="tst rv">
              <div style={{color:G,fontSize:'.8rem',marginBottom:8}}>★★★★★</div>
              <p style={{fontSize:'.87rem',lineHeight:1.8,marginBottom:14}}>{text}</p>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(203,162,59,.1)',border:'1px solid rgba(203,162,59,.25)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'.88rem',color:G,flexShrink:0}}>{av}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:'.83rem'}}>{name}</div>
                  <div style={{fontSize:'.7rem',color:'#6B5F47'}}>{time}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="dv"/>

      {/* ── CHECKOUT ── */}
      <section className="sec" id="checkout">
        <div className="mx">
          <div className="card rv" style={{border:'1px solid rgba(203,162,59,.28)',background:'linear-gradient(135deg,rgba(203,162,59,.06),transparent)',textAlign:'center'}}>
            <div className="lbl" style={{marginBottom:12}}>انضم الآن — الباقة التأسيسية</div>
            <h2 className="lg" style={{marginBottom:6}}>ابدأ تحولك اليوم</h2>
            <p className="muted" style={{marginBottom:24,maxWidth:380,margin:'0 auto 24px'}}>برنامجك يُبنى فور موافقتنا على اشتراكك — دخول خلال 24 ساعة.</p>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:14,marginBottom:26}}>
              <div>
                <div style={{fontSize:'3.2rem',fontWeight:900,color:G,lineHeight:1,fontFamily:"'IBM Plex Mono',monospace"}}>149</div>
                <div style={{fontSize:'.8rem',color:'#6B5F47'}}>ر.س / شهر</div>
              </div>
              <div style={{borderRight:'1px solid rgba(255,255,255,.08)',paddingRight:16,textAlign:'right'}}>
                <div style={{fontSize:'1rem',color:'#6B5F47',textDecoration:'line-through'}}>299 ر.س</div>
                <div style={{fontSize:'.75rem',color:G,fontWeight:700}}>وفّر 150 ر.س</div>
                <div style={{fontSize:'.7rem',color:'#6B5F47'}}>عرض تأسيسي محدود</div>
              </div>
            </div>
            <a href="https://gym-tracker-gcc.vercel.app" style={{...btn,marginBottom:16}}>ابدأ برنامجي الآن 🔥</a>
            <div style={{display:'flex',flexDirection:'column',gap:7,fontSize:'.73rem',color:'#6B5F47',marginBottom:24}}>
              {['برنامج مخصص بالذكاء من اليوم الأول','خطة تغذية من مطبخك الخليجي','مدرب ذكي بالعربي 24/7','دخول خلال 24 ساعة'].map(t=><div key={t}>✓ {t}</div>)}
            </div>
            <div style={{background:'linear-gradient(135deg,rgba(34,197,94,.07),rgba(203,162,59,.04))',border:'1px solid rgba(34,197,94,.18)',borderRadius:18,padding:24}}>
              <div style={{fontSize:'1.8rem',marginBottom:8}}>🛡️</div>
              <div style={{fontWeight:800,fontSize:'.95rem',marginBottom:6}}>ضمان 7 أيام كامل</div>
              <div style={{fontSize:'.82rem',color:'#6B5F47'}}>جرّب 7 أيام. إذا ما شفت فرقاً حقيقياً — نرد لك المبلغ كاملاً بدون أسئلة.</div>
            </div>
          </div>
        </div>
      </section>

      <div className="dv"/>

      {/* ── FAQ ── */}
      <section className="sec">
        <div className="mx">
          <div className="lbl rv" style={{marginBottom:14}}>أسئلة شائعة</div>
          <div className="md rv" style={{marginBottom:28}}>ردود على ما يدور في بالك</div>
          {faqs.map(([q,a],i)=>(
            <div key={i} style={{borderBottom:'1px solid rgba(255,255,255,.055)',padding:'20px 0'}} className="rv">
              <div onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{fontWeight:700,fontSize:'.93rem',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',gap:14}}>
                <span>{q}</span>
                <span style={{color:G,fontSize:'1.3rem',transition:'transform .3s',transform:openFaq===i?'rotate(45deg)':'none',flexShrink:0,lineHeight:1}}>+</span>
              </div>
              {openFaq===i&&<div style={{fontSize:'.84rem',color:'#6B5F47',lineHeight:1.8,marginTop:12}}>{a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="sec" style={{paddingBottom:120}}>
        <div className="mx" style={{textAlign:'center'}}>
          <div style={{fontSize:'2.4rem',marginBottom:16}}>💪</div>
          <h2 className="lg rv" style={{marginBottom:12}}>لا تنتظر حتى<br/><span className="gold">يصبح التأجيل عادة.</span></h2>
          <p className="muted rv" style={{maxWidth:430,margin:'0 auto 30px'}}>كل يوم تؤجله هو يوم أضفته على الطريق. البداية الحقيقية تبدأ بقرار واحد — اليوم.</p>
          <a href="#checkout" style={{...btn,margin:'0 auto 12px'}} className="rv">ابدأ تحولي — 149 ر.س فقط 🔥</a>
          <p style={{fontSize:'.72rem',color:'#6B5F47',marginTop:12}}>ضمان 7 أيام · إلغاء في أي وقت · دخول خلال 24 ساعة</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{borderTop:'1px solid rgba(255,255,255,.055)',padding:'28px 20px',textAlign:'center'}}>
        <div style={{fontWeight:900,fontSize:'.95rem',marginBottom:12}}>GYM<span style={{color:G}}>TRACKER</span> GCC</div>
        <div style={{fontSize:'.72rem',color:'#6B5F47',display:'flex',gap:22,justifyContent:'center',flexWrap:'wrap'}}>
          <a href="#">الشروط والأحكام</a><a href="#">سياسة الخصوصية</a><a href="#">تواصل معنا</a>
        </div>
        <div style={{fontSize:'.68rem',color:'rgba(255,255,255,.08)',marginTop:10}}>© 2026 GYM TRACKER GCC. جميع الحقوق محفوظة.</div>
      </footer>

      {/* STICKY BAR */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:200,background:'rgba(8,8,7,.97)',backdropFilter:'blur(20px)',borderTop:'1px solid rgba(203,162,59,.14)',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:14}}>
        <div>
          <div style={{fontSize:'.68rem',color:'#6B5F47'}}>الباقة التأسيسية</div>
          <div style={{fontWeight:900,fontSize:'1.15rem',color:G}}>149 ر.س / شهر</div>
        </div>
        <a href="#checkout" style={{...btn,width:'auto',maxWidth:'none',padding:'13px 26px',fontSize:'.9rem'}}>ابدأ الآن 🔥</a>
      </div>
    </>
  )
}
