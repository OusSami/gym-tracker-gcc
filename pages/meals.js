import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { TopNav, BottomTabs } from '../components/Nav'
import { calcNutrientGoals, fmt } from '../lib/nutrition'

const MEAL_TYPES = [
  { id:'breakfast', label:'الفطور', icon:'☀️', color:'#eab308' },
  { id:'lunch',     label:'الغداء',     icon:'🥗', color:'#22c55e' },
  { id:'dinner',    label:'العشاء',    icon:'🌙', color:'#3b82f6' },
  { id:'snack',     label:'سناك',     icon:'🍎', color:'#f97316' },
]
const todayStr = () => new Date().toISOString().split('T')[0]

// Full nutrient list with display config
const NUTRIENTS = [
  { key:'protein_g',           label:'البروتين',            unit:'g',   color:'#3b82f6', group:'macro' },
  { key:'carbs_g',             label:'الكربوهيدرات',      unit:'g',   color:'#f97316', group:'macro' },
  { key:'fat_g',               label:'الدهون الكلية',         unit:'g',   color:'#a855f7', group:'macro' },
  { key:'fiber_g',             label:'الألياف',              unit:'g',   color:'#22c55e', group:'macro' },
  { key:'sugar_g',             label:'السكر',              unit:'g',   color:'#eab308', group:'macro' },
  { key:'saturated_fat_g',     label:'الدهون المشبعة',      unit:'g',   color:'#ef4444', group:'fat' },
  { key:'polyunsaturated_fat_g',label:'الدهون المتعددة غير المشبعة',unit:'g',  color:'#06b6d4', group:'fat' },
  { key:'monounsaturated_fat_g',label:'الدهون الأحادية غير المشبعة',unit:'g',  color:'#8b5cf6', group:'fat' },
  { key:'trans_fat_g',         label:'الدهون المتحولة',          unit:'g',   color:'#dc2626', group:'fat' },
  { key:'cholesterol_mg',      label:'الكوليسترول',        unit:'mg',  color:'#b45309', group:'micro' },
  { key:'sodium_mg',           label:'الصوديوم',             unit:'mg',  color:'#0891b2', group:'micro' },
  { key:'potassium_mg',        label:'البوتاسيوم',          unit:'mg',  color:'#059669', group:'micro' },
  { key:'vitamin_a_mcg',       label:'فيتامين A',          unit:'mcg', color:'#d97706', group:'vitamin' },
  { key:'vitamin_c_mg',        label:'فيتامين C',          unit:'mg',  color:'#ea580c', group:'vitamin' },
  { key:'calcium_mg',          label:'الكالسيوم',            unit:'mg',  color:'#7c3aed', group:'mineral' },
  { key:'iron_mg',             label:'الحديد',               unit:'mg',  color:'#dc2626', group:'mineral' },
]

export default function Meals() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [goals, setGoals] = useState(null)
  const [viewDate, setViewDate] = useState(todayStr())
  const [meals, setMeals] = useState([])
  const [water, setWater] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('plan')
  const [addStep, setAddStep] = useState('type')
  const [mealType, setMealType] = useState(null)
  const [imgB64, setImgB64] = useState(null)
  const [imgMime, setImgMime] = useState('image/jpeg')
  const [imgPreview, setImgPreview] = useState(null)
  const [textInput, setTextInput] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandMeal, setExpandMeal] = useState(null)
  const [editMeal, setEditMeal] = useState(null)
  const [report, setReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportErr, setReportErr] = useState('')
  const [savedMealsHash, setSavedMealsHash] = useState(null)
  const [reportDate, setReportDate] = useState(null)
  const fileRef = useRef(null)
  const [customMeals, setCustomMeals] = useState([])
  const [gccSearch, setGccSearch] = useState('')
  const [gccResults, setGccResults] = useState([])
  const [gccLoading, setGccLoading] = useState(false)
  const [showGcc, setShowGcc] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [showRecentMeals, setShowRecentMeals] = useState(false)
  const [recentMealsByType, setRecentMealsByType] = useState({})
  const [barcode, setBarcode] = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [mealPlan, setMealPlan] = useState(null)
  const [mealPlanLoading, setMealPlanLoading] = useState(false)

  const loadDay = useCallback(async (uid, date) => {
    try {
      const r = await fetch('/api/meals?userId=' + uid + '&date=' + date)
      const d = await r.json()
      if (r.ok) { setMeals(d.meals||[]); setWater(d.water||[]) }
    } catch(e) {}
    // Load stored report for this date
    try {
      const rr = await fetch('/api/meal-report?userId=' + uid + '&date=' + date)
      const rd = await rr.json()
      if (rr.ok && rd.report) {
        setReport(rd.report)
        setSavedMealsHash(rd.meals_hash || null)
        setReportDate(date)
      } else {
        // No report for this date - clear
        setReport(null); setSavedMealsHash(null); setReportDate(null)
      }
    } catch(e) {}
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data:{session} }) => {
      if (!session?.user) { router.push('/'); return }
      setUser(session.user)
      // Load profile for personalized goals
      const pr = await fetch(`/api/profile?userId=${session.user.id}`)
      const pd = await pr.json()
      if (pr.ok && pd.profile) {
        setProfile(pd.profile)
        setGoals(calcNutrientGoals(pd.profile))
      }
      await loadDay(session.user.id, viewDate)
      // Load AI meal plan
      setMealPlanLoading(true)
      fetch('/api/packages/meal-plan?userId='+session.user.id).then(r=>r.json()).then(d=>{ if(d?.plan) setMealPlan(d) }).catch(()=>{}).finally(()=>setMealPlanLoading(false))
      // Load custom meal templates
      const cmr = await fetch('/api/custom-meals?userId='+session.user.id)
      const cmd = await cmr.json()
      if (cmr.ok) setCustomMeals(cmd.meals||[])
      // Pre-load yesterday's meals for quick copy
      try {
        const yd = new Date(); yd.setDate(yd.getDate()-1)
        const ydStr = yd.toISOString().split('T')[0]
        const yr = await fetch('/api/meals?userId='+session.user.id+'&date='+ydStr)
        const yd2 = await yr.json()
        if (yr.ok && yd2.meals?.length) {
          const byType = {}
          yd2.meals.forEach(m => {
            if (!byType[m.meal_type]) byType[m.meal_type] = []
            byType[m.meal_type].push(m)
          })
          setRecentMealsByType(byType)
        }
      } catch(e) {}
    })
  }, [])

  useEffect(() => { if (user) loadDay(user.id, viewDate) }, [viewDate, user])

  useEffect(() => {
    if (!user?.id) return
    const start = Date.now()
    return () => { const dur = Math.round((Date.now() - start) / 1000); if (dur >= 5) fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, page: 'meals', duration_seconds: dur }) }).catch(() => {}) }
  }, [user?.id])

  const copyFromDate = async (fromDate, mealTypeToCopy) => {
    if (!user) return
    try {
      const r = await fetch('/api/meals?userId=' + user.id + '&date=' + fromDate)
      const d = await r.json()
      const sourceMeals = (d.meals || []).filter(m => !mealTypeToCopy || m.meal_type === mealTypeToCopy)
      if (!sourceMeals.length) return
      for (const meal of sourceMeals) {
        // Strip DB-specific fields before reposting
        const payload = {
          userId: user.id,
          mealType: meal.meal_type,
          meal_date: viewDate,
          meal_name: meal.meal_name,
          total_calories: meal.total_calories,
          protein_g: meal.protein_g,
          carbs_g: meal.carbs_g,
          fat_g: meal.fat_g,
          fiber_g: meal.fiber_g,
          sugar_g: meal.sugar_g,
          saturated_fat_g: meal.saturated_fat_g,
          sodium_mg: meal.sodium_mg,
          potassium_mg: meal.potassium_mg,
          portion_note: meal.portion_note,
          health_score: meal.health_score,
          ingredients: meal.ingredients,
          vitamins: meal.vitamins,
          allergens: meal.allergens,
        }
        await fetch('/api/meals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }
      await loadDay(user.id, viewDate)
    } catch(e) { console.error('copyFromDate error:', e) }
  }

  // ── Totals ──
  const totals = meals.reduce((acc, m) => {
    NUTRIENTS.forEach(n => { acc[n.key] = (acc[n.key]||0) + (m[n.key]||0) })
    acc.calories = (acc.calories||0) + (m.total_calories||0)
    return acc
  }, {})
  const totalWater = water.reduce((a,w) => a+(w.amount_ml||0), 0)

  // Detect if meals changed since last report
  const currentMealsHash = meals.map(m => m.id + ':' + m.total_calories).join('|')
  const reportIsStale = report && savedMealsHash && currentMealsHash !== savedMealsHash

  const G = goals || { calories:2000, protein_g:150, carbs_g:250, fat_g:65, fiber_g:28, sugar_g:50, sodium_mg:2300, potassium_mg:3400, vitamin_a_mcg:900, vitamin_c_mg:90, calcium_mg:1000, iron_mg:8, water_ml:2500 }

  // ── Image load ──
  const loadImg = file => {
    if (!file) return
    setErr('')
    // Compress to max 1200px / 80% JPEG before storing - avoids Vercel 4.5MB body limit
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1200
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) { const ratio = Math.min(MAX/w, MAX/h); w = Math.round(w*ratio); h = Math.round(h*ratio) }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        const fr = new FileReader()
        fr.onload = e => {
          const d = e.target.result
          setImgPreview(d)
          setImgB64(d.split(',')[1])
          setImgMime('image/jpeg')
        }
        fr.readAsDataURL(blob)
      }, 'image/jpeg', 0.8)
    }
    img.onerror = () => {
      // Fallback: read as-is if canvas fails
      const fr = new FileReader()
      fr.onload = e => { const d=e.target.result; setImgPreview(d); setImgB64(d.split(',')[1]); setImgMime(file.type||'image/jpeg') }
      fr.readAsDataURL(file)
    }
    img.src = url
  }

  const analyze = async () => {
    if (!imgB64 && !textInput.trim()) { setErr('أضف صورة أو صف الوجبة.'); return }
    setAnalyzing(true); setErr('')
    let r, data
    try {
      r = await fetch('/api/meal-analyze', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ imageBase64:imgB64||null, imageMime:imgMime, textInput:textInput.trim()||null, mealType, userGoals:G })
      })
    } catch(e) { setErr('Network error: ' + e.message); setAnalyzing(false); return }
    try { data = await r.json() }
    catch(e) {
      // Non-JSON response - likely "Request Entity Too Large" or gateway error
      if (r.status === 413) setErr('الصورة كبيرة. جرب أصغر أو صف الوجبة نصاً.')
      else setErr('Server error (' + r.status + '). Try again or use the text description.')
      setAnalyzing(false); return
    }
    if (!r.ok || data.error) { setErr(data.error || 'التحليل فشل'); setAnalyzing(false); return }
    setResult(data); setAddStep('result')
    setAnalyzing(false)
  }

  const lookupBarcode = async () => {
    if (!barcode.trim()) return
    setBarcodeLoading(true); setErr('')
    try {
      const r = await fetch('/api/barcode', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({barcode:barcode.trim()}) })
      const data = await r.json()
      if (data.found) { setResult(data); setAddStep('result') }
      else setErr(data.error||'ما لقيناه في قاعدة البيانات — جرب اكتب الاسم يدوياً.')
    } catch(e) { setErr('Barcode lookup failed: ' + e.message) }
    setBarcodeLoading(false)
  }

  // Shared helper: compress image then send to barcode API for QR/barcode extraction
  const processBarcodeImage = async (file) => {
    if (!file) return
    setBarcodeLoading(true); setErr('')
    try {
      // Compress to max 1000px - barcodes need clarity, not just small size
      const compressed = await new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
          URL.revokeObjectURL(url)
          const MAX = 1000
          let w = img.width, h = img.height
          if (w > MAX || h > MAX) { const ratio = Math.min(MAX/w, MAX/h); w = Math.round(w*ratio); h = Math.round(h*ratio) }
          const canvas = document.createElement('canvas')
          canvas.width = w; canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.85)
        }
        img.onerror = reject
        img.src = url
      })
      const b64 = await new Promise(resolve => {
        const fr = new FileReader()
        fr.onload = e => resolve(e.target.result.split(',')[1])
        fr.readAsDataURL(compressed)
      })
      const r = await fetch('/api/barcode', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ imageBase64: b64, imageMime: 'image/jpeg' })
      })
      const data = await r.json()
      if (data.found) { setResult(data); setAddStep('result') }
      else setErr(data.error || 'No barcode/QR found. Try better lighting, or type the number above.')
    } catch(e) { setErr('Scan error: ' + e.message) }
    setBarcodeLoading(false)
  }

  // Trigger file input for barcode scanning - useCamera=true for camera, false for gallery
  const scanBarcodeImage = (useCamera) => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    if (useCamera) inp.setAttribute('capture', 'environment')
    // No capture attribute = gallery picker (works on all devices)
    inp.onchange = e => processBarcodeImage(e.target.files[0])
    inp.click()
  }

  const useCustomMeal = (meal) => {
    setResult({...meal}); setAddStep('result')
    // Increment usage count
    fetch('/api/custom-meals', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:meal.id}) }).catch(()=>{})
    setShowCustom(false)
  }

  const saveAsTemplate = async (finalResult) => {
    const data = finalResult || result
    if (!data || !user) return
    setSavingTemplate(true)
    await fetch('/api/custom-meals', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user.id, ...data, meal_type:mealType}) })
    const cmr = await fetch('/api/custom-meals?userId='+user.id)
    const cmd = await cmr.json()
    if (cmr.ok) setCustomMeals(cmd.meals||[])
    setSavingTemplate(false)
  }

  const saveMeal = async (finalResult) => {
    const data = finalResult || result
    if (!data||!user) return
    setSaving(true)
    try {
      const body = { userId:user.id, mealType, meal_date:viewDate, ...data }
      const r = await fetch('/api/meals', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const d = await r.json()
      if (r.ok) { await loadDay(user.id, viewDate); resetAdd(); setTab('daily') }
      else setErr(d.error||'تعذر الحفظ')
    } catch(e) { setErr('Save error: '+e.message) }
    setSaving(false)
  }

  const updateMeal = async (id, changes) => {
    await fetch('/api/meals', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, userId:user.id, ...changes }) })
    await loadDay(user.id, viewDate)
    setEditMeal(null)
  }

  const generateReport = async () => {
    if (!meals.length) { setReportErr('No meals logged yet for this day.'); return }
    setReportLoading(true); setReportErr(''); setReport(null)
    try {
      const r = await fetch('/api/meal-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meals, water_ml: totalWater, goals: G, date: viewDate, userId: user?.id })
      })
      const d = await r.json()
      if (!r.ok || d.error) { setReportErr(d.error || 'التحليل فشل'); setReportLoading(false); return }
      setReport(d.report)
      setSavedMealsHash(d.meals_hash || null)
      setReportDate(viewDate)
    } catch(e) { setReportErr('Error: ' + e.message) }
    setReportLoading(false)
  }

  const deleteMeal = async (id, type) => {
    if (!confirm('تبي تمسح؟')) return
    await fetch('/api/meals', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, type, userId:user.id }) })
    await loadDay(user.id, viewDate); setExpandMeal(null)
  }

  const logWater = async ml => {
    await fetch('/api/meals', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId:user.id, mealType:'water', amount_ml:ml, meal_date:viewDate }) })
    await loadDay(user.id, viewDate)
  }

  // GCC food database search
  const searchGcc = async (q) => {
    setGccSearch(q)
    if (!q || q.length < 2) { setGccResults([]); return }
    setGccLoading(true)
    try {
      const r = await fetch(`/api/gcc-foods?q=${encodeURIComponent(q)}&limit=8`)
      const d = await r.json()
      setGccResults(d.foods || [])
    } catch(e) { setGccResults([]) }
    setGccLoading(false)
  }

  const useGccFood = async (food) => {
    // Directly add to meal log — no AI needed
    const data = {
      meal_name: food.name_ar + (food.name_en ? ` (${food.name_en})` : ''),
      portion_note: food.serving_desc_ar || `${food.serving_size_g}g`,
      total_calories: food.calories,
      protein_g: food.protein_g || 0,
      carbs_g: food.carbs_g || 0,
      fat_g: food.fat_g || 0,
      fiber_g: food.fiber_g || 0,
      notes: `من قاعدة بيانات GCC · ${food.serving_desc_ar || food.serving_size_g + 'g'}`
    }
    const body = { userId: user.id, mealType, meal_date: viewDate, ...data }
    const r = await fetch('/api/meals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) {
      await loadDay(user.id, viewDate)
      resetAdd()
      setTab('daily')
      setGccSearch('')
      setGccResults([])
      setShowGcc(false)
    }
  }

  const resetAdd = () => { setAddStep('type'); setMealType(null); setImgB64(null); setImgPreview(null); setTextInput(''); setResult(null); setErr(''); setShowRecentMeals(false) }

  const prevDay = () => { const d=new Date(viewDate+'T12:00:00'); d.setDate(d.getDate()-1); setViewDate(d.toISOString().split('T')[0]) }
  const nextDay = () => { const d=new Date(viewDate+'T12:00:00'); d.setDate(d.getDate()+1); if(d<=new Date()) setViewDate(d.toISOString().split('T')[0]) }
  const isToday = viewDate === todayStr()

  const pct = (val, goal) => goal>0 ? Math.round((val/goal)*100) : 0  // no min/max - shows true %

  return (
    <div style={{minHeight:'100vh',background:'#09090B',color:'#ECE3CF'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}
        input,textarea{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#ECE3CF;padding:11px 14px;font-family:'DM Sans','Tajawal',sans-serif;font-size:.9rem;border-radius:10px;outline:none;width:100%;transition:all .2s}
        input:focus,textarea:focus{border-color:#CBA23B;background:rgba(203,162,59,0.04)}
        ::placeholder{color:rgba(255,255,255,0.2)}
        .ptab{background:transparent;border:none;border-bottom:2px solid transparent;color:rgba(255,255,255,0.3);font-family:'DM Sans','Tajawal',sans-serif;font-size:.85rem;font-weight:600;padding:10px 12px;cursor:pointer;transition:all .2s}
        .ptab.on{color:#CBA23B;border-bottom-color:#CBA23B}
        .mrow{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
        .mrow:last-child{border-bottom:none}
      `}</style>
      <TopNav title="التغذية" user={user} back="/" onSignOut={()=>supabase.auth.signOut().then(()=>router.push('/'))}/>

      {/* Edit meal modal */}
      {editMeal && <EditModal meal={editMeal} onSave={updateMeal} onClose={()=>setEditMeal(null)} onReanalyze={async(id,data)=>{await updateMeal(id,data);}} NUTRIENTS={NUTRIENTS}/>}

      {/* Date nav */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 16px',background:'rgba(255,255,255,0.02)',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
        <button onClick={prevDay} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:'1.3rem',padding:'4px 8px'}}>‹</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.95rem'}}>{isToday?'اليوم 📅':new Date(viewDate+'T12:00:00').toLocaleDateString('ar-SA',{weekday:'long',month:'long',day:'numeric'})}</div>
        </div>
        <button onClick={nextDay} disabled={isToday} style={{background:'none',border:'none',color:isToday?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.4)',cursor:isToday?'default':'pointer',fontSize:'1.3rem',padding:'4px 8px'}}>›</button>
      </div>

      <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'0 16px'}}>
        <button className={`ptab${tab==='plan'?' on':''}`} onClick={()=>setTab('plan')}>🍽️ خطة اليوم</button>
        <button className={`ptab${tab==='daily'?' on':''}`} onClick={()=>setTab('daily')}>أكلك اليوم</button>
        <button className={`ptab${tab==='add'?' on':''}`} onClick={()=>{setTab('add');resetAdd()}}>+ سجّل وجبة</button>
        <button className={`ptab${tab==='nutrients'?' on':''}`} onClick={()=>setTab('nutrients')}>📊 مغذياتي</button>
        <button className={`ptab${tab==='report'?' on':''}`} onClick={()=>setTab('report')}>التقرير</button>
      </div>

      <div style={{maxWidth:520,margin:'0 auto',padding:'0 16px'}}>

        {/* ── MEAL PLAN ── */}
        {tab==='plan' && (
          <div style={{paddingTop:14,paddingBottom:100}}>
            {mealPlanLoading ? (
              <div style={{textAlign:'center',padding:'60px 0',color:'rgba(255,255,255,0.35)'}}>
                <div style={{width:28,height:28,border:'3px solid rgba(203,162,59,0.2)',borderTopColor:'#CBA23B',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 14px'}}/>
                <div style={{fontSize:'.85rem'}}>جاري تحميل خطة الوجبات...</div>
              </div>
            ) : mealPlan ? (<>
              {/* Calorie goal header */}
              <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.15)',borderRadius:16,padding:'14px 16px',marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div style={{fontWeight:700,fontSize:'.85rem'}}>هدف السعرات</div>
                  <div style={{fontWeight:900,color:'#CBA23B',fontFamily:'monospace'}}>{mealPlan.total_calories} سعرة</div>
                </div>
                <div style={{height:5,background:'rgba(255,255,255,0.06)',borderRadius:10,overflow:'hidden',marginBottom:10}}>
                  <div style={{height:'100%',width:'100%',background:'linear-gradient(90deg,#CBA23B,#e8c55a)',borderRadius:10}}/>
                </div>
                <div style={{display:'flex',gap:12,fontSize:'.72rem'}}>
                  {[['بروتين',mealPlan.total_protein+'g','#3b82f6'],['كارب','—g','#f97316'],['دهون','—g','#22c55e']].map(([l,v,c])=>(
                    <div key={l} style={{display:'flex',gap:4}}><span style={{color:c,fontWeight:700,fontFamily:'monospace'}}>{v}</span><span style={{color:'rgba(255,255,255,0.35)'}}>{l}</span></div>
                  ))}
                </div>
                {mealPlan.tip&&<div style={{marginTop:10,fontSize:'.76rem',color:'rgba(255,255,255,0.4)',lineHeight:1.6}}>💡 {mealPlan.tip}</div>}
              </div>
              {/* Meal list */}
              {(mealPlan.plan||[]).map((meal,i)=>(
                <div key={i} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'14px 16px',marginBottom:9}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                    <div style={{fontWeight:700,fontSize:'.78rem',color:'#CBA23B'}}>{meal.meal_time}</div>
                    <div style={{fontFamily:'monospace',fontWeight:700,color:'#CBA23B',fontSize:'.78rem'}}>{meal.actual_calories} سعرة</div>
                  </div>
                  <div style={{fontWeight:800,fontSize:'.9rem',marginBottom:3}}>{meal.food?.name_ar}</div>
                  <div style={{fontSize:'.72rem',color:'rgba(255,255,255,0.4)',marginBottom:8}}>{meal.food?.portion_desc}</div>
                  <div style={{display:'flex',gap:10,fontSize:'.68rem'}}>
                    {[['B',meal.protein_g+'g','#3b82f6'],['C',meal.carbs_g+'g','#f97316'],['F',meal.fat_g+'g','#22c55e']].map(([l,v,c])=>(
                      <div key={l} style={{display:'flex',gap:3}}><span style={{color:c,fontFamily:'monospace',fontWeight:700}}>{v}</span><span style={{color:'rgba(255,255,255,0.3)'}}>{l==='B'?'بروتين':l==='C'?'كارب':'دهون'}</span></div>
                    ))}
                  </div>
                </div>
              ))}
              {/* Log button */}
              <button onClick={()=>{setTab('add');resetAdd()}}
                style={{width:'100%',background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.25)',color:'#22c55e',borderRadius:12,padding:'13px',fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.88rem',cursor:'pointer',marginTop:4}}>
                🍽️ سجّل ما أكلته اليوم ←
              </button>
            </>) : (
              <div style={{textAlign:'center',padding:'60px 0',color:'rgba(255,255,255,0.35)'}}>
                <div style={{fontSize:'2.5rem',marginBottom:12}}>🍽️</div>
                <div style={{marginBottom:8}}>لا توجد خطة وجبات بعد</div>
                <div style={{fontSize:'.78rem',color:'rgba(255,255,255,0.25)'}}>ابدأ برنامجك لتفعيل خطة التغذية</div>
              </div>
            )}
          </div>
        )}

        {/* ── DAILY LOG ── */}
        {tab==='daily' && (
          <div style={{paddingTop:14}}>
            {/* Calorie ring */}
            <CalorieRing calories={totals.calories||0} goal={G.calories} protein={totals.protein_g||0} carbs={totals.carbs_g||0} fat={totals.fat_g||0} G={G}/>

            {/* Water */}
            <div style={{background:'rgba(6,182,212,0.06)',border:'1px solid rgba(6,182,212,0.18)',borderRadius:14,padding:'13px 16px',marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div>
                  <div style={{fontSize:'.6rem',fontWeight:700,letterSpacing:1.5,color:'rgba(6,182,212,0.6)',marginBottom:2}}>الماء</div>
                  <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:900,fontSize:'1.3rem',color:'#06b6d4'}}>{totalWater}ml <span style={{fontSize:'.7rem',fontWeight:600,opacity:.6}}>/ {G.water_ml||2500}ml</span></div>
                </div>
                <div style={{flex:1,margin:'0 12px'}}>
                  <div style={{height:6,background:'rgba(6,182,212,0.1)',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${pct(totalWater,G.water_ml||2500)}%`,background:'#06b6d4',borderRadius:3,transition:'width .5s'}}/></div>
                  <div style={{fontSize:'.62rem',color:'rgba(255,255,255,0.2)',marginTop:3,textAlign:'right'}}>{pct(totalWater,G.water_ml||2500)}%</div>
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                {[150,250,330,500].map(ml=>(
                  <button key={ml} onClick={()=>logWater(ml)} style={{flex:1,padding:'7px 4px',background:'rgba(6,182,212,0.1)',border:'1px solid rgba(6,182,212,0.2)',borderRadius:9,color:'#06b6d4',cursor:'pointer',fontSize:'.72rem',fontWeight:700,fontFamily:"'DM Sans','Tajawal',sans-serif"}}>+{ml}ml</button>
                ))}
              </div>
              {water.length>0&&<div style={{marginTop:7,display:'flex',gap:5,flexWrap:'wrap'}}>{water.map(w=><span key={w.id} onClick={()=>deleteMeal(w.id,'water')} style={{background:'rgba(6,182,212,0.1)',border:'1px solid rgba(6,182,212,0.12)',color:'rgba(6,182,212,0.7)',padding:'3px 8px',borderRadius:20,fontSize:'.65rem',cursor:'pointer'}}>💧{w.amount_ml}ml ✕</span>)}</div>}
            </div>

            {/* Meal sections */}
            {MEAL_TYPES.map(mt => {
              const mls = meals.filter(m=>m.meal_type===mt.id)
              const mCal = mls.reduce((a,m)=>a+(m.total_calories||0),0)
              const open = expandMeal===mt.id
              return (
                <div key={mt.id} style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:14,marginBottom:8,overflow:'hidden'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',cursor:'pointer'}} onClick={()=>setExpandMeal(open?null:mt.id)}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:'1.2rem'}}>{mt.icon}</span>
                      <span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.88rem'}}>{mt.label}</span>
                      {mls.length>0&&<span style={{background:`${mt.color}20`,color:mt.color,padding:'2px 7px',borderRadius:20,fontSize:'.62rem',fontWeight:700}}>{mls.length}</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {mCal>0&&<span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,color:mt.color,fontSize:'.85rem'}}>{mCal} kcal</span>}
                      <div style={{display:'flex',gap:5}}>
                        
                        <button onClick={e=>{e.stopPropagation();setMealType(mt.id);setAddStep('capture');setTab('add')}}
                          style={{background:`${mt.color}18`,border:`1px solid ${mt.color}33`,color:mt.color,borderRadius:7,padding:'4px 9px',cursor:'pointer',fontSize:'.7rem',fontWeight:700,fontFamily:"'DM Sans','Tajawal',sans-serif"}}>+ سجّل وجبة</button>
                      </div>
                      <span style={{color:'rgba(255,255,255,0.3)',fontSize:'.8rem',transition:'transform .2s',transform:open?'rotate(180deg)':'none'}}>▼</span>
                    </div>
                  </div>
                  {open && (
                    <div style={{borderTop:'1px solid rgba(255,255,255,0.05)',padding:'10px 14px'}}>
                      {mls.length===0
                        ? <div style={{color:'rgba(255,255,255,0.2)',fontSize:'.8rem',padding:'6px 0'}}>ما سجّلت شي بعد — يلا ابدأ!</div>
                        : mls.map(m=>(
                          <div key={m.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)',paddingBottom:10,marginBottom:10}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:600,fontSize:'.88rem'}}>{m.meal_name||'Meal'}</div>
                                {m.portion_note&&<div style={{fontSize:'.68rem',color:'rgba(255,255,255,0.25)',marginTop:1}}>{m.portion_note}</div>}
                              </div>
                              <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,color:'#CBA23B',fontSize:'.95rem'}}>{m.total_calories}</span>
                                <button onClick={()=>setEditMeal(m)} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:'.7rem',padding:'3px 7px',fontFamily:"'DM Sans','Tajawal',sans-serif"}}>🔄</button>
                                <button onClick={()=>deleteMeal(m.id,'meal')} style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.15)',borderRadius:6,color:'#f87171',cursor:'pointer',fontSize:'.7rem',padding:'3px 7px'}}>✕</button>
                              </div>
                            </div>
                            <div style={{display:'flex',gap:8,fontSize:'.7rem',flexWrap:'wrap'}}>
                              {[['ب',m.protein_g,'#3b82f6'],['ك',m.carbs_g,'#f97316'],['د',m.fat_g,'#a855f7'],['أ',m.fiber_g,'#22c55e']].map(([l,v,c])=>v>0&&(
                                <span key={l} style={{color:c,fontWeight:700}}>{l} {Math.round(v||0)}g</span>
                              ))}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              )
            })}

            {meals.length===0&&(
              <div style={{textAlign:'center',padding:'30px 0',color:'rgba(255,255,255,0.2)'}}>
                <div style={{fontSize:'2.5rem',marginBottom:8}}>🍽️</div>
                <div style={{fontWeight:600,marginBottom:4}}>ما سجّلت شي بعد — يلا ابدأ!</div>
                <button onClick={()=>{setTab('add');resetAdd()}} style={{background:'#CBA23B',border:'none',borderRadius:12,padding:'12px 22px',fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.9rem',color:'#0C0B0D',cursor:'pointer',marginTop:10}}>سجّل أول وجبة</button>
              </div>
            )}
          </div>
        )}

        {/* ── ADD ── */}
        {tab==='add' && (
          <div style={{paddingTop:16}}>
            {addStep==='type' && (
              <div>
                <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'rgba(255,255,255,0.3)',marginBottom:14}}>نوع الوجبة</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {MEAL_TYPES.map(mt=>(
                    <div key={mt.id} onClick={()=>{setMealType(mt.id);setAddStep('capture')}}
                      style={{background:`${mt.color}0c`,border:`1px solid ${mt.color}2a`,borderRadius:16,padding:'20px 16px',cursor:'pointer',textAlign:'center'}}
                      onTouchStart={e=>e.currentTarget.style.transform='scale(.96)'} onTouchEnd={e=>e.currentTarget.style.transform='scale(1)'}>
                      <div style={{fontSize:'2.2rem',marginBottom:8}}>{mt.icon}</div>
                      <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,color:mt.color}}>{mt.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {addStep==='capture' && (
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                  <button onClick={()=>setAddStep('type')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:'1.1rem'}}>←</button>
                  <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700}}>{MEAL_TYPES.find(m=>m.id===mealType)?.label}</div>
                </div>
                <div onClick={()=>{fileRef.current.removeAttribute('capture');fileRef.current.click()}}
                  style={{border:`2px dashed ${imgPreview?'rgba(255,255,255,0.1)':'rgba(203,162,59,0.10)'}`,borderRadius:16,overflow:'hidden',marginBottom:10,cursor:'pointer',minHeight:imgPreview?0:130,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.2)'}}>
                  {imgPreview?<div style={{position:'relative',width:'100%'}}><img src={imgPreview} alt="" style={{width:'100%',maxHeight:200,objectFit:'cover',display:'block'}}/><div style={{position:'absolute',bottom:6,right:6,background:'rgba(0,0,0,.7)',borderRadius:6,padding:'3px 8px',fontSize:'.68rem',color:'rgba(255,255,255,.5)'}}>tap to change</div></div>
                  :<div style={{textAlign:'center',padding:'24px'}}><div style={{fontSize:'2.5rem',marginBottom:6}}>📸</div><div style={{color:'rgba(255,255,255,0.25)',fontSize:'.85rem',fontWeight:600}}>صوّر وجبتك 📸</div></div>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>loadImg(e.target.files[0])}/>
                <div style={{display:'flex',gap:8,marginBottom:10}}>
                  <button onClick={()=>{fileRef.current.removeAttribute('capture');fileRef.current.click()}} style={{flex:1,padding:'10px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'rgba(255,255,255,0.6)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.82rem',fontWeight:600}}>🖼 Gallery</button>
                  <button onClick={()=>{fileRef.current.setAttribute('capture','environment');fileRef.current.click()}} style={{flex:1,padding:'10px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'rgba(255,255,255,0.6)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.82rem',fontWeight:600}}>📷 Camera</button>
                  {imgPreview&&<button onClick={()=>{setImgB64(null);setImgPreview(null)}} style={{padding:'10px 12px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.2)',borderRadius:10,color:'#f87171',cursor:'pointer'}}>✕</button>}
                </div>

                {/* ── GCC FOOD DATABASE ── */}
                <div style={{marginBottom:12}}>
                  <button onClick={()=>setShowGcc(v=>!v)}
                    style={{width:'100%',padding:'11px 14px',background:showGcc?'rgba(203,162,59,0.1)':'rgba(255,255,255,0.03)',border:`1px solid ${showGcc?'rgba(203,162,59,0.3)':'rgba(203,162,59,0.12)'}`,borderRadius:12,color:showGcc?'#CBA23B':'rgba(255,255,255,0.6)',cursor:'pointer',fontFamily:"'Tajawal',sans-serif",fontWeight:700,fontSize:'.85rem',display:'flex',justifyContent:'space-between',alignItems:'center',transition:'all .15s'}}>
                    <span>🍽️ قاعدة بيانات الأكل الخليجي</span>
                    <span style={{fontSize:'.7rem',opacity:.6}}>{showGcc?'▲':'▼'} 250+ وجبة</span>
                  </button>
                  {showGcc&&(
                    <div style={{marginTop:8}}>
                      <div style={{position:'relative',marginBottom:8}}>
                        <input
                          type="text" value={gccSearch}
                          onChange={e=>searchGcc(e.target.value)}
                          placeholder="ابحث: كبسة، شاورما، حمص، تمر..."
                          style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(203,162,59,0.2)',color:'#ECE3CF',padding:'10px 14px',borderRadius:10,outline:'none',fontFamily:"'Tajawal',sans-serif",fontSize:'.88rem',direction:'rtl',boxSizing:'border-box'}}
                          autoFocus
                        />
                        {gccLoading&&<div style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',width:14,height:14,border:'2px solid rgba(203,162,59,0.2)',borderTopColor:'#CBA23B',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>}
                      </div>
                      {/* Quick category pills */}
                      {!gccSearch&&(
                        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                          {[['أطباق رئيسية','🍛'],['فطور','☀️'],['بروتين','💪'],['مشروبات','🥤'],['حلويات','🍯'],['فواكه','🍊']].map(([cat,icon])=>(
                            <button key={cat} onClick={()=>searchGcc(cat)}
                              style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.55)',padding:'5px 10px',borderRadius:20,cursor:'pointer',fontFamily:"'Tajawal',sans-serif",fontSize:'.72rem',fontWeight:600}}>
                              {icon} {cat}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Results */}
                      {gccResults.length>0&&(
                        <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:280,overflowY:'auto'}}>
                          {gccResults.map(food=>(
                            <div key={food.id} onClick={()=>useGccFood(food)}
                              style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.1)',borderRadius:10,cursor:'pointer',transition:'all .15s'}}
                              onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(203,162,59,0.3)'}
                              onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(203,162,59,0.1)'}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontFamily:"'Tajawal',sans-serif",fontWeight:700,fontSize:'.88rem',marginBottom:2}}>{food.name_ar}</div>
                                <div style={{fontSize:'.68rem',color:'rgba(255,255,255,0.35)',fontFamily:"'Tajawal',sans-serif"}}>{food.serving_desc_ar||food.serving_size_g+'g'} · {food.category}</div>
                              </div>
                              <div style={{textAlign:'left',flexShrink:0,paddingRight:4}}>
                                <div style={{fontWeight:900,color:'#CBA23B',fontFamily:'monospace',fontSize:'.92rem'}}>{food.calories}</div>
                                <div style={{fontSize:'.62rem',color:'rgba(255,255,255,0.3)'}}>سعرة</div>
                              </div>
                              <div style={{display:'flex',gap:6,marginRight:8,flexShrink:0}}>
                                {[['B',food.protein_g,'#3b82f6'],['C',food.carbs_g,'#f97316'],['F',food.fat_g,'#22c55e']].map(([l,v,c])=>(
                                  <div key={l} style={{textAlign:'center'}}>
                                    <div style={{fontSize:'.65rem',fontWeight:700,color:c,fontFamily:'monospace'}}>{Math.round(v||0)}g</div>
                                    <div style={{fontSize:'.55rem',color:'rgba(255,255,255,0.25)'}}>{l}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {gccSearch.length>=2&&!gccLoading&&gccResults.length===0&&(
                        <div style={{textAlign:'center',padding:'14px',color:'rgba(255,255,255,0.25)',fontSize:'.82rem',fontFamily:"'Tajawal',sans-serif"}}>
                          ما وجدنا "{gccSearch}" — جرّب صف الوجبة بالأعلى للتحليل بالذكاء
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <div style={{flex:1,height:1,background:'rgba(255,255,255,0.06)'}}/><span style={{color:'rgba(255,255,255,0.2)',fontSize:'.68rem',fontWeight:700,whiteSpace:'nowrap'}}>أو حلّل بالذكاء</span><div style={{flex:1,height:1,background:'rgba(255,255,255,0.06)'}}/>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <div style={{flex:1,height:1,background:'rgba(255,255,255,0.06)'}}/><span style={{color:'rgba(255,255,255,0.2)',fontSize:'.68rem',fontWeight:700,whiteSpace:'nowrap'}}>أو صفها بكلامك</span><div style={{flex:1,height:1,background:'rgba(255,255,255,0.06)'}}/>
                </div>
                <textarea placeholder="مثال: ٢٠٠g دجاج مشوي، ١٥٠g أرز أبيض، سلطة بملعقة زيت زيتون…" value={textInput} onChange={e=>setTextInput(e.target.value)} rows={3} style={{marginBottom:8,resize:'none',lineHeight:1.6}}/>
                {textInput&&imgB64&&<div style={{color:'#CBA23B',fontSize:'.7rem',marginBottom:8,fontWeight:600}}>✓ AI cross-checks photo + description</div>}

                {/* Barcode scanner */}
                <div style={{display:'flex',alignItems:'center',gap:8,margin:'4px 0 8px'}}>
                  <div style={{flex:1,height:1,background:'rgba(255,255,255,0.06)'}}/><span style={{color:'rgba(255,255,255,0.2)',fontSize:'.68rem',fontWeight:700,whiteSpace:'nowrap'}}>أو امسح الباركود</span><div style={{flex:1,height:1,background:'rgba(255,255,255,0.06)'}}/>
                </div>
                <div style={{display:'flex',gap:8,marginBottom:10}}>
                  <input type="text" inputMode="numeric" placeholder="رقم الباركود…" value={barcode} onChange={e=>setBarcode(e.target.value)} onKeyDown={e=>e.key==='Enter'&&lookupBarcode()} style={{flex:1}}/>
                  <button onClick={lookupBarcode} disabled={!barcode.trim()||barcodeLoading}
                    style={{padding:'0 13px',background:barcode.trim()?'rgba(6,182,212,0.2)':'rgba(255,255,255,0.04)',border:'1px solid '+(barcode.trim()?'rgba(6,182,212,0.4)':'rgba(255,255,255,0.1)'),borderRadius:10,color:barcode.trim()?'#06b6d4':'rgba(255,255,255,0.25)',cursor:barcode.trim()?'pointer':'not-allowed',fontFamily:"'DM Sans','Tajawal',sans-serif",fontWeight:700,fontSize:'.8rem',height:44,display:'flex',alignItems:'center'}}>
                    {barcodeLoading?'…':'🔍'}
                  </button>
                </div>
                {/* Scan from camera OR gallery */}
                <div style={{display:'flex',gap:8,marginBottom:10}}>
                  <button onClick={()=>scanBarcodeImage(true)}
                    style={{flex:1,padding:'9px',background:'rgba(6,182,212,0.1)',border:'1px solid rgba(6,182,212,0.25)',borderRadius:10,color:'#06b6d4',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontWeight:700,fontSize:'.8rem',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    📷 Scan with Camera
                  </button>
                  <button onClick={()=>scanBarcodeImage(false)}
                    style={{flex:1,padding:'9px',background:'rgba(6,182,212,0.08)',border:'1px solid rgba(6,182,212,0.2)',borderRadius:10,color:'#06b6d4',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontWeight:700,fontSize:'.8rem',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    🖼️ Scan from Gallery
                  </button>
                </div>
                {barcodeLoading && (
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'rgba(6,182,212,0.06)',border:'1px solid rgba(6,182,212,0.15)',borderRadius:10,marginBottom:8}}>
                    <div style={{width:16,height:16,border:'2px solid rgba(6,182,212,0.3)',borderTopColor:'#06b6d4',borderRadius:'50%',animation:'spin .7s linear infinite',flexShrink:0}}/>
                    <span style={{fontSize:'.78rem',color:'#06b6d4',fontWeight:600}}>Scanning barcode...</span>
                  </div>
                )}


                {/* From Yesterday for this meal type */}
                {mealType && (() => {
                  const yd = new Date(viewDate+'T12:00:00'); yd.setDate(yd.getDate()-1)
                  const ydStr = yd.toISOString().split('T')[0]
                  const ydLabel = yd.toLocaleDateString('ar-SA',{weekday:'long',month:'long',day:'numeric'})
                  return (
                    <div style={{marginBottom:10}}>
                      <button onClick={async()=>{await copyFromDate(ydStr,mealType);resetAdd();setTab('daily')}}
                        style={{width:'100%',padding:'10px 14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.12)',borderRadius:10,color:'rgba(255,255,255,0.5)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontWeight:600,fontSize:'.82rem',textAlign:'right',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span>📋 Copy {MEAL_TYPES.find(m=>m.id===mealType)?.label} from {ydLabel}</span>
                        <span style={{fontSize:'.7rem',opacity:.5}}>no AI needed ←</span>
                      </button>
                    </div>
                  )
                })()}
                {/* My meals templates */}
                {customMeals.length>0&&(
                  <div style={{marginBottom:10}}>
                    <button onClick={()=>setShowCustom(v=>!v)} style={{width:'100%',padding:'10px 14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.12)',borderRadius:10,color:'rgba(255,255,255,0.5)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontWeight:600,fontSize:'.82rem',textAlign:'right',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>⭐ My Saved Meals ({customMeals.length})</span>
                      <span style={{color:'rgba(255,255,255,0.25)'}}>{showCustom?'▲':'▼'}</span>
                    </button>
                    {showCustom&&(
                      <div style={{marginTop:6,display:'flex',flexDirection:'column',gap:5}}>
                        {customMeals.map(m=>(
                          <button key={m.id} onClick={()=>useCustomMeal(m)}
                            style={{padding:'10px 14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.10)',borderRadius:10,color:'rgba(255,255,255,0.7)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.85rem',textAlign:'right',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <div>
                              <div style={{fontWeight:600}}>{m.meal_name}</div>
                              <div style={{fontSize:'.7rem',color:'rgba(255,255,255,0.3)',marginTop:2}}>{m.portion_note||''} · used {m.times_used}x</div>
                            </div>
                            <span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,color:'#CBA23B',fontSize:'.9rem'}}>{m.total_calories} kcal</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Recent meals from yesterday - quick copy */}
                {mealType && recentMealsByType[mealType]?.length > 0 && (
                  <div style={{marginBottom:10}}>
                    <button onClick={()=>setShowRecentMeals(v=>!v)}
                      style={{width:'100%',padding:'10px 14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.12)',borderRadius:10,color:'rgba(255,255,255,0.5)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontWeight:600,fontSize:'.82rem',textAlign:'right',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>📅 Yesterday's {MEAL_TYPES.find(m=>m.id===mealType)?.label} ({recentMealsByType[mealType].length} item{recentMealsByType[mealType].length>1?'s':''})</span>
                      <span style={{color:'rgba(255,255,255,0.25)'}}>{showRecentMeals?'▲':'▼'}</span>
                    </button>
                    {showRecentMeals && (
                      <div style={{marginTop:6,display:'flex',flexDirection:'column',gap:5}}>
                        {recentMealsByType[mealType].map((m,i) => (
                          <button key={i} onClick={async()=>{
                            const yesterday = new Date(viewDate+'T12:00:00'); yesterday.setDate(yesterday.getDate()-1)
                            await copyFromDate(yesterday.toISOString().split('T')[0], mealType)
                            setShowRecentMeals(false); resetAdd(); setTab('daily')
                          }}
                            style={{padding:'10px 14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.10)',borderRadius:10,color:'rgba(255,255,255,0.7)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.85rem',textAlign:'right',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <div>
                              <div style={{fontWeight:600}}>{m.meal_name||'Meal'}</div>
                              <div style={{fontSize:'.7rem',color:'rgba(255,255,255,0.3)',marginTop:2}}>{m.portion_note||''}</div>
                            </div>
                            <span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,color:'#CBA23B',fontSize:'.9rem'}}>{m.total_calories} kcal</span>
                          </button>
                        ))}
                        <button onClick={async()=>{
                            const yesterday = new Date(viewDate+'T12:00:00'); yesterday.setDate(yesterday.getDate()-1)
                            await copyFromDate(yesterday.toISOString().split('T')[0], mealType)
                            setShowRecentMeals(false); resetAdd(); setTab('daily')
                          }}
                          style={{padding:'9px',background:'rgba(203,162,59,0.07)',border:'1px solid rgba(203,162,59,0.2)',borderRadius:10,color:'#CBA23B',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontWeight:700,fontSize:'.8rem'}}>
                          انسخ من وجبات أمس ({recentMealsByType[mealType].length} وجبة) ←
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {err&&<div style={{color:'#fca5a5',fontSize:'.8rem',marginBottom:8,padding:'10px 14px',background:'rgba(239,68,68,.08)',borderRadius:10,border:'1px solid rgba(239,68,68,.2)'}}>{err}</div>}
                {analyzing?<div style={{textAlign:'center',padding:'24px'}}><div style={{width:40,height:40,border:'3px solid rgba(203,162,59,0.2)',borderTopColor:'#CBA23B',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 12px'}}/><div style={{color:'#CBA23B',fontWeight:700,fontFamily:"'Space Grotesk','Tajawal',sans-serif",letterSpacing:1}}>جاري التحليل...</div></div>
                :<button onClick={analyze} disabled={!imgB64&&!textInput.trim()} style={{width:'100%',padding:'15px',background:(!imgB64&&!textInput.trim())?'rgba(255,255,255,0.05)':'#CBA23B',border:'none',borderRadius:12,fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.95rem',color:(!imgB64&&!textInput.trim())?'rgba(255,255,255,0.2)':'#0C0B0D',cursor:(!imgB64&&!textInput.trim())?'not-allowed':'pointer'}}>تحليل الوجبة</button>}
              </div>
            )}

            {addStep==='result' && result && (
              <ResultView result={result} imgPreview={imgPreview} goals={G} onBack={()=>setAddStep('capture')} onSave={saveMeal} saving={saving} savingTemplate={savingTemplate} onSaveTemplate={saveAsTemplate} err={err} NUTRIENTS={NUTRIENTS} pct={pct}/>
            )}
          </div>
        )}

        {/* ── NUTRIENTS ── */}
        {tab==='nutrients' && (
          <div style={{paddingTop:14}}>
            {/* Calorie summary */}
            <div style={{background:'rgba(203,162,59,0.07)',border:'1px solid rgba(203,162,59,0.18)',borderRadius:14,padding:'14px 16px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'.6rem',fontWeight:700,letterSpacing:1.5,color:'rgba(203,162,59,0.5)',marginBottom:4}}>سعراتك اليوم</div>
                <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:900,fontSize:'1.8rem',color:'#CBA23B',lineHeight:1}}>{Math.round(totals.calories||0)}</div>
                <div style={{fontSize:'.72rem',color:'rgba(255,255,255,0.3)',marginTop:2}}>هدفك: {G.calories} سعرة · {pct(totals.calories||0,G.calories)}%</div>
              </div>
              {!goals&&<div style={{fontSize:'.72rem',color:'rgba(255,255,255,0.25)',maxWidth:120,textAlign:'right',lineHeight:1.4}}>أكمل بياناتك للأهداف الشخصية</div>}
            </div>

            {/* All 16 nutrients */}
            {['macro','fat','micro','vitamin','mineral'].map(group => {
              const groupNutrients = NUTRIENTS.filter(n=>n.group===group)
              const groupLabels = {macro:'الكربوهيدرات والبروتين',fat:'الدهون',micro:'الكهارل',vitamin:'الفيتامينات',mineral:'المعادن'}
              return (
                <div key={group} style={{marginBottom:14}}>
                  <div style={{fontSize:'.6rem',fontWeight:700,letterSpacing:1.5,color:'rgba(255,255,255,0.25)',marginBottom:10}}>{groupLabels[group].toUpperCase()}</div>
                  <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:14,padding:'10px 14px'}}>
                    {groupNutrients.map((n, i) => {
                      const val = totals[n.key]||0
                      const goalVal = G[n.key]||0
                      const p = pct(val, goalVal)
                      const over = val > goalVal && goalVal > 0
                      return (
                        <div key={n.key} style={{padding:'8px 0',borderBottom:i<groupNutrients.length-1?'1px solid rgba(255,255,255,0.04)':'none'}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                            <span style={{fontSize:'.82rem',color:'rgba(255,255,255,0.65)',fontWeight:500}}>{n.label}</span>
                            <div style={{display:'flex',alignItems:'baseline',gap:5}}>
                              <span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.88rem',color:n.color}}>{fmt(val)}<span style={{fontSize:'.6rem',opacity:.7,marginLeft:1}}>{n.unit}</span></span>
                              {goalVal>0&&<span style={{fontSize:'.68rem',color:over?'#ef4444':'rgba(255,255,255,0.25)',fontWeight:over?700:400}}>/ {fmt(goalVal)}{n.unit}</span>}
                              {goalVal>0&&<span style={{fontSize:'.65rem',color:over?'#ef4444':p>=80?'#4ade80':'rgba(255,255,255,0.3)',fontWeight:700,minWidth:32,textAlign:'right'}}>{p}%{over&&' ⚠'}</span>}
                            </div>
                          </div>
                          {goalVal>0&&(
                            <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden',position:'relative'}}>
                              <div style={{height:'100%',width:`${Math.min(100,p)}%`,background:over?'#ef4444':n.color,borderRadius:2,transition:'width .5s ease'}}/>
                              {over&&<div style={{position:'absolute',top:0,left:`${Math.min(100,Math.round((goalVal/Math.max(val,goalVal))*100))}%`,width:2,height:'100%',background:'rgba(255,255,255,0.4)'}}/>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {!goals&&<div style={{background:'rgba(203,162,59,0.05)',border:'1px solid rgba(203,162,59,0.12)',borderRadius:12,padding:'12px 16px',fontSize:'.8rem',color:'rgba(203,162,59,0.6)',lineHeight:1.6}}>
              💡 أضف عمرك ووزنك وطولك وهدفك في الإعدادات للحصول على أهداف غذائية مخصصة بناءً على معادلة ميفلين-سانت جيور.
            </div>}
          </div>
        )}
      </div>


        {/* ── AI REPORT TAB ── */}
        {tab === 'report' && (
          <div style={{paddingTop:16}}>
            {/* Generate button */}
            {!report && !reportLoading && (
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <div style={{fontSize:'2.5rem',marginBottom:12}}>🤖</div>
                <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'1.1rem',marginBottom:6}}>تحليل تغذيتك اليومي</div>
                <div style={{color:'rgba(255,255,255,0.35)',fontSize:'.82rem',marginBottom:20,lineHeight:1.6}}>
                  AI analyzes your full day of eating - every meal, every ingredient - and gives you a detailed nutritional report with scores, feedback and tips.
                </div>
                {!meals.length
                  ? <div style={{color:'rgba(255,255,255,0.25)',fontSize:'.82rem'}}>Log some meals first to generate a report.</div>
                  : <button onClick={generateReport}
                      style={{background:'#CBA23B',border:'none',borderRadius:14,padding:'15px 28px',fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'1rem',color:'#0C0B0D',cursor:'pointer',boxShadow:'0 4px 20px rgba(203,162,59,0.2)'}}>
                      Analyze My Day ←
                    </button>
                }
                {reportErr && <div style={{color:'#fca5a5',fontSize:'.8rem',marginTop:12,padding:'10px 14px',background:'rgba(239,68,68,.08)',borderRadius:10,border:'1px solid rgba(239,68,68,.2)'}}>{reportErr}</div>}
              </div>
            )}

            {/* Loading */}
            {reportLoading && (
              <div style={{textAlign:'center',padding:'40px 0'}}>
                <div style={{width:48,height:48,border:'3px solid rgba(203,162,59,0.2)',borderTopColor:'#CBA23B',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 16px'}}/>
                <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,color:'#CBA23B',letterSpacing:1}}>ANALYZING YOUR NUTRITION...</div>
                <div style={{color:'rgba(255,255,255,0.3)',fontSize:'.78rem',marginTop:6}}>Reviewing {meals.length} meal{meals.length>1?'s':''} logged today</div>
              </div>
            )}

            {/* Report */}
            {report && (
              <div>
                {/* Header + re-analyze */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:reportIsStale?8:16}}>
                  <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'1rem'}}>تقرير تغذيتك اليومي</div>
                  <button onClick={generateReport} disabled={reportLoading}
                    style={{background:'rgba(203,162,59,0.08)',border:'1px solid rgba(203,162,59,0.2)',borderRadius:9,padding:'6px 13px',color:'#CBA23B',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.75rem',fontWeight:700,opacity:reportLoading?.6:1}}>
                    {reportLoading ? '...' : 'حاول مرة ثانية'}
                  </button>
                </div>

                {/* Stale warning - meals changed since report was generated */}
                {reportIsStale && (
                  <div style={{background:'rgba(234,179,8,0.08)',border:'1px solid rgba(234,179,8,0.25)',borderRadius:11,padding:'10px 14px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                    <div>
                      <div style={{fontSize:'.72rem',fontWeight:700,color:'#eab308',marginBottom:2}}>⚠ Meals have changed</div>
                      <div style={{fontSize:'.7rem',color:'rgba(255,255,255,0.4)'}}>This report was generated before your latest meal edits.</div>
                    </div>
                    <button onClick={generateReport} style={{background:'rgba(234,179,8,0.15)',border:'1px solid rgba(234,179,8,0.3)',borderRadius:8,padding:'7px 12px',color:'#eab308',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.72rem',fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>
                      Update now
                    </button>
                  </div>
                )}

                {/* Overall score */}
                <div style={{background:'rgba(203,162,59,0.06)',border:'1px solid rgba(203,162,59,0.18)',borderRadius:16,padding:'16px',marginBottom:14}}>
                  <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:12}}>
                    {/* Score ring */}
                    <div style={{flexShrink:0}}>
                      {(() => {
                        const score = report.overall_score || 0
                        const r = 36, circ = 2*Math.PI*r
                        const pct = score/10
                        const col = score>=8?'#4ade80':score>=6?'#CBA23B':score>=4?'#eab308':'#ef4444'
                        return (
                          <svg width={88} height={88} viewBox="0 0 88 88">
                            <circle cx={44} cy={44} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8}/>
                            <circle cx={44} cy={44} r={r} fill="none" stroke={col} strokeWidth={8}
                              strokeDasharray={`${pct*circ} ${circ}`} strokeLinecap="round" transform="rotate(-90 44 44)"/>
                            <text x={44} y={40} textAnchor="middle" fill={col} fontSize={18} fontFamily="'Space Grotesk','Tajawal',sans-serif" fontWeight={900}>{score}</text>
                            <text x={44} y={54} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="'DM Sans','Tajawal',sans-serif">/10</text>
                          </svg>
                        )
                      })()}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'rgba(203,162,59,0.5)',marginBottom:5}}>تقييم يومك</div>
                      <div style={{fontSize:'.85rem',color:'rgba(255,255,255,0.7)',lineHeight:1.55}}>{report.summary}</div>
                    </div>
                  </div>
                  {/* Macro status pills */}
                  {report.macros_balance && (
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {[
                        ['البروتين', report.macros_balance.protein_status, {deficient:'#ef4444',adequate:'#eab308',excellent:'#4ade80'}],
                        ['الكارب',   report.macros_balance.carbs_status,   {low:'#3b82f6',optimal:'#4ade80',high:'#ef4444'}],
                        ['الدهن',     report.macros_balance.fat_status,     {low:'#3b82f6',optimal:'#4ade80',high:'#ef4444'}],
                        ['الألياف',   report.macros_balance.fiber_status,   {deficient:'#ef4444',adequate:'#eab308',good:'#4ade80'}],
                      ].map(([label, status, colorMap]) => {
                        const col = colorMap[status] || '#888'
                        return (
                          <span key={label} style={{background:col+'18',border:'1px solid '+col+'44',color:col,padding:'4px 11px',borderRadius:20,fontSize:'.7rem',fontWeight:700}}>
                            {label}: {status?.replace('_',' ')}
                          </span>
                        )
                      })}
                      {report.hydration_status && (
                        <span style={{background:'rgba(6,182,212,0.12)',border:'1px solid rgba(6,182,212,0.3)',color:'#06b6d4',padding:'4px 11px',borderRadius:20,fontSize:'.7rem',fontWeight:700}}>
                          Hydration: {report.hydration_status}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Per-meal type reports */}
                {report.meal_reports && (
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'rgba(255,255,255,0.25)',marginBottom:10}}>MEAL-BY-MEAL BREAKDOWN</div>
                    {['breakfast','lunch','dinner','snack'].map(mt => {
                      const mr = report.meal_reports[mt]
                      const mealData = meals.filter(m => m.meal_type === mt)
                      if (!mr && !mealData.length) return null
                      const mealInfo = MEAL_TYPES.find(m => m.id === mt)
                      const col = mealInfo?.color || '#888'
                      const score = mr?.score || 0
                      const scoreCol = score>=8?'#4ade80':score>=6?'#CBA23B':score>=4?'#eab308':'#ef4444'
                      return (
                        <div key={mt} style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(203,162,59,0.10)',borderRadius:14,padding:'13px 14px',marginBottom:8}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <span style={{fontSize:'1.1rem'}}>{mealInfo?.icon}</span>
                              <span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,color:col}}>{mealInfo?.label}</span>
                              {!mealData.length && <span style={{fontSize:'.68rem',color:'rgba(255,255,255,0.25)'}}>not logged</span>}
                            </div>
                            {mr && <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:900,color:scoreCol,fontSize:'1.1rem'}}>{score}<span style={{fontSize:'.65rem',opacity:.6}}>/10</span></div>}
                          </div>
                          {mr && (
                            <>
                              {mr.assessment && <div style={{fontSize:'.8rem',color:'rgba(255,255,255,0.55)',lineHeight:1.5,marginBottom:8}}>{mr.assessment}</div>}
                              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                                {mr.positives?.length > 0 && (
                                  <div style={{background:'rgba(74,222,128,0.04)',border:'1px solid rgba(74,222,128,0.12)',borderRadius:9,padding:'8px 10px'}}>
                                    <div style={{fontSize:'.58rem',fontWeight:700,letterSpacing:1,color:'#4ade80',marginBottom:5}}>نقاط قوتك</div>
                                    {mr.positives.map((p,i) => <div key={i} style={{fontSize:'.75rem',color:'rgba(255,255,255,0.55)',marginBottom:3,lineHeight:1.4}}>+ {p}</div>)}
                                  </div>
                                )}
                                {mr.improvements?.length > 0 && (
                                  <div style={{background:'rgba(248,113,113,0.04)',border:'1px solid rgba(248,113,113,0.12)',borderRadius:9,padding:'8px 10px'}}>
                                    <div style={{fontSize:'.58rem',fontWeight:700,letterSpacing:1,color:'#f87171',marginBottom:5}}>طوّر هذا</div>
                                    {mr.improvements.map((p,i) => <div key={i} style={{fontSize:'.75rem',color:'rgba(255,255,255,0.55)',marginBottom:3,lineHeight:1.4}}>! {p}</div>)}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* What went well */}
                {report.what_went_well?.length > 0 && (
                  <div style={{background:'rgba(74,222,128,0.05)',border:'1px solid rgba(74,222,128,0.15)',borderRadius:14,padding:'13px 14px',marginBottom:10}}>
                    <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'#4ade80',marginBottom:10}}>ما شاء الله — أحسنت</div>
                    {report.what_went_well.map((w,i) => (
                      <div key={i} style={{display:'flex',gap:8,marginBottom:7}}>
                        <span style={{color:'#4ade80',flexShrink:0,fontSize:'.85rem'}}>✓</span>
                        <span style={{fontSize:'.82rem',color:'rgba(255,255,255,0.65)',lineHeight:1.5}}>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Improvements */}
                {report.improvements?.length > 0 && (
                  <div style={{background:'rgba(248,113,113,0.05)',border:'1px solid rgba(248,113,113,0.15)',borderRadius:14,padding:'13px 14px',marginBottom:10}}>
                    <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'#f87171',marginBottom:10}}>نقاط تحتاج تطوير</div>
                    {report.improvements.map((w,i) => (
                      <div key={i} style={{display:'flex',gap:8,marginBottom:7}}>
                        <span style={{color:'#f87171',flexShrink:0,fontSize:'.85rem'}}>↑</span>
                        <span style={{fontSize:'.82rem',color:'rgba(255,255,255,0.65)',lineHeight:1.5}}>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Nutrients of concern */}
                {report.nutrients_of_concern?.length > 0 && (
                  <div style={{background:'rgba(234,179,8,0.05)',border:'1px solid rgba(234,179,8,0.18)',borderRadius:14,padding:'13px 14px',marginBottom:10}}>
                    <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'#eab308',marginBottom:10}}>مغذيات تستحق الانتباه</div>
                    {report.nutrients_of_concern.map((n,i) => (
                      <div key={i} style={{fontSize:'.82rem',color:'rgba(255,255,255,0.6)',marginBottom:4}}>⚠ {n}</div>
                    ))}
                  </div>
                )}

                {/* Meal timing note */}
                {report.meal_timing_note && (
                  <div style={{background:'rgba(129,140,248,0.05)',border:'1px solid rgba(129,140,248,0.15)',borderRadius:14,padding:'12px 14px',marginBottom:10}}>
                    <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'#818cf8',marginBottom:6}}>توقيت الوجبة</div>
                    <div style={{fontSize:'.82rem',color:'rgba(255,255,255,0.6)',lineHeight:1.5}}>{report.meal_timing_note}</div>
                  </div>
                )}

                {/* Tomorrow tips */}
                {report.tomorrow_tips?.length > 0 && (
                  <div style={{background:'rgba(203,162,59,0.04)',border:'1px solid rgba(203,162,59,0.14)',borderRadius:14,padding:'13px 14px',marginBottom:16}}>
                    <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'rgba(203,162,59,0.6)',marginBottom:10}}>نصيحة للجلسة الجاية</div>
                    {report.tomorrow_tips.map((t,i) => (
                      <div key={i} style={{display:'flex',gap:8,marginBottom:7}}>
                        <span style={{color:'#CBA23B',flexShrink:0,fontSize:'.85rem'}}>💡</span>
                        <span style={{fontSize:'.82rem',color:'rgba(255,255,255,0.65)',lineHeight:1.5}}>{t}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={generateReport} disabled={reportLoading}
                  style={{width:'100%',padding:'13px',background:'rgba(203,162,59,0.08)',border:'1px solid rgba(203,162,59,0.2)',borderRadius:12,color:'#CBA23B',cursor:reportLoading?'not-allowed':'pointer',fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.9rem',opacity:reportLoading?.6:1}}>
                  {reportLoading ? 'جاري التحليل...' : 'حاول مرة ثانية'}
                </button>
              </div>
            )}
          </div>
        )}

      <div style={{height:'calc(72px + env(safe-area-inset-bottom))'}}/>
      <BottomTabs active="meals"/>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function CalorieRing({ calories, goal, protein, carbs, fat, G }) {
  const pct = Math.min(1, calories/goal)
  const over = calories > goal
  const r = 42, circ = 2*Math.PI*r
  return (
    <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.10)',borderRadius:18,padding:'16px',marginBottom:12}}>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:14}}>
        <div style={{flexShrink:0}}>
          <svg width={100} height={100} viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={9}/>
            <circle cx={50} cy={50} r={r} fill="none" stroke={over?'#ef4444':'#CBA23B'} strokeWidth={9}
              strokeDasharray={`${pct*circ} ${circ}`} strokeLinecap="round"
              transform="rotate(-90 50 50)" style={{transition:'stroke-dasharray .6s'}}/>
            <text x={50} y={46} textAnchor="middle" fill={over?'#ef4444':'#CBA23B'} fontSize={15} fontFamily="'Space Grotesk','Tajawal',sans-serif" fontWeight={800}>{Math.round(calories)}</text>
            <text x={50} y={60} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={9} fontFamily="'DM Sans','Tajawal',sans-serif">سعرة</text>
          </svg>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'rgba(255,255,255,0.25)',marginBottom:6}}>هدفك اليومي: {goal} سعرة</div>
          <div style={{fontSize:'.8rem',marginBottom:10,fontWeight:600}}>
            {goal-calories>0
              ? <span style={{color:'#4ade80'}}>{goal-calories} سعرة باقيين لك</span>
              : <span style={{color:'#ef4444'}}>{calories-goal} سعرة زادت</span>}
          </div>
          {[['بروتين',protein,G.protein_g,'#3b82f6'],['كارب',carbs,G.carbs_g,'#f97316'],['دهن',fat,G.fat_g,'#a855f7']].map(([l,v,g,c])=>(
            <div key={l} style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
              <span style={{fontSize:'.65rem',fontWeight:800,color:c,minWidth:10}}>{l}</span>
              <div style={{flex:1,height:5,background:'rgba(203,162,59,0.10)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.min(100,g>0?(v/g)*100:0)}%`,background:c,borderRadius:3,transition:'width .5s'}}/>
              </div>
              <span style={{fontSize:'.65rem',color:'rgba(255,255,255,0.35)',minWidth:52,textAlign:'right'}}>{Math.round(v||0)}g / {g}g</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
        {[['البروتين',protein,'g','#3b82f6'],['الكارب',carbs,'g','#f97316'],['الدهن',fat,'g','#a855f7']].map(([l,v,u,c])=>(
          <div key={l} style={{textAlign:'center'}}>
            <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.95rem',color:c,lineHeight:1}}>{Math.round(v||0)}<span style={{fontSize:'.58rem',opacity:.6,marginLeft:1}}>{u}</span></div>
            <div style={{fontSize:'.56rem',color:'rgba(255,255,255,0.28)',letterSpacing:1,marginTop:3,fontWeight:700}}>{l.toUpperCase()}</div>
          </div>
        ))}
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.95rem',color:'#CBA23B',lineHeight:1}}>{Math.round(pct*100)}<span style={{fontSize:'.58rem',opacity:.6}}>%</span></div>
          <div style={{fontSize:'.56rem',color:'rgba(255,255,255,0.28)',letterSpacing:1,marginTop:3,fontWeight:700}}>من الهدف</div>
        </div>
      </div>
    </div>
  )
}

function ResultView({ result, imgPreview, goals, onBack, onSave, saving, savingTemplate, onSaveTemplate, err, NUTRIENTS, pct }) {
  // Local editable ingredients with scaling
  const [ings, setIngs] = useState(() => initIngs(result.ingredients))
  const [editMode, setEditMode] = useState(true)  // open by default - user already sees AI result above

  // Re-init when result changes (re-analyze)
  React.useEffect(() => { setIngs(initIngs(result.ingredients)) }, [result])

  function initIngs(rawIngs) {
    // If no ingredients, build one from the result totals so user can still edit portions
    if (!rawIngs?.length) {
      const total = { name: result.meal_name || '', portion: result.portion_note || '100g', calories: result.total_calories || 0, protein_g: result.protein_g || 0, carbs_g: result.carbs_g || 0, fat_g: result.fat_g || 0, fiber_g: result.fiber_g || 0 }
      const g = extractGramsLocal(total.portion)
      if (g && g > 0) { total._pg_cal = total.calories/g; total._pg_prot = total.protein_g/g; total._pg_carbs = total.carbs_g/g; total._pg_fat = total.fat_g/g; total._pg_fiber = total.fiber_g/g }
      return [total]
    }
    return rawIngs.map(i => {
      const ing = { name:i.name||'', portion:i.portion||'', calories:i.calories||0, protein_g:i.protein_g||0, carbs_g:i.carbs_g||0, fat_g:i.fat_g||0, fiber_g:i.fiber_g||0 }
      const g = extractGramsLocal(ing.portion)
      if (g && g > 0) {
        ing._pg_cal   = ing.calories  / g
        ing._pg_prot  = ing.protein_g / g
        ing._pg_carbs = ing.carbs_g   / g
        ing._pg_fat   = ing.fat_g     / g
        ing._pg_fiber = ing.fiber_g   / g
      }
      return ing
    })
  }

  function extractGramsLocal(s) {
    if (!s) return null
    const paren = s.match(/\((\d+\.?\d*)\s*(?:g|gr|gram)/i)
    if (paren) return parseFloat(paren[1])
    const lead = s.match(/^(\d+\.?\d*)\s*(?:g|gr|gram|ml)/i)
    if (lead) return parseFloat(lead[1])
    return null
  }

  const addIng = () => setIngs(p => [...p, {name:'',portion:'',calories:0,protein_g:0,carbs_g:0,fat_g:0,fiber_g:0}])
  const removeIng = i => setIngs(p => p.filter((_,j)=>j!==i))

  const updateIng = (i, k, v) => {
    setIngs(p => p.map((row, j) => {
      if (j !== i) return row
      const updated = { ...row, [k]: (k==='name'||k==='portion') ? v : (parseFloat(v)||0) }
      if (k === 'portion') {
        const newG = extractGramsLocal(v)
        if (newG && newG > 0) {
          let pgCal=row._pg_cal, pgProt=row._pg_prot, pgCarbs=row._pg_carbs, pgFat=row._pg_fat, pgFiber=row._pg_fiber
          if (pgCal === undefined) {
            const oldG = extractGramsLocal(row.portion)
            if (oldG && oldG > 0) { pgCal=row.calories/oldG; pgProt=row.protein_g/oldG; pgCarbs=row.carbs_g/oldG; pgFat=row.fat_g/oldG; pgFiber=row.fiber_g/oldG }
            else return updated
          }
          updated.calories  = Math.round(pgCal   * newG)
          updated.protein_g = Math.round(pgProt  * newG * 10) / 10
          updated.carbs_g   = Math.round(pgCarbs * newG * 10) / 10
          updated.fat_g     = Math.round(pgFat   * newG * 10) / 10
          updated.fiber_g   = Math.round(pgFiber * newG * 10) / 10
          updated._pg_cal=pgCal; updated._pg_prot=pgProt; updated._pg_carbs=pgCarbs; updated._pg_fat=pgFat; updated._pg_fiber=pgFiber
        }
      }
      return updated
    }))
  }

  // Recompute totals from edited ingredients
  const ingTotals = ings.reduce((acc, ing) => ({
    calories:  acc.calories  + (ing.calories  || 0),
    protein_g: acc.protein_g + (ing.protein_g || 0),
    carbs_g:   acc.carbs_g   + (ing.carbs_g   || 0),
    fat_g:     acc.fat_g     + (ing.fat_g     || 0),
    fiber_g:   acc.fiber_g   + (ing.fiber_g   || 0),
  }), {calories:0,protein_g:0,carbs_g:0,fat_g:0,fiber_g:0})

  // Build the final result to save (merge edited ingredients + recalculated totals)
  const getFinalResult = () => {
    if (!ings.length) return result
    return {
      ...result,
      ingredients: ings,
      total_calories: Math.round(ingTotals.calories),
      protein_g: Math.round(ingTotals.protein_g*10)/10,
      carbs_g:   Math.round(ingTotals.carbs_g  *10)/10,
      fat_g:     Math.round(ingTotals.fat_g    *10)/10,
      fiber_g:   Math.round(ingTotals.fiber_g  *10)/10,
    }
  }

  const r1 = n => Math.round((n||0)*10)/10
  const INP = {background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'#ECE3CF',padding:'7px 9px',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.8rem',borderRadius:8,outline:'none',transition:'all .2s'}

  // Which totals to show (edited or original)
  const showCal   = ings.length ? Math.round(ingTotals.calories)  : result.total_calories
  const showProt  = ings.length ? r1(ingTotals.protein_g)         : r1(result.protein_g)
  const showCarbs = ings.length ? r1(ingTotals.carbs_g)           : r1(result.carbs_g)
  const showFat   = ings.length ? r1(ingTotals.fat_g)             : r1(result.fat_g)

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
        <button onClick={onBack} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:'1.1rem'}}>←</button>
        <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'1.1rem',flex:1}}>{result.meal_name}</div>
        <span style={{background:'rgba(203,162,59,0.12)',border:'1px solid rgba(203,162,59,0.25)',color:'#CBA23B',padding:'3px 10px',borderRadius:20,fontSize:'.72rem',fontWeight:700}}>{showCal} kcal</span>
      </div>

      {imgPreview&&<img src={imgPreview} alt="" style={{width:'100%',borderRadius:14,maxHeight:180,objectFit:'cover',marginBottom:12}}/>}

      {/* Macros summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:12}}>
        {[['البروتين',showProt,'g','#3b82f6'],['الكارب',showCarbs,'g','#f97316'],['الدهن',showFat,'g','#a855f7'],['الألياف',ings.length?r1(ingTotals.fiber_g):r1(result.fiber_g),'g','#22c55e']].map(([l,v,u,col])=>(
          <div key={l} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.10)',borderRadius:10,padding:'10px 4px',textAlign:'center'}}>
            <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:900,fontSize:'1.05rem',color:col,lineHeight:1}}>{v}<span style={{fontSize:'.55rem',opacity:.6}}>{u}</span></div>
            <div style={{fontSize:'.56rem',color:'rgba(255,255,255,0.3)',letterSpacing:1,marginTop:3,fontWeight:700}}>{l.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* Full nutrients */}
      <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,padding:'12px 14px',marginBottom:12}}>
        <div style={{fontSize:'.6rem',fontWeight:700,letterSpacing:1.5,color:'rgba(255,255,255,0.2)',marginBottom:10}}>التفاصيل الغذائية الكاملة</div>
        {NUTRIENTS.filter(n=>!['protein_g','carbs_g','fat_g','fiber_g'].includes(n.key)).map((n,i)=>result[n.key]>0&&(
          <div key={n.key} className="mrow">
            <span style={{fontSize:'.78rem',color:'rgba(255,255,255,0.5)'}}>{n.label}</span>
            <span style={{fontSize:'.8rem',color:n.color,fontWeight:700}}>{Math.round((result[n.key]||0)*10)/10}{n.unit}</span>
          </div>
        ))}
      </div>

      {/* Ingredients - editable */}
      {(ings.length > 0 || result.ingredients?.length > 0) && (
        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,padding:'12px 14px',marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontSize:'.6rem',fontWeight:700,letterSpacing:1.5,color:'rgba(255,255,255,0.2)'}}>المكونات</div>
            <button onClick={()=>setEditMode(v=>!v)}
              style={{background:editMode?'rgba(203,162,59,0.15)':'rgba(255,255,255,0.05)',border:'1px solid '+(editMode?'rgba(203,162,59,0.35)':'rgba(255,255,255,0.1)'),borderRadius:7,padding:'4px 10px',color:editMode?'#CBA23B':'rgba(255,255,255,0.45)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.72rem',fontWeight:700}}>
              {editMode ? '✓ Done editing' : '✏️ Edit & Scale'}
            </button>
          </div>

          {!editMode ? (
            /* Read-only view */
            ings.map((ing, i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderTop:i>0?'1px solid rgba(255,255,255,0.04)':'none'}}>
                <div>
                  <div style={{fontSize:'.84rem',fontWeight:500}}>{ing.name}</div>
                  {ing.portion&&<div style={{fontSize:'.68rem',color:'rgba(255,255,255,0.25)',marginTop:1}}>{ing.portion}</div>}
                </div>
                <span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,color:'#CBA23B',fontSize:'.85rem'}}>{ing.calories} kcal</span>
              </div>
            ))
          ) : (
            /* Edit mode */
            <div>
              {/* Live totals bar */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4,marginBottom:10,padding:'8px',background:'rgba(203,162,59,0.06)',border:'1px solid rgba(203,162,59,0.15)',borderRadius:9}}>
                {[['Cal',Math.round(ingTotals.calories),'سعرة','#CBA23B'],['Prot',r1(ingTotals.protein_g),'g','#3b82f6'],['الكارب',r1(ingTotals.carbs_g),'g','#f97316'],['الدهن',r1(ingTotals.fat_g),'g','#a855f7'],['الألياف',r1(ingTotals.fiber_g),'g','#22c55e']].map(([l,v,u,col])=>(
                  <div key={l} style={{textAlign:'center'}}>
                    <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.82rem',color:col,lineHeight:1}}>{v}<span style={{fontSize:'.5rem',opacity:.6,marginLeft:1}}>{u}</span></div>
                    <div style={{fontSize:'.52rem',color:'rgba(255,255,255,0.25)',marginTop:2,fontWeight:700}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:'.62rem',color:'rgba(203,162,59,0.45)',marginBottom:8}}>⚖️ Change gram values to auto-scale nutrition</div>

              {ings.map((ing, i) => (
                <div key={i} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.10)',borderRadius:10,padding:'9px',marginBottom:7}}>
                  <div style={{display:'flex',gap:5,marginBottom:6,alignItems:'center'}}>
                    <input type="text" placeholder="المكوّن" value={ing.name} onChange={e=>updateIng(i,'name',e.target.value)} style={{...INP,flex:2,minWidth:0}}/>
                    <div style={{flex:1,minWidth:0,position:'relative'}}>
                      <input type="text" placeholder="مثال: ١٠٠g" value={ing.portion} onChange={e=>updateIng(i,'portion',e.target.value)} style={{...INP,width:'100%',paddingRight:extractGramsLocal(ing.portion)?'22px':'9px',fontSize:'.75rem'}}/>
                      {extractGramsLocal(ing.portion)&&<span style={{position:'absolute',right:5,top:'50%',transform:'translateY(-50%)',fontSize:'.65rem',opacity:.5}}>⚖️</span>}
                    </div>
                    <button onClick={()=>removeIng(i)} style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:6,padding:'7px 8px',color:'#f87171',cursor:'pointer',fontSize:'.78rem',flexShrink:0,lineHeight:1}}>✕</button>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4}}>
                    {[['سعرة','calories'],['P g','protein_g'],['C g','carbs_g'],['F g','fat_g'],['Fi g','fiber_g']].map(([l,k])=>(
                      <div key={k}>
                        <div style={{fontSize:'.52rem',color:'rgba(255,255,255,0.2)',marginBottom:2,fontWeight:700,textAlign:'center'}}>{l.toUpperCase()}</div>
                        <input type="number" inputMode="decimal" value={ing[k]||''} placeholder="0" onChange={e=>updateIng(i,k,e.target.value)} style={{...INP,textAlign:'center',padding:'5px 3px',fontSize:'.78rem'}}/>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={addIng} style={{width:'100%',padding:'8px',background:'transparent',border:'1px dashed rgba(255,255,255,0.12)',borderRadius:9,color:'rgba(255,255,255,0.35)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontWeight:600,fontSize:'.78rem',marginBottom:4}}>
                + أضف مكوّن
              </button>
            </div>
          )}
        </div>
      )}

      {result.allergens?.length>0&&<div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>{result.allergens.map(a=><span key={a} style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.2)',color:'#f87171',padding:'3px 8px',borderRadius:20,fontSize:'.67rem',fontWeight:600}}>⚠ {a}</span>)}</div>}
      {err&&<div style={{color:'#fca5a5',fontSize:'.8rem',marginBottom:8,padding:'10px',background:'rgba(239,68,68,.08)',borderRadius:10,border:'1px solid rgba(239,68,68,.2)'}}>{err}</div>}

      <div style={{display:'flex',gap:8,marginBottom:8}}>
        <button onClick={onBack} style={{flex:1,padding:'14px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,color:'rgba(255,255,255,0.5)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontWeight:600,fontSize:'.88rem'}}>Re-analyze</button>
        <button onClick={()=>onSave(getFinalResult())} disabled={saving} style={{flex:2,padding:'14px',background:'#CBA23B',border:'none',borderRadius:12,fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.95rem',color:'#0C0B0D',cursor:saving?'not-allowed':'pointer'}}>
          {saving?'حافظين…':'سجّل الوجبة ✓'}
        </button>
      </div>
      <button onClick={()=>onSaveTemplate(getFinalResult())} disabled={savingTemplate} style={{width:'100%',padding:'11px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.12)',borderRadius:12,color:'rgba(255,255,255,0.4)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontWeight:600,fontSize:'.82rem'}}>
        {savingTemplate?'حافظين…':'⭐ احفظ كقالب وجباتي'}
      </button>
    </div>
  )
}

function EditModal({ meal, onSave, onClose, onReanalyze }) {
  // Two tabs: edit ingredients manually OR re-analyze with AI
  const [tab, setTab] = useState('ingredients')
  // Ingredient editor state - pre-populate from existing meal data
  const [ingredients, setIngredients] = useState(() => {
    // Helper: compute per-gram values on init so scaling works immediately
    const withPerGram = (ing) => {
      const gStr = ing.portion || ''
      const gMatch = gStr.match(/^(\d+\.?\d*)\s*(?:g|gr|gram|ml)/i)
      const grams = gMatch ? parseFloat(gMatch[1]) : null
      if (!grams || grams <= 0) return ing
      return {
        ...ing,
        _perGramCal:   (ing.calories  || 0) / grams,
        _perGramProt:  (ing.protein_g || 0) / grams,
        _perGramCarbs: (ing.carbs_g   || 0) / grams,
        _perGramFat:   (ing.fat_g     || 0) / grams,
        _perGramFiber: (ing.fiber_g   || 0) / grams,
      }
    }
    if (meal.ingredients?.length) {
      return meal.ingredients.map(i => withPerGram({
        name: i.name || '',
        portion: i.portion || '',
        calories: i.calories || 0,
        protein_g: i.protein_g || 0,
        carbs_g: i.carbs_g || 0,
        fat_g: i.fat_g || 0,
        fiber_g: i.fiber_g || 0,
      }))
    }
    // No ingredients stored - create one row from the meal totals
    return [withPerGram({ name: meal.meal_name || '', portion: meal.portion_note || '', calories: meal.total_calories || 0, protein_g: meal.protein_g || 0, carbs_g: meal.carbs_g || 0, fat_g: meal.fat_g || 0, fiber_g: meal.fiber_g || 0 })]
  })
  const [saving, setSaving] = useState(false)
  // Re-analyze state
  const [imgB64, setImgB64] = useState(null)
  const [imgMime, setImgMime] = useState('image/jpeg')
  const [imgPreview, setImgPreview] = useState(null)
  const [textInput, setTextInput] = useState(meal.meal_name || '')
  const [analyzing, setAnalyzing] = useState(false)
  const [reResult, setReResult] = useState(null)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  // ── Ingredient editor helpers ──────────────────────────────────────
  const addRow = () => setIngredients(p => [...p, { name:'', portion:'', calories:0, protein_g:0, carbs_g:0, fat_g:0, fiber_g:0, _baseGrams:0, _baseCals:0, _baseProt:0, _baseCarbs:0, _baseFat:0, _baseFiber:0 }])
  const removeRow = i => setIngredients(p => p.filter((_,j) => j !== i))

  // Extract grams from a portion string like "20g", "150 gr", "2 tbsp (30g)", "3 eggs"
  // Extract grams from portion string: "100g", "50 grams", "(30g)", "150ml"
  const extractGrams = (str) => {
    if (!str) return null
    const s = String(str).trim()
    // parenthesized: "2 tbsp (30g)"
    const paren = s.match(/\((\d+\.?\d*)\s*(?:g|gr|gram)/i)
    if (paren) return parseFloat(paren[1])
    // leading number + g/gr/gram/ml
    const lead = s.match(/^(\d+\.?\d*)\s*(?:g|gr|gram|ml)/i)
    if (lead) return parseFloat(lead[1])
    return null
  }

  const updateRow = (i, k, v) => {
    setIngredients(p => p.map((row, j) => {
      if (j !== i) return row
      const updated = { ...row, [k]: k === 'name' || k === 'portion' ? v : (parseFloat(v) || 0) }

      if (k === 'portion') {
        const newGrams = extractGrams(v)

        if (newGrams !== null && newGrams > 0) {
          // We have a valid gram value in the new portion string.
          // Always scale from the stored per-gram base values.
          // If per-gram values aren't stored yet, compute them from the current portion.

          let perGramCal, perGramProt, perGramCarbs, perGramFat, perGramFiber

          if (row._perGramCal !== undefined) {
            // Already have per-gram base stored from a previous edit
            perGramCal   = row._perGramCal
            perGramProt  = row._perGramProt
            perGramCarbs = row._perGramCarbs
            perGramFat   = row._perGramFat
            perGramFiber = row._perGramFiber
          } else {
            // First time scaling: compute per-gram from current nutrition + current grams
            const currentGrams = extractGrams(row.portion)
            if (currentGrams && currentGrams > 0) {
              perGramCal   = (row.calories  || 0) / currentGrams
              perGramProt  = (row.protein_g || 0) / currentGrams
              perGramCarbs = (row.carbs_g   || 0) / currentGrams
              perGramFat   = (row.fat_g     || 0) / currentGrams
              perGramFiber = (row.fiber_g   || 0) / currentGrams
            } else {
              // Can't determine base - skip scaling this time
              return updated
            }
          }

          // Apply per-gram × new grams
          updated.calories  = Math.round(perGramCal   * newGrams)
          updated.protein_g = Math.round(perGramProt  * newGrams * 10) / 10
          updated.carbs_g   = Math.round(perGramCarbs * newGrams * 10) / 10
          updated.fat_g     = Math.round(perGramFat   * newGrams * 10) / 10
          updated.fiber_g   = Math.round(perGramFiber * newGrams * 10) / 10

          // Persist per-gram values so future edits keep scaling correctly
          updated._perGramCal   = perGramCal
          updated._perGramProt  = perGramProt
          updated._perGramCarbs = perGramCarbs
          updated._perGramFat   = perGramFat
          updated._perGramFiber = perGramFiber
        }
        // If newGrams is null (e.g. "4 eggs") - just update the text, don't touch nutrition
      }

      return updated
    }))
  }

  // Live recalculate totals
  const totals = ingredients.reduce((acc, ing) => ({
    calories:  acc.calories  + (ing.calories  || 0),
    protein_g: acc.protein_g + (ing.protein_g || 0),
    carbs_g:   acc.carbs_g  + (ing.carbs_g   || 0),
    fat_g:     acc.fat_g    + (ing.fat_g     || 0),
    fiber_g:   acc.fiber_g  + (ing.fiber_g   || 0),
  }), { calories:0, protein_g:0, carbs_g:0, fat_g:0, fiber_g:0 })

  const saveIngredients = async () => {
    setSaving(true)
    const updates = {
      ...totals,
      total_calories: Math.round(totals.calories),
      protein_g: Math.round(totals.protein_g * 10) / 10,
      carbs_g:   Math.round(totals.carbs_g   * 10) / 10,
      fat_g:     Math.round(totals.fat_g     * 10) / 10,
      fiber_g:   Math.round(totals.fiber_g   * 10) / 10,
      ingredients,
      meal_name: ingredients.filter(i=>i.name).map(i=>i.name).join(', ') || meal.meal_name,
    }
    delete updates.calories // keep total_calories
    await onSave(meal.id, updates)
    onClose()
    setSaving(false)
  }

  // ── Re-analyze helpers ─────────────────────────────────────────────
  const loadImg = file => {
    if (!file) return
    setImgMime(file.type || 'image/jpeg')
    const r = new FileReader()
    r.onload = e => { const d = e.target.result; setImgPreview(d); setImgB64(d.split(',')[1]) }
    r.readAsDataURL(file)
  }

  const reanalyze = async () => {
    if (!imgB64 && !textInput.trim()) { setErr('أضف صورة أو وصف.'); return }
    setAnalyzing(true); setErr(''); setReResult(null)
    try {
      const r = await fetch('/api/meal-analyze', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ imageBase64: imgB64||null, imageMime: imgMime, textInput: textInput.trim()||null, mealType: meal.meal_type })
      })
      const data = await r.json()
      if (!r.ok || data.error) { setErr(data.error || 'Failed'); setAnalyzing(false); return }
      setReResult(data)
      // Also populate ingredient editor with AI result
      if (data.ingredients?.length) {
        setIngredients(data.ingredients.map(i => {
          const ing = {
            name: i.name || '', portion: i.portion || '',
            calories: i.calories || 0, protein_g: i.protein_g || 0,
            carbs_g: i.carbs_g || 0, fat_g: i.fat_g || 0, fiber_g: i.fiber_g || 0,
          }
          // Pre-compute per-gram values so scaling works immediately
          const gMatch = (ing.portion || '').match(/^(\d+\.?\d*)\s*(?:g|gr|gram|ml)/i)
          const grams = gMatch ? parseFloat(gMatch[1]) : null
          if (grams && grams > 0) {
            ing._perGramCal   = ing.calories  / grams
            ing._perGramProt  = ing.protein_g / grams
            ing._perGramCarbs = ing.carbs_g   / grams
            ing._perGramFat   = ing.fat_g     / grams
            ing._perGramFiber = ing.fiber_g   / grams
          }
          return ing
        }))
      }
    } catch(e) { setErr('Error: ' + e.message) }
    setAnalyzing(false)
  }

  const saveReanalyzed = async () => {
    if (!reResult) return
    setSaving(true)
    await onSave(meal.id, reResult)
    onClose(); setSaving(false)
  }

  const INP = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#ECE3CF', padding:'8px 10px', fontFamily:"'DM Sans','Tajawal',sans-serif", fontSize:'.82rem', borderRadius:8, outline:'none', width:'100%', transition:'all .2s' }
  const r1 = n => Math.round(n * 10) / 10

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.94)',zIndex:400,display:'flex',alignItems:'flex-end',backdropFilter:'blur(8px)'}}>
      <style>{`*{box-sizing:border-box} input,textarea{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#ECE3CF;padding:9px 12px;font-family:'DM Sans','Tajawal',sans-serif;font-size:.85rem;border-radius:9px;outline:none;width:100%;transition:all .2s} input:focus,textarea:focus{border-color:#CBA23B;background:rgba(203,162,59,0.04)} ::placeholder{color:rgba(255,255,255,0.2)} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{background:'#111009',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'22px 22px 0 0',width:'100%',maxHeight:'92vh',overflowY:'auto',padding:'16px 16px calc(24px + env(safe-area-inset-bottom))'}}>
        <div style={{width:36,height:4,background:'rgba(255,255,255,0.15)',borderRadius:2,margin:'0 auto 14px'}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'1.05rem'}}>تعديل الوجبة</div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'5px 11px',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:'.78rem',fontFamily:"'DM Sans','Tajawal',sans-serif"}}>إلغاء</button>
        </div>

        {/* Tab selector */}
        <div style={{display:'flex',background:'rgba(255,255,255,0.04)',borderRadius:10,padding:3,marginBottom:16,gap:3}}>
          {[['ingredients','✏️ Edit Ingredients'],['reanalyze','🔍 Re-analyze with AI']].map(([id,label]) => (
            <button key={id} onClick={() => { setTab(id); setErr('') }}
              style={{flex:1,padding:'9px 8px',background:tab===id?'rgba(203,162,59,0.15)':'transparent',border:'1px solid ' + (tab===id?'rgba(203,162,59,0.3)':'transparent'),borderRadius:8,color:tab===id?'#CBA23B':'rgba(255,255,255,0.4)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.76rem',fontWeight:700,transition:'all .15s'}}>
              {label}
            </button>
          ))}
        </div>

        {/* ── INGREDIENT EDITOR ── */}
        {tab === 'ingredients' && (
          <div>
            {/* Live totals bar */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5,marginBottom:14,padding:'11px 10px',background:'rgba(203,162,59,0.06)',border:'1px solid rgba(203,162,59,0.18)',borderRadius:12}}>
              {[['Cal',Math.round(totals.calories),'سعرة','#CBA23B'],['Prot',r1(totals.protein_g),'g','#3b82f6'],['Carb',r1(totals.carbs_g),'g','#f97316'],['الدهن',r1(totals.fat_g),'g','#a855f7'],['الألياف',r1(totals.fiber_g),'g','#22c55e']].map(([l,v,u,col]) => (
                <div key={l} style={{textAlign:'center'}}>
                  <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:900,fontSize:'.92rem',color:col,lineHeight:1}}>{v}<span style={{fontSize:'.52rem',opacity:.6,marginLeft:1}}>{u}</span></div>
                  <div style={{fontSize:'.55rem',color:'rgba(255,255,255,0.3)',marginTop:2,fontWeight:700}}>{l.toUpperCase()}</div>
                </div>
              ))}
            </div>
            <div style={{color:'rgba(255,255,255,0.3)',fontSize:'.72rem',marginBottom:10,lineHeight:1.5}}>
              Add, remove or edit ingredients. Totals recalculate instantly.
            </div>

            {ingredients.map((ing, i) => {
              const hasGrams = extractGrams(ing.portion) !== null
              return (
              <div key={i} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.12)',borderRadius:13,padding:'11px',marginBottom:8}}>
                {/* Name + portion + remove */}
                <div style={{display:'flex',gap:6,marginBottom:8,alignItems:'center'}}>
                  <input type="text" placeholder="اسم المكوّن" value={ing.name} onChange={e=>updateRow(i,'name',e.target.value)} style={{flex:2,minWidth:0}}/>
                  <div style={{flex:1,minWidth:0,position:'relative'}}>
                    <input type="text" placeholder="مثال: ٢٠g، ١٥٠ml" value={ing.portion}
                      onChange={e=>updateRow(i,'portion',e.target.value)}
                      style={{width:'100%',fontSize:'.78rem',paddingRight: hasGrams?'22px':'10px'}}/>
                    {hasGrams && <span title="التغذية تتكيف مع الغرامات" style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',fontSize:'.7rem',opacity:.6}}>⚖️</span>}
                  </div>
                  <button onClick={() => removeRow(i)} style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:7,padding:'8px 9px',color:'#f87171',cursor:'pointer',fontSize:'.82rem',flexShrink:0,lineHeight:1}}>✕</button>
                </div>
                {/* Auto-scale hint */}
                {hasGrams && <div style={{fontSize:'.62rem',color:'rgba(203,162,59,0.5)',marginBottom:6,marginTop:-2}}>⚖️ Nutrition auto-scales when you change the gram value</div>}
                {/* Nutrition fields */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5}}>
                  {[['كالوري (kcal)','calories'],['بروتين g','protein_g'],['كارب g','carbs_g'],['دهن g','fat_g'],['ألياف g','fiber_g']].map(([label,key]) => (
                    <div key={key}>
                      <div style={{fontSize:'.56rem',color:'rgba(255,255,255,0.25)',marginBottom:3,fontWeight:700,textAlign:'center'}}>{label.toUpperCase()}</div>
                      <input type="number" inputMode="decimal" value={ing[key] || ''} placeholder="0" onChange={e => updateRow(i, key, e.target.value)} style={{textAlign:'center',padding:'6px 4px',fontSize:'.82rem'}}/>
                    </div>
                  ))}
                </div>
              </div>
            )})}

            <button onClick={addRow} style={{width:'100%',padding:'10px',background:'rgba(255,255,255,0.03)',border:'1px dashed rgba(255,255,255,0.14)',borderRadius:10,color:'rgba(255,255,255,0.4)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontWeight:600,fontSize:'.82rem',marginBottom:14}}>
              + أضف مكوّن
            </button>
            <button onClick={saveIngredients} disabled={saving} style={{width:'100%',padding:'15px',background:'#CBA23B',border:'none',borderRadius:13,fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.95rem',color:'#0C0B0D',cursor:saving?'not-allowed':'pointer',transition:'all .2s'}}>
              {saving ? 'حافظين…' : 'تم تحديث البيانات ✔️'}
            </button>
          </div>
        )}

        {/* ── RE-ANALYZE ── */}
        {tab === 'reanalyze' && (
          <div>
            <div style={{color:'rgba(255,255,255,0.35)',fontSize:'.78rem',marginBottom:14,lineHeight:1.55}}>
              Upload a new photo or update the description - AI will recalculate all nutrition data and ingredients.
            </div>
            <div onClick={() => { fileRef.current.removeAttribute('capture'); fileRef.current.click() }}
              style={{border:'2px dashed ' + (imgPreview?'rgba(255,255,255,0.1)':'rgba(203,162,59,0.10)'),borderRadius:14,overflow:'hidden',marginBottom:8,cursor:'pointer',minHeight:imgPreview?0:90,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.2)'}}>
              {imgPreview
                ? <div style={{position:'relative',width:'100%'}}><img src={imgPreview} alt="" style={{width:'100%',maxHeight:180,objectFit:'cover',display:'block'}}/><div style={{position:'absolute',bottom:6,right:6,background:'rgba(0,0,0,.75)',borderRadius:6,padding:'3px 8px',fontSize:'.65rem',color:'rgba(255,255,255,.5)'}}>tap to change</div></div>
                : <div style={{textAlign:'center',padding:'18px'}}><div style={{fontSize:'1.8rem',marginBottom:4}}>📸</div><div style={{color:'rgba(255,255,255,0.25)',fontSize:'.8rem'}}>Upload new photo (optional)</div></div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e => loadImg(e.target.files[0])}/>
            <div style={{display:'flex',gap:6,marginBottom:10}}>
              <button onClick={() => { fileRef.current.removeAttribute('capture'); fileRef.current.click() }} style={{flex:1,padding:'9px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:9,color:'rgba(255,255,255,0.55)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.78rem',fontWeight:600}}>🖼 Gallery</button>
              <button onClick={() => { fileRef.current.setAttribute('capture','environment'); fileRef.current.click() }} style={{flex:1,padding:'9px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:9,color:'rgba(255,255,255,0.55)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.78rem',fontWeight:600}}>📷 Camera</button>
            </div>
            <textarea placeholder="صف وجبتك بدقة — مثال: ٤ بيضات مقلية، ٢٠g لوز، أرز أبيض…" value={textInput} onChange={e => setTextInput(e.target.value)} rows={3} style={{marginBottom:8,resize:'none',lineHeight:1.55}}/>
            {err && <div style={{color:'#fca5a5',fontSize:'.78rem',marginBottom:8,padding:'9px 12px',background:'rgba(239,68,68,.08)',borderRadius:9,border:'1px solid rgba(239,68,68,.2)'}}>{err}</div>}

            {/* AI result preview */}
            {reResult && (
              <div style={{background:'rgba(203,162,59,0.07)',border:'1px solid rgba(203,162,59,0.2)',borderRadius:11,padding:'11px 13px',marginBottom:10}}>
                <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,marginBottom:5,fontSize:'.92rem'}}>{reResult.meal_name}</div>
                <div style={{display:'flex',gap:10,fontSize:'.75rem',flexWrap:'wrap'}}>
                  <span style={{color:'#CBA23B',fontWeight:800}}>{reResult.total_calories} kcal</span>
                  <span style={{color:'#3b82f6',fontWeight:700}}>P {Math.round(reResult.protein_g||0)}g</span>
                  <span style={{color:'#f97316',fontWeight:700}}>C {Math.round(reResult.carbs_g||0)}g</span>
                  <span style={{color:'#a855f7',fontWeight:700}}>F {Math.round(reResult.fat_g||0)}g</span>
                </div>
                {reResult.ingredients?.length > 0 && (
                  <div style={{marginTop:8,fontSize:'.72rem',color:'rgba(255,255,255,0.4)'}}>
                    {reResult.ingredients.map((ing,i) => (
                      <div key={i} style={{padding:'2px 0'}}>{ing.name} - {ing.portion || ''} · {ing.calories} kcal</div>
                    ))}
                  </div>
                )}
                <div style={{fontSize:'.7rem',color:'rgba(203,162,59,0.5)',marginTop:6}}>✓ Also updated ingredients tab with these values</div>
              </div>
            )}

            {analyzing
              ? <div style={{textAlign:'center',padding:'18px'}}><div style={{width:36,height:36,border:'3px solid rgba(203,162,59,0.2)',borderTopColor:'#CBA23B',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 10px'}}/><div style={{color:'#CBA23B',fontWeight:600,fontSize:'.88rem'}}>Analyzing nutrition…</div></div>
              : <div style={{display:'flex',gap:8}}>
                  <button onClick={reanalyze} disabled={!imgB64 && !textInput.trim()}
                    style={{flex:1,padding:'13px',background:(!imgB64&&!textInput.trim())?'rgba(255,255,255,0.04)':'rgba(203,162,59,0.12)',border:'1px solid ' + ((!imgB64&&!textInput.trim())?'rgba(203,162,59,0.12)':'rgba(203,162,59,0.3)'),borderRadius:12,color:(!imgB64&&!textInput.trim())?'rgba(255,255,255,0.2)':'#CBA23B',cursor:(!imgB64&&!textInput.trim())?'not-allowed':'pointer',fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.88rem'}}>
                    🔍 Analyze
                  </button>
                  {reResult && <button onClick={saveReanalyzed} disabled={saving} style={{flex:1,padding:'13px',background:'#CBA23B',border:'none',borderRadius:12,fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.88rem',color:'#0C0B0D',cursor:saving?'not-allowed':'pointer'}}>{saving?'جاري الحفظ':'Save ✓'}</button>}
                </div>}
          </div>
        )}
      </div>
    </div>
  )
}
