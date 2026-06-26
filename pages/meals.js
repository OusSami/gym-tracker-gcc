import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { TopNav, BottomTabs } from '../components/Nav'
import { calcNutrientGoals, fmt } from '../lib/nutrition'

// ── Recipe categories (Tab 1) ─────────────────────────────────────────────
const CATEGORIES = [
  { label: 'الكل',           match: null },
  { label: 'أرز ومجبوس',    match: ['أرز','مجبوس','كبسة','برياني','مندي','رز','بخاري','مقلوبة','زربيان','قبولي','جريش','هريسة','باستا','معكرونة','مكرونة'] },
  { label: 'دجاج',           match: ['دجاج','دجاجة','فراخ','فرخة','تشيكن'] },
  { label: 'لحم',            match: ['لحم','لحمة','كباب','كفتة','شيش','مشاوي','ضلع','برغر','ستيك'] },
  { label: 'سمك',            match: ['سمك','ربيان','جمبري','قريدس','حبار','هامور','ميرو','فيليه','تونة'] },
  { label: 'حلويات',         match: ['حلوى','حلا','كيك','تمر','لقيمات','بسبوسة','كنافة','مهلبية','بقلاوة','سحلب','كوكيز','براونيز','تشيز','وافل','دونات'] },
  { label: 'شوربة',          match: ['شوربة','حساء','مرق'] },
  { label: 'سلطة',           match: ['سلطة','تبولة','فتوش'] },
  { label: 'فطور',           match: ['فطور','فول','فلافل','بيض','عجة','شكشوكة','أومليت'] },
  { label: 'أطباق خليجية',  match: ['غيمش','هريس','بليلة','هنيني','قوزي','مضبي','عصيد','سليق','حنيذ','مراصيع','مطازيز'] },
  { label: 'مقبلات',         match: ['مقبلات','دقوس','بابا غنوج','حمص','متبل','محمرة'] },
  { label: 'مشروبات',        match: ['عصير','شاي','قهوة','مشروب','كوكتيل','سموذي'] },
]

const VISUAL_CATEGORIES = [
  { label: 'أطباق رئيسية',  image: '/categories/cat-main-dish.webp',   filter: 'أرز ومجبوس',   emoji: '🍚', bg: '#FFF3E0' },
  { label: 'فطور',          image: '/categories/cat-breakfast.webp',    filter: 'فطور',          emoji: '🌅', bg: '#FFF8E1' },
  { label: 'حلويات',        image: '/categories/cat-dessert.webp',      filter: 'حلويات',        emoji: '🍯', bg: '#FCE4EC' },
  { label: 'شوربة',         image: '/categories/cat-soup.webp',         filter: 'شوربة',         emoji: '🥣', bg: '#E8F5E9' },
  { label: 'سلطة',          image: '/categories/cat-salad.webp',        filter: 'سلطة',          emoji: '🥗', bg: '#F1F8E9' },
  { label: 'مشويات',        image: '/categories/cat-grills.webp',       filter: 'لحم',           emoji: '🍖', bg: '#FBE9E7' },
  { label: 'مأكولات بحرية', image: '/categories/cat-seafood.webp',      filter: 'سمك',           emoji: '🐟', bg: '#E3F2FD' },
  { label: 'أطباق خليجية', image: '/categories/cat-gulf.webp',          filter: 'أطباق خليجية', emoji: '🫕', bg: '#FFF8E1' },
  { label: 'مشروبات',       image: '/categories/cat-drinks.webp',       filter: 'مشروبات',       emoji: '☕', bg: '#E8EAF6' },
  { label: 'صحي وخفيف',     image: '/categories/cat-healthy.webp',      filter: 'سلطة',          emoji: '🥬', bg: '#F1F8E9' },
  { label: 'سريع التحضير',  image: '/categories/cat-quick.webp',        filter: 'مقبلات',        emoji: '⚡', bg: '#FFF9C4' },
  { label: 'مقبلات',        image: '/categories/cat-appetizers.webp',   filter: 'مقبلات',        emoji: '🫙', bg: '#EDE7F6' },
]

// ── Meal types (Tab 2 AI analyzer — icon + color from original) ───────────
const MEAL_TYPES = [
  { id:'breakfast', label:'الفطور', icon:'☀️', color:'#eab308' },
  { id:'lunch',     label:'الغداء', icon:'🥗', color:'#22c55e' },
  { id:'dinner',    label:'العشاء', icon:'🌙', color:'#3b82f6' },
  { id:'snack',     label:'سناك',   icon:'🍎', color:'#f97316' },
]

const MEAL_COLORS = {
  breakfast: { bg: '#FFF3E0', emoji: '☀️' },
  lunch:     { bg: '#E8F5E9', emoji: '🌤️' },
  dinner:    { bg: '#EDE7F6', emoji: '🌙' },
  snack:     { bg: '#FCE4EC', emoji: '🍎' },
}

const MEAL_BTN_COLORS = {
  breakfast: { bg:'#FFF3E0', tc:'#E65100' },
  lunch:     { bg:'#E8F5E9', tc:'#2E7D32' },
  dinner:    { bg:'#EDE7F6', tc:'#4527A0' },
  snack:     { bg:'#FCE4EC', tc:'#880E4F' },
}

function getFoodVisual(name) {
  if (!name) return { emoji:'🍽️', bg:'#F7E9DF' }
  const n = name
  if (n.includes('أرز') || n.includes('رز') ||
      n.includes('كبسة') || n.includes('مجبوس') ||
      n.includes('برياني') || n.includes('مندي'))
    return { emoji:'🍚', bg:'#FFF3E0' }
  if (n.includes('دجاج') || n.includes('فراخ') ||
      n.includes('دجاجة'))
    return { emoji:'🍗', bg:'#FBE9E7' }
  if (n.includes('لحم') || n.includes('لحمة') ||
      n.includes('كباب') || n.includes('كفتة') ||
      n.includes('مشوي'))
    return { emoji:'🥩', bg:'#FCE4EC' }
  if (n.includes('سمك') || n.includes('ربيان') ||
      n.includes('تونة') || n.includes('جمبري'))
    return { emoji:'🐟', bg:'#E3F2FD' }
  if (n.includes('شوربة') || n.includes('حساء'))
    return { emoji:'🥣', bg:'#E8F5E9' }
  if (n.includes('سلطة') || n.includes('تبولة'))
    return { emoji:'🥗', bg:'#F1F8E9' }
  if (n.includes('حلوى') || n.includes('حلا') ||
      n.includes('كيك') || n.includes('تمر') ||
      n.includes('لقيمات') || n.includes('بسبوسة'))
    return { emoji:'🍯', bg:'#FFFDE7' }
  if (n.includes('بيض') || n.includes('فطور') ||
      n.includes('فول') || n.includes('فلافل'))
    return { emoji:'🥚', bg:'#FFF9C4' }
  if (n.includes('موز') || n.includes('تفاح') ||
      n.includes('فاكهة') || n.includes('أفوكادو'))
    return { emoji:'🍎', bg:'#FCE4EC' }
  if (n.includes('شوفان') || n.includes('أوتس'))
    return { emoji:'🥣', bg:'#FFF9C4' }
  if (n.includes('جريش'))
    return { emoji:'🌾', bg:'#FFF3E0' }
  if (n.includes('عصير') || n.includes('شاي') ||
      n.includes('قهوة') || n.includes('ماء') ||
      n.includes('حليب') || n.includes('لبن'))
    return { emoji:'🥤', bg:'#E8EAF6' }
  if (n.includes('خبز') || n.includes('توست') ||
      n.includes('نافوش'))
    return { emoji:'🍞', bg:'#FFF8E1' }
  if (n.includes('جبن') || n.includes('لبنة'))
    return { emoji:'🧀', bg:'#FFFDE7' }
  return { emoji:'🍽️', bg:'#F7E9DF' }
}

function findRecipeImage(mealName, recipes) {
  if (!mealName || !recipes?.length) return null
  const name = mealName.trim()

  const exact = recipes.find(r =>
    r.name === name ||
    r.name?.includes(name) ||
    name.includes(r.name)
  )
  if (exact?.image_url) return exact.image_url

  const words = name.split(/\s+/).filter(w => w.length > 2)
  let bestMatch = null
  let bestScore = 0

  for (const recipe of recipes) {
    if (!recipe.image_url) continue
    const score = words.filter(w => recipe.name?.includes(w)).length
    if (score > bestScore) {
      bestScore = score
      bestMatch = recipe
    }
  }

  if (bestScore >= 1) return bestMatch?.image_url
  return null
}

function searchRecipes(recipes, query) {
  if (!query || query.trim() === '') return recipes
  const q = query.trim()
  const terms = q.split(/\s+/).filter(t => t.length > 1)
  return recipes
    .map(recipe => {
      let score = 0
      if (recipe.name === q) score += 100
      if (recipe.name?.startsWith(q)) score += 50
      if (recipe.name?.includes(q)) score += 40
      terms.forEach(term => {
        if (recipe.name?.includes(term)) score += 20
      })
      terms.forEach(term => {
        if (recipe.category?.includes(term)) score += 10
      })
      if (recipe.ingredients?.length) {
        terms.forEach(term => {
          if (recipe.ingredients.some(ing => ing.includes(term))) score += 15
        })
      }
      return { recipe, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ recipe }) => recipe)
}

const todayStr = () => new Date().toISOString().split('T')[0]

const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// ── Full 16-nutrient array (from original e4f2f06) ────────────────────────
const NUTRIENTS = [
  { key:'protein_g',            label:'البروتين',                          unit:'g',   color:'#3b82f6', group:'macro'   },
  { key:'carbs_g',              label:'الكربوهيدرات',                     unit:'g',   color:'#f97316', group:'macro'   },
  { key:'fat_g',                label:'الدهون الكلية',                      unit:'g',   color:'#a855f7', group:'macro'   },
  { key:'fiber_g',              label:'الألياف',                           unit:'g',   color:'#22c55e', group:'macro'   },
  { key:'sugar_g',              label:'السكر',                             unit:'g',   color:'#eab308', group:'macro'   },
  { key:'saturated_fat_g',      label:'الدهون المشبعة',                    unit:'g',   color:'#ef4444', group:'fat'     },
  { key:'polyunsaturated_fat_g',label:'الدهون المتعددة غير المشبعة',      unit:'g',   color:'#06b6d4', group:'fat'     },
  { key:'monounsaturated_fat_g',label:'الدهون الأحادية غير المشبعة',      unit:'g',   color:'#8b5cf6', group:'fat'     },
  { key:'trans_fat_g',          label:'الدهون المتحولة',                   unit:'g',   color:'#dc2626', group:'fat'     },
  { key:'cholesterol_mg',       label:'الكوليسترول',                      unit:'mg',  color:'#b45309', group:'micro'   },
  { key:'sodium_mg',            label:'الصوديوم',                          unit:'mg',  color:'#0891b2', group:'micro'   },
  { key:'potassium_mg',         label:'البوتاسيوم',                       unit:'mg',  color:'#059669', group:'micro'   },
  { key:'vitamin_a_mcg',        label:'فيتامين A',                        unit:'mcg', color:'#d97706', group:'vitamin' },
  { key:'vitamin_c_mg',         label:'فيتامين C',                        unit:'mg',  color:'#ea580c', group:'vitamin' },
  { key:'calcium_mg',           label:'الكالسيوم',                         unit:'mg',  color:'#7c3aed', group:'mineral' },
  { key:'iron_mg',              label:'الحديد',                            unit:'mg',  color:'#dc2626', group:'mineral' },
]

const F = "'Tajawal',sans-serif"

// ── CSS ────────────────────────────────────────────────────────────────────
const STYLES = `
  .meals-container {
    max-width: 480px;
    margin: 0 auto;
    background-color: var(--surface);
    min-height: 100vh;
    direction: rtl;
  }
  @media (min-width: 768px) {
    .meals-container { max-width: 900px; }
  }
  .recipe-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: 768px) {
    .recipe-grid { grid-template-columns: repeat(3, 1fr); }
    .recipe-card-img { height: 160px !important; }
  }
  @media (min-width: 1024px) {
    .recipe-grid { grid-template-columns: repeat(4, 1fr); }
  }
  .stat-scroll::-webkit-scrollbar { display: none; }
  .stat-scroll { scrollbar-width: none; }
  .chips-scroll::-webkit-scrollbar { display: none; }
  .chips-scroll { scrollbar-width: none; }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
  .skeleton { animation: pulse 1.5s ease-in-out infinite; }
  .recipe-card-hover { cursor: pointer; transition: transform .15s, box-shadow .15s; }
  .recipe-card-hover:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(168,120,90,0.18); }
  @keyframes spin { to { transform: rotate(360deg); } }
  * { box-sizing: border-box; }
  .ptab { background:transparent;border:none;border-bottom:2px solid transparent;color:var(--text-secondary);font-family:'DM Sans','Tajawal',sans-serif;font-size:.82rem;font-weight:600;padding:10px 10px;cursor:pointer;transition:all .2s;white-space:nowrap; }
  .ptab.on { color:var(--text-primary);border-bottom-color:var(--accent); }
  .mrow { display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--accent-faint); }
  .mrow:last-child { border-bottom:none; }
  input,textarea { background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#ECE3CF;padding:11px 14px;font-family:'DM Sans','Tajawal',sans-serif;font-size:.9rem;border-radius:10px;outline:none;width:100%;transition:all .2s; }
  input:focus,textarea:focus { border-color:#CBA23B;background:rgba(203,162,59,0.04); }
  ::placeholder { color:rgba(255,255,255,0.2); }
  .t3-textarea::placeholder { color: var(--text-secondary); opacity: 0.7; }
`

// ── Module-level helpers (stable identity — prevents re-mount on parent render) ──

function RecipeImgFallback({ name, height, className }) {
  return (
    <div className={className} style={{
      width: '100%', height,
      backgroundColor: 'var(--accent-soft)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 4,
    }}>
      <span style={{ fontSize: 28 }}>🍽️</span>
      <span style={{
        fontSize: 11, color: 'var(--text-secondary)',
        textAlign: 'center', paddingInline: 8,
        display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{name}</span>
    </div>
  )
}

function CategoryCardImg({ src, bg, emoji }) {
  const [errored, setErrored] = React.useState(false)
  if (!src || errored) {
    return (
      <div style={{
        position: 'absolute', inset: 0, backgroundColor: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
      }}>{emoji}</div>
    )
  }
  return (
    <img src={src} alt=""
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      onError={() => setErrored(true)} />
  )
}

function RecipeImg({ src, name = '' }) {
  const [errored, setErrored] = React.useState(false)
  if (!src || errored) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: 'var(--accent-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
      }}>🍽️</div>
    )
  }
  return (
    <img src={src} alt=""
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      onError={() => setErrored(true)} />
  )
}

function CalorieRingSimple({ totalCal, goalCal }) {
  const r = 35, cx = 45, cy = 45
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(totalCal / Math.max(goalCal, 1), 1))
  return (
    <svg width={90} height={90} viewBox="0 0 90 90" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--accent-faint)" strokeWidth={8} />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="var(--accent)" strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 3} textAnchor="middle"
        fontSize={13} fontWeight={700} fill="var(--text-primary)" fontFamily={F}>
        {totalCal}
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle"
        fontSize={10} fill="var(--text-secondary)" fontFamily={F}>
        سعرة
      </text>
    </svg>
  )
}

function MacroBar({ label, value, goal, color }) {
  const pct = Math.min((value / Math.max(goal, 1)) * 100, 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBlockStart: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 38, textAlign: 'right', fontFamily: F }}>
        {Math.round(value)}g
      </span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: 'var(--accent-faint)' }}>
        <div style={{ height: '100%', borderRadius: 2, width: pct + '%', backgroundColor: color, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600, minWidth: 34, fontFamily: F }}>
        {label}
      </span>
    </div>
  )
}

function SearchAndChips({ search, onSearch, activeCategory, onCategory, showChips = true }) {
  return (
    <>
      <div style={{ marginInline: 16, marginBlockEnd: 12, position: 'relative' }}>
        <div style={{
          backgroundColor: '#1A1A1A', borderRadius: 30,
          paddingInline: 16, paddingBlock: 12,
          display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, flexShrink: 0 }}>🔍</span>
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="ابحثي عن وصفة أو مكوّن..."
            style={{
              flex: 1, color: '#FFFFFF', backgroundColor: 'transparent',
              border: 'none', outline: 'none', textAlign: 'right',
              fontSize: 14, fontFamily: F,
            }}
          />
          {search.length > 0 && (
            <button
              onClick={() => onSearch('')}
              style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 50,
                width: 22, height: 22, color: '#FFFFFF', fontSize: 14,
                cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                paddingBottom: 1,
              }}
            >×</button>
          )}
        </div>
      </div>
      {showChips && (
        <div className="chips-scroll" style={{ display: 'flex', overflowX: 'auto', gap: 8, paddingInline: 16, paddingBlockEnd: 12 }}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.label
            return (
              <button key={cat.label} onClick={() => onCategory(cat.label)} style={{
                paddingInline: 14, paddingBlock: 7, borderRadius: 20,
                fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: F, flexShrink: 0,
                backgroundColor: isActive ? 'var(--text-primary)' : 'var(--card)',
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                border: isActive ? 'none' : '1px solid var(--accent-soft)',
              }}>
                {cat.label}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

function RecipeDetail({ recipe, onBack, favorites, toggleFavorite, onLogMeal }) {
  const [detailTab, setDetailTab] = useState('ingredients')
  const [per100g, setPer100g] = useState(false)
  const [addingToMeal, setAddingToMeal] = useState(false)
  const [addedToMeal, setAddedToMeal] = useState(false)
  const [showMealTypeSheet, setShowMealTypeSheet] = useState(false)

  const handleAddToMeal = async (mealTypeId) => {
    if (!onLogMeal) return
    setAddingToMeal(true)
    try {
      await onLogMeal(mealTypeId)
      setAddedToMeal(true)
      setShowMealTypeSheet(false)
      setTimeout(() => setAddedToMeal(false), 3000)
    } catch(e) { console.error(e) }
    finally { setAddingToMeal(false) }
  }

  return (
    <div style={{ direction: 'rtl', backgroundColor: 'var(--surface)', minHeight: '100vh' }}>
      <div style={{ paddingInline: 16, paddingBlock: 12, textAlign: 'right' }}>
        <button onClick={onBack} style={{
          fontSize: 14, color: 'var(--accent)', border: 'none',
          background: 'none', cursor: 'pointer', fontFamily: F, fontWeight: 600,
        }}>
          → رجوع
        </button>
      </div>
      <div style={{ position: 'relative', height: 280, overflow: 'hidden' }}>
        {recipe.image_url
          ? <img src={recipe.image_url} alt=""
              style={{ width: '100%', height: 280, objectFit: 'cover', objectPosition: 'center 30%', display: 'block' }} />
          : <div style={{ height: 280, backgroundColor: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>🍽️</div>
        }
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.65) 100%)' }} />
        <div style={{
          position: 'absolute', bottom: 16, insetInlineEnd: 16, insetInlineStart: 16,
          fontSize: 22, fontWeight: 700, color: '#FFFFFF', textAlign: 'right', fontFamily: F,
        }}>
          {recipe.name}
        </div>
      </div>
      <div style={{ backgroundColor: 'var(--card)', paddingBlock: 14, paddingInline: 16, display: 'flex', flexDirection: 'row', justifyContent: 'space-around' }}>
        <button onClick={() => toggleFavorite && toggleFavorite(recipe.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            border: 'none', background: 'none', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 22 }}>{favorites?.has(recipe.id) ? '❤️' : '🤍'}</span>
            <span style={{ fontSize: 11, color: favorites?.has(recipe.id) ? '#EF4444' : 'var(--text-secondary)', fontFamily: F }}>المفضلة</span>
          </button>
          {[{ icon: '📅', label: 'جدولة' }, { icon: '🔗', label: 'مشاركة' }].map(({ icon, label }) => (
          <button key={label} onClick={() => {}} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            border: 'none', background: 'none', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: F }}>{label}</span>
          </button>
        ))}
        {onLogMeal && (
          <button onClick={() => setShowMealTypeSheet(true)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            border: 'none', background: 'none', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 22 }}>{addedToMeal ? '✅' : '🍽️'}</span>
            <span style={{ fontSize: 11, color: addedToMeal ? '#22C55E' : 'var(--text-secondary)', fontFamily: F }}>
              {addedToMeal ? 'تمت الإضافة' : 'أضيفي للوجبة'}
            </span>
          </button>
        )}
      </div>

      {/* Meal type picker sheet */}
      {showMealTypeSheet && (
        <>
          <div onClick={() => setShowMealTypeSheet(false)} style={{
            position: 'fixed', inset: 0, zIndex: 200,
            backgroundColor: 'rgba(0,0,0,0.5)'
          }}/>
          <div style={{
            position: 'fixed', bottom: 0,
            insetInlineStart: 0, insetInlineEnd: 0,
            zIndex: 201, backgroundColor: '#FFFFFF',
            borderRadius: '24px 24px 0 0',
            padding: 24, paddingBlockEnd: 40,
            direction: 'rtl',
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0D5CC', margin: '0 auto 20px' }}/>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#3D2A1F', textAlign: 'right', marginBlockEnd: 16 }}>أضيفي لأي وجبة؟</p>
            {[
              { id: 'breakfast', label: 'الفطور', emoji: '☀️', bg: '#FFF3E0', color: '#E65100' },
              { id: 'lunch',     label: 'الغداء', emoji: '🌤️', bg: '#E8F5E9', color: '#2E7D32' },
              { id: 'dinner',    label: 'العشاء', emoji: '🌙', bg: '#EDE7F6', color: '#4527A0' },
              { id: 'snack',     label: 'سناك',   emoji: '🍎', bg: '#FCE4EC', color: '#880E4F' },
            ].map(t => (
              <button key={t.id}
                onClick={() => handleAddToMeal(t.id)}
                disabled={addingToMeal}
                style={{
                  width: '100%', padding: 16, marginBlockEnd: 10, borderRadius: 16,
                  backgroundColor: t.bg, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  opacity: addingToMeal ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: 20 }}>{t.emoji}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: t.color, fontFamily: F }}>{t.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {(recipe.cook_time || recipe.servings) && (
        <div style={{ paddingInline: 16, paddingBlock: 10, display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
          {recipe.cook_time && <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: F }}>🕐 {recipe.cook_time}</span>}
          {recipe.servings  && <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: F }}>👥 {recipe.servings}</span>}
        </div>
      )}
      {recipe.calories > 0 && (() => {
        const vals = per100g
          ? { p: recipe.protein_per_100g, c: recipe.carbs_per_100g, f: recipe.fat_per_100g, fi: recipe.fiber_g }
          : { p: recipe.protein_g,        c: recipe.carbs_g,        f: recipe.fat_g,        fi: recipe.fiber_g }
        const displayCal = per100g ? (recipe.cal_per_100g || '-') : (recipe.calories || '-')
        const hasFiber = recipe.fiber_g > 0
        const macros = [
          { key: 'p',  label: 'بروتين', color: '#3B82F6', val: vals.p,  goal: 50 },
          { key: 'c',  label: 'كارب',   color: '#F59E0B', val: vals.c,  goal: 70 },
          { key: 'f',  label: 'دهن',    color: '#8B5CF6', val: vals.f,  goal: 35 },
          ...(hasFiber ? [{ key: 'fi', label: 'ألياف', color: '#22C55E', val: vals.fi, goal: 10 }] : []),
        ]
        return (
          <div style={{
            marginInline: 16, marginBlockStart: 12, marginBlockEnd: 4,
            backgroundColor: 'var(--card)', borderRadius: 20,
            overflow: 'hidden', boxShadow: 'var(--shadow-card)',
          }}>
            {/* Section 1 — Toggle */}
            <div style={{ display: 'flex', width: '100%' }}>
              {[{ label: 'حصة كاملة', val: false }, { label: '100g', val: true }].map(({ label, val }) => (
                <button key={label} onClick={() => setPer100g(val)} style={{
                  flex: 1, paddingBlock: 14, fontSize: 15, fontWeight: 700,
                  border: 'none', cursor: 'pointer', fontFamily: F, transition: 'all 0.2s',
                  backgroundColor: per100g === val ? 'var(--text-primary)' : 'var(--surface-inset)',
                  color: per100g === val ? '#FFFFFF' : 'var(--text-secondary)',
                }}>
                  {label}
                </button>
              ))}
            </div>
            {/* Section 2 — Calorie display */}
            <div style={{ paddingBlock: 20, textAlign: 'center', borderBottom: '1px solid var(--accent-faint)' }}>
              <span style={{ fontSize: 48, fontWeight: 800, color: 'var(--accent)', lineHeight: 1, display: 'block', fontFamily: F }}>
                {displayCal}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginBlockStart: 6, display: 'block', fontFamily: F }}>
                سعرة حرارية
              </span>
            </div>
            {/* Section 3 — Macro grid */}
            <div style={{ display: 'grid', gridTemplateColumns: hasFiber ? 'repeat(4,1fr)' : 'repeat(3,1fr)' }}>
              {macros.map(({ key, label, color, val, goal }, idx) => (
                <div key={key} style={{
                  paddingBlock: 16, paddingInline: 8, textAlign: 'center',
                  borderInlineEnd: idx < macros.length - 1 ? '1px solid var(--accent-faint)' : 'none',
                }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color, fontFamily: F, display: 'block' }}>
                    {val ?? '-'}g
                  </span>
                  <div style={{ marginBlock: '8px auto', width: '60%', height: 4, borderRadius: 2, backgroundColor: 'var(--accent-faint)', marginInline: 'auto' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, backgroundColor: color,
                      width: val != null ? Math.min(val / goal * 100, 100) + '%' : '0%',
                    }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: F }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--accent-faint)', marginInline: 16, marginBlockStart: 8 }}>
        {[{ key: 'ingredients', label: 'المكونات' }, { key: 'steps', label: 'طريقة التحضير' }].map(({ key, label }) => (
          <button key={key} onClick={() => setDetailTab(key)} style={{
            flex: 1, paddingBlock: 12, textAlign: 'center',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            border: 'none', background: 'none', fontFamily: F,
            color: detailTab === key ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderBottom: detailTab === key ? '2px solid var(--text-primary)' : '2px solid transparent',
            transition: 'color .15s, border-color .15s',
          }}>
            {label}
          </button>
        ))}
      </div>
      {detailTab === 'ingredients' && (
        <div style={{ paddingInline: 16, paddingBlockStart: 12, paddingBlockEnd: 80 }}>
          {(recipe.ingredients ?? []).map((ing, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              paddingBlock: 10, borderBottom: '1px solid var(--accent-faint)',
            }}>
              <span style={{ fontSize: 14, color: 'var(--text-primary)', textAlign: 'right', fontFamily: F, flex: 1 }}>{ing}</span>
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--accent)', marginInlineStart: 10, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}
      {detailTab === 'steps' && (
        <div style={{ paddingInline: 16, paddingBlockStart: 12, paddingBlockEnd: 80 }}>
          {(recipe.steps ?? []).map((step, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10,
              marginBlockEnd: 12, padding: 14,
              backgroundColor: 'var(--card)', borderRadius: 12, boxShadow: 'var(--shadow-card)',
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 13,
                backgroundColor: 'var(--accent)', color: '#FFFFFF',
                fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{i + 1}</div>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', textAlign: 'right', lineHeight: 1.7, margin: 0, flex: 1, fontFamily: F }}>{step}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function Meals() {
  const router = useRouter()

  // ── Auth ────────────────────────────────────────────────────────────────
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [goals, setGoals]     = useState(null)

  // ── Top-level 3-tab bar ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('recipes')

  // ── Tab 1: Recipe browser ────────────────────────────────────────────────
  const [recipes, setRecipes]               = useState([])
  const [recipesLoading, setRecipesLoading] = useState(true)
  const [search, setSearch]                 = useState('')
  const [activeCategory, setActiveCategory] = useState('الكل')
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [showAllRecipes, setShowAllRecipes] = useState(false)

  // ── Tab 2: Full AI analyzer state (from original e4f2f06) ────────────────
  const [viewDate, setViewDate]                 = useState(todayStr())
  const [meals, setMeals]                       = useState([])
  const [water, setWater]                       = useState([])
  const [loading, setLoading]                   = useState(true)
  const [tab, setTab]                           = useState('plan')   // internal sub-tab
  const [mealType, setMealType]                 = useState(null)
  const [imgB64, setImgB64]                     = useState(null)
  const [imgMime, setImgMime]                   = useState('image/jpeg')
  const [imgPreview, setImgPreview]             = useState(null)
  const [textInput, setTextInput]               = useState('')
  const [analyzing, setAnalyzing]               = useState(false)
  const [result, setResult]                     = useState(null)
  const [err, setErr]                           = useState('')
  const [saving, setSaving]                     = useState(false)
  const [expandMeal, setExpandMeal]             = useState(null)
  const [editMeal, setEditMeal]                 = useState(null)
  const [report, setReport]                     = useState(null)
  const [reportLoading, setReportLoading]       = useState(false)
  const [reportErr, setReportErr]               = useState('')
  const [savedMealsHash, setSavedMealsHash]     = useState(null)
  const [reportDate, setReportDate]             = useState(null)
  const fileRef                                 = useRef(null)
  const [customMeals, setCustomMeals]           = useState([])
  const [gccSearch, setGccSearch]               = useState('')
  const [gccResults, setGccResults]             = useState([])
  const [gccLoading, setGccLoading]             = useState(false)
  const [showGcc, setShowGcc]                   = useState(false)
  const [showCustom, setShowCustom]             = useState(false)
  const [showRecentMeals, setShowRecentMeals]   = useState(false)
  const [recentMealsByType, setRecentMealsByType] = useState({})
  const [addMealType, setAddMealType]             = useState('breakfast')
  const [showAddMeal, setShowAddMeal]             = useState(false)
  const [barcode, setBarcode]                   = useState('')
  const [barcodeLoading, setBarcodeLoading]     = useState(false)
  const [savingTemplate, setSavingTemplate]     = useState(false)
  const [mealPlan, setMealPlan]                 = useState(null)
  const [mealPlanLoading, setMealPlanLoading]   = useState(false)
  const [weekPlan, setWeekPlan]                 = useState([])
  const [weekLoading, setWeekLoading]           = useState(true)
  const [expandedDay, setExpandedDay]           = useState(null)
  const [weekStart, setWeekStart]               = useState(null)
  const [favorites, setFavorites]               = useState(new Set())
  const [selectedMeal, setSelectedMeal]         = useState(null)
  const [loggingProgramMeals, setLoggingProgramMeals] = useState(false)
  const [programMealsLogged, setProgramMealsLogged]   = useState(false)
  const [loggedPlanMeals, setLoggedPlanMeals]         = useState(new Set())

  // ── Tab 3: AI analyzer (isolated state) ─────────────────────────────────
  const [t3MealType, setT3MealType]       = useState('breakfast')
  const [t3ImgB64, setT3ImgB64]           = useState(null)
  const [t3ImgMime, setT3ImgMime]         = useState('image/jpeg')
  const [t3ImgPreview, setT3ImgPreview]   = useState(null)
  const [t3TextInput, setT3TextInput]     = useState('')
  const [t3Analyzing, setT3Analyzing]     = useState(false)
  const [t3Result, setT3Result]           = useState(null)
  const [t3Err, setT3Err]                 = useState('')
  const [t3Saving, setT3Saving]           = useState(false)
  const t3FileRef                         = useRef(null)

  // ── Tab 2: loadDay ───────────────────────────────────────────────────────
  const loadDay = useCallback(async (uid, date) => {
    try {
      const r = await fetch('/api/meals?userId=' + uid + '&date=' + date)
      const d = await r.json()
      if (r.ok) { setMeals(d.meals || []); setWater(d.water || []) }
    } catch (e) {}
    try {
      const rr = await fetch('/api/meal-report?userId=' + uid + '&date=' + date)
      const rd = await rr.json()
      if (rr.ok && rd.report) {
        setReport(rd.report)
        setSavedMealsHash(rd.meals_hash || null)
        setReportDate(date)
      } else {
        setReport(null); setSavedMealsHash(null); setReportDate(null)
      }
    } catch (e) {}
    setLoading(false)
  }, [])

  // ── Mount ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/'); return }
      const u = session.user
      setUser(u)

      // Meal plan — fire and forget
      setMealPlanLoading(true)
      fetch('/api/packages/meal-plan?userId=' + u.id)
        .then(r => r.json())
        .then(d => { if (d?.plan) setMealPlan(d) })
        .catch(() => {})
        .finally(() => setMealPlanLoading(false))

      // Profile + recipes in parallel
      const [profResult, recipeResult] = await Promise.allSettled([
        fetch('/api/profile?userId=' + u.id).then(r => r.json()),
        supabase.from('recipes').select('*'),
      ])

      if (profResult.status === 'fulfilled' && profResult.value?.profile) {
        setProfile(profResult.value.profile)
        setGoals(calcNutrientGoals(profResult.value.profile))
      }
      if (recipeResult.status === 'fulfilled') {
        const { data, error } = recipeResult.value
        if (!error && data) {
          const arr = [...data]
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]]
          }
          setRecipes(arr)
        }
      }
      setRecipesLoading(false)

      // Load today's meals + custom meal templates in parallel
      await loadDay(u.id, todayStr())
      const cmr = await fetch('/api/custom-meals?userId=' + u.id)
      const cmd = await cmr.json()
      if (cmr.ok) setCustomMeals(cmd.meals || [])

      // Pre-load yesterday for quick copy
      try {
        const yd = new Date(); yd.setDate(yd.getDate() - 1)
        const ydStr = yd.toISOString().split('T')[0]
        const yr = await fetch('/api/meals?userId=' + u.id + '&date=' + ydStr)
        const yd2 = await yr.json()
        if (yr.ok && yd2.meals?.length) {
          const byType = {}
          yd2.meals.forEach(m => {
            if (!byType[m.meal_type]) byType[m.meal_type] = []
            byType[m.meal_type].push(m)
          })
          setRecentMealsByType(byType)
        }
      } catch (e) {}
    }
    init()
  }, [])

  // ── Re-fetch meals when viewDate changes (Tab 2) ─────────────────────────
  useEffect(() => { if (user) loadDay(user.id, viewDate) }, [viewDate, user])

  // ── Load week plan once user is available ────────────────────────────────
  useEffect(() => { if (user?.id && weekPlan.length === 0) loadWeekPlan() }, [user?.id])

  // ── Load favorites once user is available ───────────────────────────────
  useEffect(() => { if (user?.id) loadFavorites() }, [user?.id])

  // ── Re-enrich week plan with recipe images once both are loaded ───────────
  // loadWeekPlan() runs before recipes are fetched (recipes=[] at that point),
  // so findRecipeImage always returns null. This effect fires once when both
  // weekPlan (7 days) and recipes are available and patches image_url in place.
  useEffect(() => {
    if (!weekPlan.length || !recipes.length) return
    const enriched = weekPlan.map(day => ({
      ...day,
      plan: day.plan.map(meal => {
        const img = findRecipeImage(meal.food?.name_ar, recipes)
        return { ...meal, food: { ...meal.food, image_url: img || meal.food?.image_url } }
      })
    }))
    setWeekPlan(enriched)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes.length, weekPlan.length === 7 ? 7 : 0])

  // ── Tab 2: all functions from original e4f2f06 ───────────────────────────

  const loadImg = file => {
    if (!file) return
    setErr('')
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1200
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) { const ratio = Math.min(MAX / w, MAX / h); w = Math.round(w * ratio); h = Math.round(h * ratio) }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        const fr = new FileReader()
        fr.onload = e => { const d = e.target.result; setImgPreview(d); setImgB64(d.split(',')[1]); setImgMime('image/jpeg') }
        fr.readAsDataURL(blob)
      }, 'image/jpeg', 0.8)
    }
    img.onerror = () => {
      const fr = new FileReader()
      fr.onload = e => { const d = e.target.result; setImgPreview(d); setImgB64(d.split(',')[1]); setImgMime(file.type || 'image/jpeg') }
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imgB64 || null, imageMime: imgMime, textInput: textInput.trim() || null, mealType, userGoals: G })
      })
    } catch (e) { setErr('Network error: ' + e.message); setAnalyzing(false); return }
    try { data = await r.json() } catch (e) {
      if (r.status === 413) setErr('الصورة كبيرة. جرب أصغر أو صف الوجبة نصاً.')
      else setErr('Server error (' + r.status + '). Try again or use the text description.')
      setAnalyzing(false); return
    }
    if (!r.ok || data.error) { setErr(data.error || 'التحليل فشل'); setAnalyzing(false); return }
    setResult(data)
    setAnalyzing(false)
  }

  const lookupBarcode = async () => {
    if (!barcode.trim()) return
    setBarcodeLoading(true); setErr('')
    try {
      const r = await fetch('/api/barcode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ barcode: barcode.trim() }) })
      const data = await r.json()
      if (data.found) { setResult(data) }
      else setErr(data.error || 'ما لقيناه في قاعدة البيانات — جرب اكتب الاسم يدوياً.')
    } catch (e) { setErr('Barcode lookup failed: ' + e.message) }
    setBarcodeLoading(false)
  }

  const processBarcodeImage = async (file) => {
    if (!file) return
    setBarcodeLoading(true); setErr('')
    try {
      const compressed = await new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
          URL.revokeObjectURL(url)
          const MAX = 1000
          let w = img.width, h = img.height
          if (w > MAX || h > MAX) { const ratio = Math.min(MAX / w, MAX / h); w = Math.round(w * ratio); h = Math.round(h * ratio) }
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64, imageMime: 'image/jpeg' })
      })
      const data = await r.json()
      if (data.found) { setResult(data) }
      else setErr(data.error || 'No barcode/QR found. Try better lighting, or type the number above.')
    } catch (e) { setErr('Scan error: ' + e.message) }
    setBarcodeLoading(false)
  }

  const scanBarcodeImage = (useCamera) => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    if (useCamera) inp.setAttribute('capture', 'environment')
    inp.onchange = e => processBarcodeImage(e.target.files[0])
    inp.click()
  }

  const useCustomMeal = (meal) => {
    setResult({ ...meal })
    fetch('/api/custom-meals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: meal.id }) }).catch(() => {})
    setShowCustom(false)
  }

  const saveAsTemplate = async (finalResult) => {
    const data = finalResult || result
    if (!data || !user) return
    setSavingTemplate(true)
    await fetch('/api/custom-meals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, ...data, meal_type: mealType }) })
    const cmr = await fetch('/api/custom-meals?userId=' + user.id)
    const cmd = await cmr.json()
    if (cmr.ok) setCustomMeals(cmd.meals || [])
    setSavingTemplate(false)
  }

  const saveMeal = async (finalResult) => {
    const data = finalResult || result
    if (!data || !user) return
    setSaving(true)
    try {
      const matchedImage = findRecipeImage(data.meal_name || result?.meal_name, recipes)

      let photoUrl = null
      if (imgB64 && imgMime) {
        try {
          const blob = await fetch(`data:${imgMime};base64,${imgB64}`).then(r => r.blob())
          const filename = `meal-${user.id}-${Date.now()}.jpg`
          const { error: uploadError } = await supabase.storage
            .from('meal-photos')
            .upload(filename, blob, { contentType: imgMime, upsert: true })
          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('meal-photos')
              .getPublicUrl(filename)
            photoUrl = urlData.publicUrl
          }
        } catch (e) {
          console.error('Photo upload failed:', e)
        }
      }

      const finalImageUrl = photoUrl || matchedImage
      const body = { userId: user.id, mealType, meal_date: viewDate, ...data, image_url: finalImageUrl }
      const r = await fetch('/api/meals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (r.ok) { await loadDay(user.id, viewDate); resetAdd(); setTab('daily') }
      else setErr(d.error || 'تعذر الحفظ')
    } catch (e) { setErr('Save error: ' + e.message) }
    setSaving(false)
  }

  const updateMeal = async (id, changes) => {
    await fetch('/api/meals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, userId: user.id, ...changes }) })
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
    } catch (e) { setReportErr('Error: ' + e.message) }
    setReportLoading(false)
  }

  const deleteMeal = async (id, type) => {
    if (!confirm('تبي تمسح؟')) return
    await fetch('/api/meals', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, type, userId: user.id }) })
    await loadDay(user.id, viewDate); setExpandMeal(null)
  }

  const logWater = async ml => {
    await fetch('/api/meals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, mealType: 'water', amount_ml: ml, meal_date: viewDate }) })
    await loadDay(user.id, viewDate)
  }

  const searchGcc = async (q) => {
    setGccSearch(q)
    if (!q || q.length < 2) { setGccResults([]); return }
    setGccLoading(true)
    try {
      const r = await fetch(`/api/gcc-foods?q=${encodeURIComponent(q)}&limit=8`)
      const d = await r.json()
      setGccResults(d.foods || [])
    } catch (e) { setGccResults([]) }
    setGccLoading(false)
  }

  const useGccFood = async (food) => {
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
      setGccSearch(''); setGccResults([]); setShowGcc(false)
    }
  }

  const resetAdd = () => {
    setMealType(null); setImgB64(null); setImgPreview(null)
    setTextInput(''); setResult(null); setErr(''); setShowRecentMeals(false)
  }

  const prevDay = () => { const d = new Date(viewDate + 'T12:00:00'); d.setDate(d.getDate() - 1); setViewDate(d.toISOString().split('T')[0]) }
  const nextDay = () => { const d = new Date(viewDate + 'T12:00:00'); d.setDate(d.getDate() + 1); if (d <= new Date()) setViewDate(d.toISOString().split('T')[0]) }

  const copyFromDate = async (fromDate, mealTypeToCopy) => {
    if (!user) return
    try {
      const r = await fetch('/api/meals?userId=' + user.id + '&date=' + fromDate)
      const d = await r.json()
      const sourceMeals = (d.meals || []).filter(m => !mealTypeToCopy || m.meal_type === mealTypeToCopy)
      if (!sourceMeals.length) return
      for (const meal of sourceMeals) {
        const payload = {
          userId: user.id, mealType: meal.meal_type, meal_date: viewDate,
          meal_name: meal.meal_name, total_calories: meal.total_calories,
          protein_g: meal.protein_g, carbs_g: meal.carbs_g, fat_g: meal.fat_g,
          fiber_g: meal.fiber_g, sugar_g: meal.sugar_g, saturated_fat_g: meal.saturated_fat_g,
          sodium_mg: meal.sodium_mg, potassium_mg: meal.potassium_mg,
          portion_note: meal.portion_note, health_score: meal.health_score,
          ingredients: meal.ingredients, vitamins: meal.vitamins, allergens: meal.allergens,
        }
        await fetch('/api/meals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      await loadDay(user.id, viewDate)
    } catch (e) { console.error('copyFromDate error:', e) }
  }

  const logProgramMeals = async () => {
    if (!user?.id || loggingProgramMeals) return
    setLoggingProgramMeals(true)
    try {
      const res = await fetch('/api/packages/meal-plan?userId=' + user.id)
      const data = await res.json()
      if (!data?.plan) return
      const today = new Date().toISOString().split('T')[0]
      const timeToType = { 'الفطور':'breakfast', 'الغداء':'lunch', 'وجبة خفيفة':'snack', 'العشاء':'dinner' }
      for (const item of data.plan) {
        await fetch('/api/meals', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            mealType: timeToType[item.meal_time] || 'lunch',
            meal_name: item.food.name_ar,
            meal_date: today,
            total_calories: item.actual_calories || 0,
            protein_g: item.protein_g || 0,
            carbs_g: item.carbs_g || 0,
            fat_g: item.fat_g || 0,
            portion_note: item.food.portion_desc || '',
            image_url: findRecipeImage(item.food.name_ar, recipes)
          })
        })
      }
      setProgramMealsLogged(true)
      await loadDay(user.id, today)
    } catch(e) { console.error(e) }
    finally { setLoggingProgramMeals(false) }
  }

  const logRecipeAsMeal = async (mealTypeId) => {
    if (!user?.id || !selectedRecipe) return
    const today = new Date().toISOString().split('T')[0]
    try {
      await fetch('/api/meals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          mealType: mealTypeId,
          meal_name: selectedRecipe.name,
          meal_date: today,
          total_calories: selectedRecipe.calories || 0,
          protein_g: selectedRecipe.protein_g || 0,
          carbs_g: selectedRecipe.carbs_g || 0,
          fat_g: selectedRecipe.fat_g || 0,
          fiber_g: selectedRecipe.fiber_g || 0,
          portion_note: selectedRecipe.servings ? 'حصة واحدة (' + selectedRecipe.servings + ')' : '',
          image_url: selectedRecipe.image_url || null
        })
      })
      await loadDay(user.id, today)
    } catch(e) { console.error(e) }
  }

  // ── Tab 3: isolated analyze functions ────────────────────────────────────

  const t3LoadImg = file => {
    if (!file) return
    setT3Err('')
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1200
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) { const ratio = Math.min(MAX / w, MAX / h); w = Math.round(w * ratio); h = Math.round(h * ratio) }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        const fr = new FileReader()
        fr.onload = e => { const d = e.target.result; setT3ImgPreview(d); setT3ImgB64(d.split(',')[1]); setT3ImgMime('image/jpeg') }
        fr.readAsDataURL(blob)
      }, 'image/jpeg', 0.8)
    }
    img.onerror = () => {
      const fr = new FileReader()
      fr.onload = e => { const d = e.target.result; setT3ImgPreview(d); setT3ImgB64(d.split(',')[1]); setT3ImgMime(file.type || 'image/jpeg') }
      fr.readAsDataURL(file)
    }
    img.src = url
  }

  const t3Analyze = async () => {
    if (!t3ImgB64 && !t3TextInput.trim()) { setT3Err('أضف صورة أو صف الوجبة.'); return }
    setT3Analyzing(true); setT3Err(''); setT3Result(null)
    try {
      const r = await fetch('/api/meal-analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: t3ImgB64 || null, imageMime: t3ImgMime, textInput: t3TextInput.trim() || null, mealType: t3MealType, userGoals: G })
      })
      const data = await r.json()
      if (!r.ok || data.error) { setT3Err(data.error || 'التحليل فشل'); setT3Analyzing(false); return }
      setT3Result(data)
    } catch (e) { setT3Err('Network error: ' + e.message) }
    setT3Analyzing(false)
  }

  const t3Save = async (finalResult) => {
    const data = finalResult || t3Result
    if (!data || !user) return
    setT3Saving(true)
    try {
      const body = { userId: user.id, mealType: t3MealType, meal_date: viewDate, ...data }
      const r = await fetch('/api/meals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) {
        await loadDay(user.id, viewDate)
        setT3Result(null); setT3ImgB64(null); setT3ImgPreview(null); setT3TextInput(''); setT3Err('')
        setActiveTab('nutrition'); setTab('daily')
      } else {
        const d = await r.json()
        setT3Err(d.error || 'تعذر الحفظ')
      }
    } catch (e) { setT3Err('Save error: ' + e.message) }
    setT3Saving(false)
  }

  // ── Derived (Tab 2) ──────────────────────────────────────────────────────
  const totals = meals.reduce((acc, m) => {
    NUTRIENTS.forEach(n => { acc[n.key] = (acc[n.key] || 0) + (m[n.key] || 0) })
    acc.calories = (acc.calories || 0) + (m.total_calories || 0)
    return acc
  }, {})
  const totalWater = water.reduce((a, w) => a + (w.amount_ml || 0), 0)
  const currentMealsHash = meals.map(m => m.id + ':' + m.total_calories).join('|')
  const reportIsStale = report && savedMealsHash && currentMealsHash !== savedMealsHash
  const isToday = viewDate === todayStr()
  const G = goals || { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65, fiber_g: 28, sugar_g: 50, sodium_mg: 2300, potassium_mg: 3400, vitamin_a_mcg: 900, vitamin_c_mg: 90, calcium_mg: 1000, iron_mg: 8, water_ml: 2500 }
  const pct = (val, goal) => goal > 0 ? Math.round((val / goal) * 100) : 0

  // ── Derived (Tab 1) ──────────────────────────────────────────────────────
  // Strip always shows first 8 of the shuffled array
  const stripRecipes = recipes.slice(0, 8)

  // Browse pool excludes the strip items so grid/A2 always differ from the strip
  const browsePool = recipes.slice(8)

  const filtered = (() => {
    const catFiltered = activeCategory === 'الكل'
      ? browsePool
      : browsePool.filter(r => {
          if (r.category === activeCategory) return true
          const cat = CATEGORIES.find(c => c.label === activeCategory)
          return cat?.match?.some(kw => r.name?.includes(kw)) ?? false
        })
    if (!search || search.trim() === '') return catFiltered
    return searchRecipes(catFiltered, search)
  })()

  const favoriteRecipes = recipes.filter(r => favorites.has(r.id))

  // ── Recipe favorites ─────────────────────────────────────────────────────
  async function loadFavorites() {
    if (!user?.id) return
    const { data } = await supabase
      .from('recipe_favorites')
      .select('recipe_id')
      .eq('user_id', user.id)
    if (data) setFavorites(new Set(data.map(f => f.recipe_id)))
  }

  async function toggleFavorite(recipeId) {
    if (!user?.id) return
    const isFav = favorites.has(recipeId)
    const newFavs = new Set(favorites)
    if (isFav) newFavs.delete(recipeId)
    else newFavs.add(recipeId)
    setFavorites(newFavs)
    if (isFav) {
      await supabase
        .from('recipe_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('recipe_id', recipeId)
    } else {
      await supabase
        .from('recipe_favorites')
        .insert({ user_id: user.id, recipe_id: recipeId })
    }
  }

  // ── Week plan helpers ────────────────────────────────────────────────────
  function getWeekDays(fromDate) {
    const start = new Date(fromDate)
    const day = start.getDay()
    const diff = start.getDate() - day + (day === 0 ? -6 : 1)
    start.setDate(diff)
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d)
    }
    return days
  }

  async function loadWeekPlan(fromDate) {
    if (!user?.id) return
    setWeekLoading(true)
    const today = new Date()
    const days = getWeekDays(fromDate || today)
    setWeekStart(days[0])
    try {
      const res = await fetch('/api/packages/meal-plan?userId=' + user.id)
      const data = await res.json()
      if (data?.plan) {
        const built = days.map((date, i) => {
          const rotated = [
            ...data.plan.slice(i % data.plan.length),
            ...data.plan.slice(0, i % data.plan.length)
          ]
          rotated.sort((a, b) => {
            const order = ['الفطور','الغداء','وجبة خفيفة','العشاء']
            return order.indexOf(a.meal_time) - order.indexOf(b.meal_time)
          })
          return {
            date,
            dateStr: date.toLocaleDateString('ar-SA', { weekday:'long', day:'numeric', month:'long' }),
            isToday: date.toDateString() === today.toDateString(),
            totalCal: data.total_calories,
            plan: rotated,
            tip: data.tip
          }
        })
        const recipeSnapshot = recipes.length ? recipes : []
        const enriched = built.map(day => ({
          ...day,
          plan: day.plan.map(meal => {
            const img = findRecipeImage(meal.food?.name_ar, recipeSnapshot)
            return { ...meal, food: { ...meal.food, image_url: img } }
          })
        }))
        setWeekPlan(enriched)
        const todayIdx = built.findIndex(d => d.isToday)
        if (todayIdx >= 0) setExpandedDay(todayIdx)
      }
    } catch(e) { console.error(e) }
    setWeekLoading(false)
  }

  const logSinglePlanMeal = async (meal, dayIndex) => {
    if (!user?.id) return
    const key = dayIndex + '-' + meal.meal_time
    if (loggedPlanMeals.has(key)) return
    const today = new Date().toISOString().split('T')[0]
    const timeToType = { 'الفطور':'breakfast', 'الغداء':'lunch', 'وجبة خفيفة':'snack', 'العشاء':'dinner' }
    try {
      await fetch('/api/meals', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          userId: user.id,
          mealType: timeToType[meal.meal_time] || 'lunch',
          meal_name: meal.food?.name_ar,
          meal_date: today,
          total_calories: meal.actual_calories || 0,
          protein_g: meal.protein_g || 0,
          carbs_g: meal.carbs_g || 0,
          fat_g: meal.fat_g || 0,
          portion_note: meal.food?.portion_desc || '',
          image_url: meal.food?.image_url || null
        })
      })
      const newSet = new Set(loggedPlanMeals)
      newSet.add(key)
      setLoggedPlanMeals(newSet)
      await loadDay(user.id, today)
    } catch(e) { console.error(e) }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>
      <TopNav title="التغذية" user={user} back="/" onSignOut={() => supabase.auth.signOut().then(() => router.push('/'))} />

      {/* Edit meal modal (Tab 2) */}
      {editMeal && <EditModal meal={editMeal} onSave={updateMeal} onClose={() => setEditMeal(null)} onReanalyze={async (id, data) => { await updateMeal(id, data) }} />}

      {/* Add meal modal */}
      {showAddMeal && (
        <>
          {/* Backdrop */}
          <div onClick={() => { setShowAddMeal(false); resetAdd() }} style={{
            position:'fixed', inset:0, zIndex:100,
            backgroundColor:'rgba(0,0,0,0.5)'
          }}/>

          {/* Sheet */}
          <div onClick={e => e.stopPropagation()} style={{
            position:'fixed', bottom:0,
            insetInlineStart:0, insetInlineEnd:0,
            zIndex:101, backgroundColor:'#FFFFFF',
            borderRadius:'24px 24px 0 0',
            paddingInline:20, paddingBlockStart:16,
            paddingBlockEnd:48,
            maxHeight:'92vh', overflowY:'auto',
            direction:'rtl'
          }}>
            {/* Handle */}
            <div style={{width:40,height:4,borderRadius:2,backgroundColor:'#E0D5CC',margin:'0 auto 16px'}}/>

            {/* Header */}
            <div style={{
              display:'flex', justifyContent:'space-between',
              alignItems:'center', paddingBlockEnd:16,
              borderBottom:'1px solid #F0E8E0',
              marginBlockEnd:16
            }}>
              <button onClick={() => setShowAddMeal(false)} style={{
                width:32, height:32, borderRadius:16,
                backgroundColor:'#F5F0EB', border:'none',
                cursor:'pointer', fontSize:18, color:'#3D2A1F',
                display:'flex', alignItems:'center',
                justifyContent:'center'
              }}>×</button>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:16, fontWeight:700, color:'#3D2A1F'}}>
                  {addMealType === 'breakfast' ? '☀️ الفطور' :
                   addMealType === 'lunch' ? '🌤️ الغداء' :
                   addMealType === 'dinner' ? '🌙 العشاء' :
                   '🍎 سناك'}
                </div>
                <div style={{fontSize:12, color:'#8A6A4F'}}>
                  أضيفي وجبتك
                </div>
              </div>
              <div style={{width:32}}/>{/* spacer for centering */}
            </div>

            {/* Hidden file input */}
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e => loadImg(e.target.files[0])} />

            {result ? (
              /* ── RESULT VIEW ── */
              <ResultView
                result={result}
                imgPreview={imgPreview}
                goals={G}
                onBack={() => { setResult(null); setErr('') }}
                onSave={async (finalResult) => { await saveMeal(finalResult); setShowAddMeal(false) }}
                saving={saving}
                savingTemplate={savingTemplate}
                onSaveTemplate={saveAsTemplate}
                err={err}
                NUTRIENTS={NUTRIENTS}
                pct={pct}
              />
            ) : (
              <>
                {/* ── PHOTO SECTION ── */}
                {imgPreview ? (
                  <div style={{position:'relative',borderRadius:16,overflow:'hidden',marginBlockEnd:12,cursor:'pointer'}}
                    onClick={() => { fileRef.current.removeAttribute('capture'); fileRef.current.click() }}>
                    <img src={imgPreview} alt="" style={{width:'100%',maxHeight:200,objectFit:'cover',display:'block'}}/>
                    <div style={{position:'absolute',bottom:8,insetInlineEnd:8,background:'rgba(0,0,0,0.6)',borderRadius:6,padding:'3px 10px',fontSize:11,color:'rgba(255,255,255,0.85)'}}>اضغط لتغيير الصورة</div>
                  </div>
                ) : (
                  <div
                    onClick={() => { fileRef.current.removeAttribute('capture'); fileRef.current.click() }}
                    style={{
                      backgroundColor:'#F7F1EC', border:'2px dashed #ECCDBA',
                      borderRadius:16, padding:28,
                      display:'flex', flexDirection:'column',
                      alignItems:'center', justifyContent:'center',
                      gap:10, cursor:'pointer', minHeight:140, marginBlockEnd:12,
                    }}>
                    <span style={{fontSize:44}}>📷</span>
                    <span style={{fontSize:15,fontWeight:600,color:'#3D2A1F'}}>صوّري وجبتك</span>
                    <span style={{fontSize:13,color:'#8A6A4F'}}>أو اختاري صورة من المعرض</span>
                  </div>
                )}
                <div style={{display:'flex',gap:10,justifyContent:'center',marginBlockEnd:16}}>
                  <button onClick={() => { fileRef.current.setAttribute('capture','environment'); fileRef.current.click() }}
                    style={{paddingInline:18,paddingBlock:10,borderRadius:20,fontSize:13,fontWeight:600,cursor:'pointer',border:'none',display:'flex',alignItems:'center',gap:6,backgroundColor:'#3D2A1F',color:'#FFFFFF'}}>
                    📷 الكاميرا
                  </button>
                  <button onClick={() => { fileRef.current.removeAttribute('capture'); fileRef.current.click() }}
                    style={{paddingInline:18,paddingBlock:10,borderRadius:20,fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6,backgroundColor:'#F7E9DF',color:'#8A6A4F',border:'1px solid #ECCDBA'}}>
                    🖼️ المعرض
                  </button>
                  {imgPreview && (
                    <button onClick={() => { setImgB64(null); setImgPreview(null) }}
                      style={{paddingInline:12,paddingBlock:10,borderRadius:20,fontSize:13,cursor:'pointer',border:'1px solid #FECACA',backgroundColor:'#FEF2F2',color:'#EF4444'}}>
                      ✕
                    </button>
                  )}
                </div>

                {/* ── TEXT DESCRIPTION ── */}
                <div style={{display:'flex',alignItems:'center',gap:10,marginBlockEnd:10}}>
                  <div style={{flex:1,height:1,backgroundColor:'#ECCDBA'}}/>
                  <span style={{color:'#8A6A4F',fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}>أو صفي الوجبة بكلامك</span>
                  <div style={{flex:1,height:1,backgroundColor:'#ECCDBA'}}/>
                </div>
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder="مثال: أرز بسمتي ١٠٠ج، دجاج مشوي ١٥٠ج..."
                  rows={3}
                  style={{
                    width:'100%', padding:14, borderRadius:14, marginBlockEnd:16,
                    border:'1.5px solid #ECCDBA', backgroundColor:'#F7F1EC',
                    textAlign:'right', fontSize:14, color:'#3D2A1F', outline:'none',
                    direction:'rtl', resize:'vertical', boxSizing:'border-box', fontFamily:F,
                  }}
                />

                {/* ── BARCODE SECTION ── */}
                {false && (
                <div style={{display:'flex',alignItems:'center',gap:10,marginBlockEnd:10}}>
                  <div style={{flex:1,height:1,backgroundColor:'#ECCDBA'}}/>
                  <span style={{color:'#8A6A4F',fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}>أو استخدمي الباركود</span>
                  <div style={{flex:1,height:1,backgroundColor:'#ECCDBA'}}/>
                </div>
                )}
                {false && (
                <div style={{display:'flex',gap:8,marginBlockEnd:16}}>
                  <button onClick={() => scanBarcodeImage(true)} disabled={barcodeLoading}
                    style={{paddingInline:14,paddingBlock:11,borderRadius:12,fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid #ECCDBA',backgroundColor:'#F7E9DF',color:'#8A6A4F',flexShrink:0,display:'flex',alignItems:'center',gap:6}}>
                    {barcodeLoading ? '...' : '📷 مسح بالكاميرا'}
                  </button>
                  <input
                    value={barcode}
                    onChange={e => setBarcode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && lookupBarcode()}
                    placeholder="رقم الباركود..."
                    style={{flex:1,padding:'11px 14px',borderRadius:12,border:'1.5px solid #ECCDBA',backgroundColor:'#F7F1EC',textAlign:'right',fontSize:14,color:'#3D2A1F',outline:'none',direction:'rtl',boxSizing:'border-box'}}
                  />
                  <button onClick={lookupBarcode} disabled={!barcode.trim()||barcodeLoading}
                    style={{paddingInline:14,paddingBlock:11,borderRadius:12,fontSize:13,fontWeight:600,cursor:'pointer',border:'none',backgroundColor:barcode.trim()?'#3D2A1F':'#C4B5A5',color:'#FFFFFF',flexShrink:0}}>
                    {barcodeLoading ? '...' : 'بحث'}
                  </button>
                </div>
                )}

                {/* ── QUICK OPTIONS ── */}
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBlockEnd:16}}>
                  <button
                    onClick={async () => {
                      const yd = new Date(); yd.setDate(yd.getDate()-1)
                      await copyFromDate(yd.toISOString().split('T')[0], addMealType)
                      setShowAddMeal(false)
                    }}
                    style={{paddingInline:14,paddingBlock:9,borderRadius:12,fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid #ECCDBA',backgroundColor:'#F7F1EC',color:'#8A6A4F'}}>
                    {'📋 نسخ ' + (
                      addMealType === 'breakfast' ? 'فطور الأمس' :
                      addMealType === 'lunch' ? 'غداء الأمس' :
                      addMealType === 'dinner' ? 'عشاء الأمس' :
                      'سناك الأمس'
                    )}
                  </button>
                  {customMeals.length > 0 && (
                    <button onClick={() => setShowCustom(!showCustom)}
                      style={{paddingInline:14,paddingBlock:9,borderRadius:12,fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid #ECCDBA',backgroundColor:showCustom?'#3D2A1F':'#F7F1EC',color:showCustom?'#FFFFFF':'#8A6A4F'}}>
                      ⭐ وجباتي المحفوظة
                    </button>
                  )}
                  {recentMealsByType[addMealType]?.length > 0 && (
                    <button onClick={() => setShowRecentMeals(!showRecentMeals)}
                      style={{paddingInline:14,paddingBlock:9,borderRadius:12,fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid #ECCDBA',backgroundColor:showRecentMeals?'#3D2A1F':'#F7F1EC',color:showRecentMeals?'#FFFFFF':'#8A6A4F'}}>
                      📅 وجبات الأمس
                    </button>
                  )}
                </div>

                {/* Saved custom meals list */}
                {showCustom && customMeals.length > 0 && (
                  <div style={{marginBlockEnd:14,border:'1px solid #ECCDBA',borderRadius:14,overflow:'hidden'}}>
                    {customMeals.map((cm, i) => (
                      <div key={cm.id||i} onClick={() => useCustomMeal(cm)}
                        style={{padding:'12px 14px',cursor:'pointer',borderBottom:i<customMeals.length-1?'1px solid #ECCDBA':'none',display:'flex',justifyContent:'space-between',alignItems:'center',backgroundColor:'#FDFAF7'}}>
                        <span style={{fontSize:13,fontWeight:600,color:'#D89B7A'}}>{cm.total_calories||0} سعرة</span>
                        <span style={{fontSize:14,color:'#3D2A1F',textAlign:'right'}}>{cm.meal_name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Yesterday's meals list */}
                {showRecentMeals && recentMealsByType[addMealType]?.length > 0 && (
                  <div style={{marginBlockEnd:14,border:'1px solid #ECCDBA',borderRadius:14,overflow:'hidden'}}>
                    {recentMealsByType[addMealType].map((m, i) => (
                      <div key={m.id||i}
                        onClick={async () => {
                          const yd = new Date(); yd.setDate(yd.getDate()-1)
                          await copyFromDate(yd.toISOString().split('T')[0], addMealType)
                          setShowRecentMeals(false); setShowAddMeal(false)
                        }}
                        style={{padding:'12px 14px',cursor:'pointer',borderBottom:i<recentMealsByType[addMealType].length-1?'1px solid #ECCDBA':'none',display:'flex',justifyContent:'space-between',alignItems:'center',backgroundColor:'#FDFAF7'}}>
                        <span style={{fontSize:13,fontWeight:600,color:'#D89B7A'}}>{m.total_calories||0} سعرة</span>
                        <span style={{fontSize:14,color:'#3D2A1F',textAlign:'right'}}>{m.meal_name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {err && <div style={{color:'#B91C1C',fontSize:13,marginBlockEnd:12,padding:'10px 14px',backgroundColor:'#FEF2F2',borderRadius:10,border:'1px solid #FECACA'}}>{err}</div>}

                {/* ── ANALYZE BUTTON ── */}
                {analyzing ? (
                  <div style={{textAlign:'center',padding:'20px 0',marginBlockEnd:16}}>
                    <div style={{width:40,height:40,border:'3px solid #ECCDBA',borderTopColor:'#3D2A1F',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 12px'}}/>
                    <div style={{color:'#3D2A1F',fontWeight:700,fontSize:14}}>جارٍ التحليل...</div>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      if (!imgB64 && !textInput.trim()) { setErr('أضف صورة أو صف الوجبة.'); return }
                      setAnalyzing(true); setErr('')
                      try {
                        const r = await fetch('/api/meal-analyze', {
                          method:'POST', headers:{'Content-Type':'application/json'},
                          body: JSON.stringify({ imageBase64: imgB64||null, imageMime, textInput: textInput.trim()||null, mealType: addMealType, userGoals: G })
                        })
                        const data = await r.json()
                        if (!r.ok || data.error) { setErr(data.error||'التحليل فشل'); setAnalyzing(false); return }
                        setResult(data); setMealType(addMealType)
                      } catch(e) { setErr('Network error: ' + e.message) }
                      setAnalyzing(false)
                    }}
                    disabled={!imgB64 && !textInput.trim()}
                    style={{
                      width:'100%', padding:15,
                      backgroundColor: analyzing ? '#8A6A4F' : '#3D2A1F',
                      color:'#FFFFFF', border:'none', borderRadius:14, fontSize:15,
                      fontWeight:700, cursor:(imgB64||textInput.trim()) ? 'pointer' : 'not-allowed',
                      marginBlockEnd:20, opacity: analyzing ? 0.7 : 1
                    }}
                  >تحليل التغذية ←</button>
                )}

              </>
            )}
          </div>
        </>
      )}

      {/* FAB — add meal (nutrition tab only) */}
      {activeTab === 'nutrition' && !showAddMeal && (
        <button onClick={()=>setShowAddMeal(true)}
          style={{position:'fixed',bottom:'calc(72px + env(safe-area-inset-bottom))',insetInlineEnd:20,zIndex:150,width:52,height:52,borderRadius:'50%',background:'#CBA23B',border:'none',color:'#0C0B0D',fontSize:'1.6rem',fontWeight:700,cursor:'pointer',boxShadow:'0 4px 18px rgba(203,162,59,0.35)',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>
          +
        </button>
      )}

      {/* Meal detail sheet */}
      {selectedMeal && (
        <>
          {/* Backdrop */}
          <div onClick={() => setSelectedMeal(null)} style={{
            position: 'fixed', inset: 0, zIndex: 200,
            backgroundColor: 'rgba(0,0,0,0.5)',
          }} />
          {/* Sheet */}
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', bottom: 0,
            insetInlineStart: 0, insetInlineEnd: 0, zIndex: 201,
            backgroundColor: 'var(--card)',
            borderRadius: '24px 24px 0 0',
            maxHeight: '80vh', overflowY: 'auto',
            paddingBlockEnd: 40,
            direction: 'rtl',
          }}>
            {/* Handle bar */}
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'var(--accent-soft)', margin: '12px auto' }} />
            {/* Hero image */}
            {selectedMeal.image_url && (
              <div style={{ width: '100%', height: 180, overflow: 'hidden', borderRadius: '24px 24px 0 0' }}>
                <img
                  src={selectedMeal.image_url}
                  alt={selectedMeal.meal_name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}
            {/* Title row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingInline: 16, paddingBlock: 8 }}>
              <button onClick={() => setSelectedMeal(null)} style={{ fontSize: 20, border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1 }}>×</button>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: F, flex: 1, textAlign: 'right', marginInlineEnd: 8 }}>{selectedMeal.meal_name}</div>
            </div>
            {/* Calorie badge */}
            <div style={{ textAlign: 'center', paddingBlock: 4 }}>
              <span style={{
                backgroundColor: 'var(--accent)', color: '#FFFFFF',
                paddingInline: 20, paddingBlock: 8,
                borderRadius: 20, fontSize: 16, fontWeight: 700,
                display: 'inline-block',
              }}>{selectedMeal.total_calories} سعرة</span>
            </div>
            {/* Macro row */}
            {(selectedMeal.protein_g > 0 || selectedMeal.carbs_g > 0 || selectedMeal.fat_g > 0) && (
              <div style={{
                display: 'flex', justifyContent: 'space-around',
                paddingBlock: 16, marginInline: 16,
                backgroundColor: 'var(--surface)', borderRadius: 16,
                marginBlockStart: 12,
              }}>
                {[
                  { value: Math.round(selectedMeal.protein_g || 0), label: 'بروتين', color: '#3B82F6' },
                  { value: Math.round(selectedMeal.carbs_g || 0),   label: 'كارب',   color: '#F59E0B' },
                  { value: Math.round(selectedMeal.fat_g || 0),     label: 'دهن',    color: '#8B5CF6' },
                ].map(({ value, label, color }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color }}>{value}g</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: F }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Portion note */}
            {selectedMeal.portion_note && (
              <div style={{
                marginInline: 16, marginBlockStart: 12,
                padding: 12, backgroundColor: 'var(--accent-faint)',
                borderRadius: 12, textAlign: 'right',
                fontSize: 14, color: 'var(--text-primary)', fontFamily: F,
              }}>📏 {selectedMeal.portion_note}</div>
            )}
            {/* Ingredients */}
            {selectedMeal.ingredients?.length > 0 && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', paddingInline: 16, marginBlockStart: 16, textAlign: 'right', fontFamily: F }}>المكونات</div>
                {selectedMeal.ingredients.map((ing, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    paddingBlock: 8, paddingInline: 16,
                    borderBottom: '1px solid var(--accent-faint)',
                  }}>
                    <span style={{ fontSize: 14, color: 'var(--text-primary)', textAlign: 'right', fontFamily: F }}>
                      {typeof ing === 'string' ? ing : (ing.name + (ing.portion ? ` — ${ing.portion}` : ''))}
                    </span>
                    <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'var(--accent)', marginInlineStart: 8, flexShrink: 0 }} />
                  </div>
                ))}
              </>
            )}
            {/* Nutrition details */}
            {[
              ['fiber_g',         'ألياف',          'g'],
              ['sugar_g',         'سكر',            'g'],
              ['saturated_fat_g', 'دهون مشبعة',     'g'],
              ['cholesterol_mg',  'كوليسترول',      'mg'],
              ['sodium_mg',       'صوديوم',          'mg'],
              ['potassium_mg',    'بوتاسيوم',       'mg'],
            ].some(([k]) => selectedMeal[k] > 0) && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', paddingInline: 16, marginBlockStart: 16, textAlign: 'right', fontFamily: F }}>القيم الغذائية</div>
                {[
                  ['fiber_g',         'ألياف',          'g'],
                  ['sugar_g',         'سكر',            'g'],
                  ['saturated_fat_g', 'دهون مشبعة',     'g'],
                  ['cholesterol_mg',  'كوليسترول',      'mg'],
                  ['sodium_mg',       'صوديوم',          'mg'],
                  ['potassium_mg',    'بوتاسيوم',       'mg'],
                ].filter(([k]) => selectedMeal[k] > 0).map(([k, label, unit]) => (
                  <div key={k} style={{
                    display: 'flex', justifyContent: 'space-between',
                    paddingBlock: 8, paddingInline: 16,
                    borderBottom: '1px solid var(--accent-faint)',
                  }}>
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: F }}>{Math.round((selectedMeal[k] || 0) * 10) / 10}{unit}</span>
                    <span style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: F }}>{label}</span>
                  </div>
                ))}
              </>
            )}
            {/* Health score */}
            {selectedMeal.health_score > 0 && (
              <div style={{
                marginInline: 16, marginBlockStart: 12,
                padding: 12, backgroundColor: 'var(--card)',
                borderRadius: 12, borderInlineStart: '3px solid var(--accent)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontFamily: F }}>{selectedMeal.health_score} / 10</span>
                <span style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: F }}>نقاط الصحة 🌟</span>
              </div>
            )}
            {/* Delete button */}
            <button onClick={async () => { await deleteMeal(selectedMeal.id, 'meal'); setSelectedMeal(null) }} style={{
              marginInline: 16, marginBlockStart: 16,
              width: 'calc(100% - 32px)', padding: 12,
              backgroundColor: '#FEF2F2', color: '#EF4444',
              border: '1px solid #FECACA', borderRadius: 12,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: F, display: 'block',
            }}>🗑️ حذف الوجبة</button>
          </div>
        </>
      )}

      <div className="meals-container">

        {/* ── 3-Tab bar ───────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 8, padding: '12px 16px',
          backgroundColor: 'var(--surface)',
          borderBottom: '1px solid var(--accent-faint)',
        }}>
          {[
            { key: 'recipes',   label: '🍽️ وصفات'  },
            { key: 'nutrition', label: '📊 تغذيتي'  },
          ].map(({ key, label }) => {
            const isActive = activeTab === key
            return (
              <button key={key} onClick={() => setActiveTab(key)} style={{
                flex: 1, paddingBlock: 10, borderRadius: 24,
                textAlign: 'center', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: F,
                backgroundColor: isActive ? 'var(--text-primary)' : 'var(--card)',
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                border: isActive ? 'none' : '1px solid var(--accent-soft)',
                transition: 'background .15s, color .15s',
              }}>
                {label}
              </button>
            )
          })}
        </div>

        {/* ══════════════════════════════════════════════════════
            TAB 1 — RECIPE BROWSER (exact copy from current meals.js)
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'recipes' && (
          <>
            {/* Recipe detail — renders in place so tab bar stays visible */}
            {selectedRecipe && (
              <RecipeDetail recipe={selectedRecipe} onBack={() => setSelectedRecipe(null)} favorites={favorites} toggleFavorite={toggleFavorite} onLogMeal={logRecipeAsMeal} />
            )}

            {/* Sub-screen A2: Full browser */}
            {!selectedRecipe && showAllRecipes && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingInline: 16, paddingBlock: 14,
                  backgroundColor: 'var(--card)',
                  borderBottom: '1px solid var(--accent-faint)',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: F }}>
                    {search ? `${filtered.length} نتيجة لـ "${search}"` : `${filtered.length} وصفة`}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: F }}>
                    كل الوصفات
                  </span>
                  <button onClick={() => setShowAllRecipes(false)} style={{
                    fontSize: 14, color: 'var(--accent)', border: 'none',
                    background: 'none', cursor: 'pointer', fontFamily: F, fontWeight: 600,
                  }}>
                    ← رجوع
                  </button>
                </div>

                <div style={{ paddingBlockStart: 12 }}>
                  <SearchAndChips
                    search={search} onSearch={setSearch}
                    activeCategory={activeCategory} onCategory={setActiveCategory}
                  />
                </div>

                <div className="recipe-grid" style={{ paddingInline: 16, paddingBlockEnd: 80 }}>
                  {filtered.map(recipe => (
                    <div key={recipe.id} className="recipe-card-hover"
                      onClick={() => setSelectedRecipe(recipe)}
                      style={{
                        position: 'relative', borderRadius: 16, overflow: 'hidden',
                        aspectRatio: '3/4', cursor: 'pointer', boxShadow: 'var(--shadow-card)',
                      }}>
                      <RecipeImg src={recipe.image_url} name={recipe.name} />
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(recipe.id) }}
                        style={{
                          position:'absolute', top:10, insetInlineEnd:10, zIndex:10,
                          width:34, height:34, borderRadius:17,
                          backgroundColor:'rgba(0,0,0,0.4)',
                          border:'none', cursor:'pointer',
                          display:'flex', alignItems:'center',
                          justifyContent:'center', fontSize:16,
                        }}
                      >
                        {favorites.has(recipe.id) ? '❤️' : '🤍'}
                      </button>
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75) 100%)',
                      }} />
                      {recipe.calories > 0 && (
                        <div style={{
                          position: 'absolute', top: 10, insetInlineStart: 10,
                          backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                          borderRadius: 20, paddingInline: 10, paddingBlock: 4,
                          fontSize: 11, fontWeight: 600, color: '#FFFFFF',
                          display: 'flex', alignItems: 'center', gap: 4, fontFamily: F,
                        }}>
                          🔥 {recipe.calories}
                        </div>
                      )}
                      <div style={{
                        position: 'absolute', bottom: 0,
                        insetInlineStart: 0, insetInlineEnd: 0, padding: 12,
                      }}>
                        <p style={{
                          fontSize: 14, fontWeight: 700, color: '#FFFFFF', textAlign: 'right',
                          margin: 0, marginBlockEnd: 6, fontFamily: F,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          textShadow: '0 1px 4px rgba(0,0,0,0.4)', lineHeight: 1.4,
                        }}>{recipe.name}</p>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {recipe.cook_time && (
                            <span style={{
                              backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
                              paddingInline: 8, paddingBlock: 3, fontSize: 11, color: '#FFFFFF', fontWeight: 500, fontFamily: F,
                            }}>🕐 {recipe.cook_time}</span>
                          )}
                          {recipe.category && (
                            <span style={{
                              backgroundColor: 'var(--accent)', borderRadius: 20,
                              paddingInline: 8, paddingBlock: 3, fontSize: 11, color: '#FFFFFF', fontWeight: 600, fontFamily: F,
                            }}>{recipe.category}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!recipesLoading && filtered.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', paddingBlock: 40, color: 'var(--text-secondary)', fontFamily: F }}>
                      <div style={{ fontSize: 40, marginBlockEnd: 12 }}>🔍</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBlockEnd: 8 }}>
                        {search ? `لا توجد نتائج لـ "${search}"` : 'لا توجد وصفات مطابقة'}
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {search ? 'جربي البحث باسم المكوّن مثل "دجاج" أو "أرز"' : 'جربي فئة مختلفة'}
                      </div>
                      {search && (
                        <button
                          onClick={() => setSearch('')}
                          style={{
                            marginBlockStart: 16, paddingInline: 20, paddingBlock: 10,
                            backgroundColor: 'var(--text-primary)', color: '#FFFFFF',
                            border: 'none', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontFamily: F,
                          }}
                        >مسح البحث</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-screen A1: Main browse */}
            {!selectedRecipe && !showAllRecipes && (
              <div style={{ paddingBlockEnd: 80 }}>
                <div style={{ paddingBlock: 16, paddingInline: 16, textAlign: 'right' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', fontFamily: F }}>التغذية</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: F, marginBlockStart: 2 }}>غذّي أهدافك</div>
                </div>

                <SearchAndChips
                  search={search} onSearch={setSearch}
                  activeCategory={activeCategory} onCategory={setActiveCategory}
                  showChips={false}
                />

                {/* "وصفات جديدة" horizontal strip */}
                <div style={{ marginBlockEnd: 8 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingInline: 16, marginBlockEnd: 10,
                  }}>
                    <div />
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: F }}>
                      وصفات جديدة
                    </span>
                  </div>

                  <div className="stat-scroll" style={{
                    display: 'flex', overflowX: 'auto', gap: 12,
                    paddingInline: 16, paddingBlockEnd: 8,
                  }}>
                    {recipesLoading
                      ? Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="skeleton" style={{
                            width: 170, minWidth: 170, height: 220, flexShrink: 0,
                            borderRadius: 16, backgroundColor: 'var(--accent-faint)',
                          }} />
                        ))
                      : stripRecipes.map(recipe => (
                          <div key={recipe.id} className="recipe-card-hover"
                            onClick={() => setSelectedRecipe(recipe)}
                            style={{
                              position: 'relative', width: 170, minWidth: 170, height: 220,
                              borderRadius: 16, overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
                              boxShadow: 'var(--shadow-card)',
                            }}>
                            <RecipeImg src={recipe.image_url} name={recipe.name} />
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(recipe.id) }}
                              style={{
                                position:'absolute', top:10, insetInlineEnd:10, zIndex:10,
                                width:34, height:34, borderRadius:17,
                                backgroundColor:'rgba(0,0,0,0.4)',
                                border:'none', cursor:'pointer',
                                display:'flex', alignItems:'center',
                                justifyContent:'center', fontSize:16,
                              }}
                            >
                              {favorites.has(recipe.id) ? '❤️' : '🤍'}
                            </button>
                            <div style={{
                              position: 'absolute', inset: 0,
                              background: 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75) 100%)',
                            }} />
                            {recipe.calories > 0 && (
                              <div style={{
                                position: 'absolute', top: 10, insetInlineStart: 10,
                                backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                                borderRadius: 20, paddingInline: 10, paddingBlock: 4,
                                fontSize: 11, fontWeight: 600, color: '#FFFFFF',
                                display: 'flex', alignItems: 'center', gap: 4, fontFamily: F,
                              }}>
                                🔥 {recipe.calories}
                              </div>
                            )}
                            <div style={{
                              position: 'absolute', bottom: 0,
                              insetInlineStart: 0, insetInlineEnd: 0, padding: 12,
                            }}>
                              <p style={{
                                fontSize: 14, fontWeight: 700, color: '#FFFFFF', textAlign: 'right',
                                margin: 0, marginBlockEnd: 6, fontFamily: F,
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                textShadow: '0 1px 4px rgba(0,0,0,0.4)', lineHeight: 1.4,
                              }}>{recipe.name}</p>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                {recipe.cook_time && (
                                  <span style={{
                                    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
                                    paddingInline: 8, paddingBlock: 3, fontSize: 11, color: '#FFFFFF', fontWeight: 500, fontFamily: F,
                                  }}>🕐 {recipe.cook_time}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                    }
                  </div>
                </div>

                {/* ── Favorites section ── */}
                {favoriteRecipes.length > 0 && (
                  <div style={{ marginBlockEnd: 8 }}>
                    <div style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      paddingInline:16, marginBlockStart:16, marginBlockEnd:10,
                    }}>
                      <span style={{ fontSize:13, color:'var(--text-secondary)', fontFamily:F }}>{favoriteRecipes.length} وصفة</span>
                      <span style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', fontFamily:F }}>❤️ المفضلة</span>
                    </div>
                    <div className="stat-scroll" style={{ display:'flex', overflowX:'auto', gap:12, paddingInline:16, paddingBlockEnd:8 }}>
                      {favoriteRecipes.map(recipe => (
                        <div key={recipe.id} className="recipe-card-hover"
                          onClick={() => setSelectedRecipe(recipe)}
                          style={{
                            position:'relative', width:170, minWidth:170, height:220,
                            borderRadius:16, overflow:'hidden', cursor:'pointer', flexShrink:0,
                            boxShadow:'var(--shadow-card)',
                          }}>
                          <RecipeImg src={recipe.image_url} name={recipe.name} />
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(recipe.id) }}
                            style={{
                              position:'absolute', top:10, insetInlineEnd:10, zIndex:10,
                              width:34, height:34, borderRadius:17,
                              backgroundColor:'rgba(0,0,0,0.4)',
                              border:'none', cursor:'pointer',
                              display:'flex', alignItems:'center',
                              justifyContent:'center', fontSize:16,
                            }}
                          >
                            ❤️
                          </button>
                          <div style={{
                            position:'absolute', inset:0,
                            background:'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75) 100%)',
                          }} />
                          <div style={{ position:'absolute', bottom:0, insetInlineStart:0, insetInlineEnd:0, padding:12 }}>
                            <p style={{
                              fontSize:14, fontWeight:700, color:'#FFFFFF', textAlign:'right',
                              margin:0, fontFamily:F,
                              display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
                              textShadow:'0 1px 4px rgba(0,0,0,0.4)', lineHeight:1.4,
                            }}>{recipe.name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* "تصفح حسب الفئة" visual category cards */}
                <div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingInline: 16, marginBlockStart: 20, marginBlockEnd: 12,
                  }}>
                    <div />
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: F }}>
                      تصفح حسب الفئة
                    </span>
                  </div>
                  <div className="stat-scroll" style={{ display: 'flex', overflowX: 'auto', gap: 12, paddingInline: 16, paddingBlockEnd: 12 }}>
                    {VISUAL_CATEGORIES.map((cat, idx) => {
                      const isActive = activeCategory === cat.filter
                      const fallbackBgs = ['#FBE9E7','#E8F5E9','#FFF3E0','#E3F2FD','#F3E5F5','#FCE4EC','#E8EAF6','#FFF8E1','#E0F7FA','#F1F8E9','#FFF9C4','#EDE7F6']
                      const fallbackEmojis = ['🍚','🌅','🍯','🥣','🥗','🍖','🐟','🫕','☕','🥬','⚡','🫙']
                      return (
                        <div key={cat.label}
                          onClick={() => setActiveCategory(isActive ? 'الكل' : cat.filter)}
                          style={{
                            position: 'relative', width: 130, minWidth: 130, height: 160,
                            borderRadius: 20, overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
                            outline: isActive ? '3px solid var(--accent)' : 'none',
                            outlineOffset: isActive ? '2px' : '0',
                          }}>
                          <CategoryCardImg src={cat.image} bg={fallbackBgs[idx % fallbackBgs.length]} emoji={fallbackEmojis[idx % fallbackEmojis.length]} />
                          <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.7) 100%)',
                          }} />
                          <span style={{
                            position: 'absolute', bottom: 12,
                            insetInlineEnd: 0, insetInlineStart: 0,
                            textAlign: 'center', fontSize: 13, fontWeight: 700,
                            color: '#FFFFFF', paddingInline: 8,
                            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                            fontFamily: F,
                          }}>{cat.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* "كل الوصفات" grid */}
                <div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingInline: 16, marginBlockEnd: 10, marginBlockStart: 16,
                  }}>
                    <button onClick={() => setShowAllRecipes(true)} style={{
                      fontSize: 13, color: 'var(--accent)', border: 'none',
                      background: 'none', cursor: 'pointer', fontFamily: F,
                    }}>
                      عرض الكل ←
                    </button>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: F }}>
                      كل الوصفات
                    </span>
                  </div>

                  {recipesLoading && (
                    <div className="recipe-grid" style={{ paddingInline: 16 }}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="skeleton"
                          style={{ borderRadius: 16, backgroundColor: 'var(--accent-faint)', aspectRatio: '3/4' }} />
                      ))}
                    </div>
                  )}

                  {!recipesLoading && filtered.length === 0 && (
                    <div style={{ textAlign: 'center', paddingBlock: 40, color: 'var(--text-secondary)', fontFamily: F }}>
                      <div style={{ fontSize: 40, marginBlockEnd: 12 }}>🔍</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBlockEnd: 8 }}>
                        {search ? `لا توجد نتائج لـ "${search}"` : 'لا توجد وصفات مطابقة'}
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {search ? 'جربي البحث باسم المكوّن مثل "دجاج" أو "أرز"' : 'جربي فئة مختلفة'}
                      </div>
                      {search && (
                        <button
                          onClick={() => setSearch('')}
                          style={{
                            marginBlockStart: 16, paddingInline: 20, paddingBlock: 10,
                            backgroundColor: 'var(--text-primary)', color: '#FFFFFF',
                            border: 'none', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontFamily: F,
                          }}
                        >مسح البحث</button>
                      )}
                    </div>
                  )}

                  {!recipesLoading && filtered.length > 0 && (
                    <div className="recipe-grid" style={{ paddingInline: 16, paddingBlockEnd: 16 }}>
                      {filtered.slice(0, 6).map(recipe => (
                        <div key={recipe.id} className="recipe-card-hover"
                          onClick={() => setSelectedRecipe(recipe)}
                          style={{
                            position: 'relative', borderRadius: 16, overflow: 'hidden',
                            aspectRatio: '3/4', cursor: 'pointer', boxShadow: 'var(--shadow-card)',
                          }}>
                          <RecipeImg src={recipe.image_url} name={recipe.name} />
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(recipe.id) }}
                            style={{
                              position:'absolute', top:10, insetInlineEnd:10, zIndex:10,
                              width:34, height:34, borderRadius:17,
                              backgroundColor:'rgba(0,0,0,0.4)',
                              border:'none', cursor:'pointer',
                              display:'flex', alignItems:'center',
                              justifyContent:'center', fontSize:16,
                            }}
                          >
                            {favorites.has(recipe.id) ? '❤️' : '🤍'}
                          </button>
                          <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75) 100%)',
                          }} />
                          {recipe.calories > 0 && (
                            <div style={{
                              position: 'absolute', top: 10, insetInlineStart: 10,
                              backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                              borderRadius: 20, paddingInline: 10, paddingBlock: 4,
                              fontSize: 11, fontWeight: 600, color: '#FFFFFF',
                              display: 'flex', alignItems: 'center', gap: 4, fontFamily: F,
                            }}>
                              🔥 {recipe.calories}
                            </div>
                          )}
                          <div style={{
                            position: 'absolute', bottom: 0,
                            insetInlineStart: 0, insetInlineEnd: 0, padding: 12,
                          }}>
                            <p style={{
                              fontSize: 14, fontWeight: 700, color: '#FFFFFF', textAlign: 'right',
                              margin: 0, marginBlockEnd: 6, fontFamily: F,
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                              textShadow: '0 1px 4px rgba(0,0,0,0.4)', lineHeight: 1.4,
                            }}>{recipe.name}</p>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              {recipe.cook_time && (
                                <span style={{
                                  backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
                                  paddingInline: 8, paddingBlock: 3, fontSize: 11, color: '#FFFFFF', fontWeight: 500, fontFamily: F,
                                }}>🕐 {recipe.cook_time}</span>
                              )}
                              {recipe.category && (
                                <span style={{
                                  backgroundColor: 'var(--accent)', borderRadius: 20,
                                  paddingInline: 8, paddingBlock: 3, fontSize: 11, color: '#FFFFFF', fontWeight: 600, fontFamily: F,
                                }}>{recipe.category}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 2 — FULL AI MEAL ANALYZER (from original e4f2f06)
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'nutrition' && (
          <>
            {/* Date nav */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 16px',backgroundColor:'var(--surface)',borderBottom:'1px solid var(--accent-faint)'}}>
              <button onClick={prevDay} style={{background:'none',border:'none',color:'var(--text-secondary)',cursor:'pointer',fontSize:'1.3rem',padding:'4px 8px'}}>‹</button>
              <div style={{textAlign:'center'}}>
                <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.95rem',color:'var(--text-primary)'}}>{isToday?'اليوم 📅':new Date(viewDate+'T12:00:00').toLocaleDateString('ar-SA',{weekday:'long',month:'long',day:'numeric'})}</div>
              </div>
              <button onClick={nextDay} disabled={isToday} style={{background:'none',border:'none',color:isToday?'var(--accent-faint)':'var(--text-secondary)',cursor:isToday?'default':'pointer',fontSize:'1.3rem',padding:'4px 8px'}}>›</button>
            </div>

            {/* Internal sub-tab bar */}
            <div style={{display:'flex',borderBottom:'1px solid var(--accent-faint)',padding:'0 16px',overflowX:'auto',backgroundColor:'var(--surface)'}}>
              <button className={`ptab${tab==='plan'?' on':''}`} onClick={()=>setTab('plan')}>🍽️ خطة اليوم</button>
              <button className={`ptab${tab==='daily'?' on':''}`} onClick={()=>setTab('daily')}>أكلك اليوم</button>
              <button className={`ptab${tab==='nutrients'?' on':''}`} onClick={()=>setTab('nutrients')}>📊 مغذياتي</button>
              <button className={`ptab${tab==='report'?' on':''}`} onClick={()=>setTab('report')}>التقرير</button>
            </div>

            <div style={{maxWidth:520,margin:'0 auto',padding:'0 16px'}}>

              {/* ── WEEK PLAN ── */}
              {tab==='plan' && (
                <div style={{paddingTop:14,paddingBottom:100}}>

                  {/* Week navigation header */}
                  {weekPlan.length > 0 && weekStart && (
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                      <button onClick={()=>loadWeekPlan(new Date(weekStart.getTime() - 7*86400000))}
                        style={{backgroundColor:'var(--card)',border:'1px solid var(--accent-soft)',borderRadius:10,padding:'8px 14px',color:'var(--text-primary)',cursor:'pointer',fontFamily:F,fontSize:'.82rem',fontWeight:600}}>
                        ← الأسبوع السابق
                      </button>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontFamily:F,fontWeight:700,fontSize:'.9rem',color:'var(--text-primary)'}}>خطة الأسبوع</div>
                        <div style={{fontFamily:F,fontSize:11,color:'var(--text-secondary)',marginTop:2}}>
                          {weekStart.toLocaleDateString('ar-SA',{day:'numeric',month:'short'})} – {new Date(weekStart.getTime()+6*86400000).toLocaleDateString('ar-SA',{day:'numeric',month:'short'})}
                        </div>
                      </div>
                      <button onClick={()=>loadWeekPlan(new Date(weekStart.getTime() + 7*86400000))}
                        style={{backgroundColor:'var(--card)',border:'1px solid var(--accent-soft)',borderRadius:10,padding:'8px 14px',color:'var(--text-primary)',cursor:'pointer',fontFamily:F,fontSize:'.82rem',fontWeight:600}}>
                        الأسبوع التالي ←
                      </button>
                    </div>
                  )}

                  {/* Calorie goal card */}
                  {weekPlan.length > 0 && (
                    <div style={{backgroundColor:'var(--card)',border:'1px solid var(--accent-soft)',borderRadius:16,padding:'14px 16px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:13,color:'var(--text-secondary)',fontFamily:F,marginBottom:4}}>هدف السعرات اليومي</div>
                        <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:28,color:'var(--accent)',lineHeight:1}}>
                          {weekPlan[0]?.totalCal}
                          <span style={{fontSize:13,fontWeight:400,color:'var(--text-secondary)',fontFamily:F,marginRight:6}}>سعرة</span>
                        </div>
                      </div>
                      <button onClick={()=>loadWeekPlan()}
                        style={{backgroundColor:'var(--text-primary)',border:'none',borderRadius:10,padding:'9px 14px',color:'#FFFFFF',cursor:'pointer',fontFamily:F,fontSize:'.78rem',fontWeight:700}}>
                        إعادة توليد
                      </button>
                    </div>
                  )}

                  {weekPlan.length > 0 && (
                    <p style={{
                      fontSize:12, color:'var(--text-secondary)',
                      textAlign:'right', paddingInline:16,
                      marginBlockEnd:12
                    }}>
                      💡 اضغطي على الزر لإضافة الوجبة لسجلك اليومي
                    </p>
                  )}

                  {/* Loading skeletons */}
                  {weekLoading && (
                    <div>
                      {[...Array(7)].map((_,i) => (
                        <div key={i} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:14,padding:'14px 16px',marginBottom:8}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <div style={{width:100,height:14,background:'rgba(255,255,255,0.06)',borderRadius:6}}/>
                            <div style={{width:60,height:14,background:'rgba(255,255,255,0.04)',borderRadius:6}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Empty state */}
                  {!weekLoading && weekPlan.length === 0 && (
                    <div style={{textAlign:'center',padding:'60px 0',color:'rgba(255,255,255,0.35)'}}>
                      <div style={{fontSize:'2.5rem',marginBottom:12}}>🍽️</div>
                      <div style={{marginBottom:8,fontFamily:F}}>لا توجد خطة وجبات بعد</div>
                      <div style={{fontSize:'.78rem',color:'rgba(255,255,255,0.25)',fontFamily:F}}>ابدأ برنامجك لتفعيل خطة التغذية</div>
                    </div>
                  )}

                  {/* Week day cards */}
                  {!weekLoading && weekPlan.map((day, idx) => (
                    <div key={idx} style={{marginBottom:8}}>
                      {/* Day header row */}
                      <button onClick={()=>setExpandedDay(expandedDay===idx?null:idx)}
                        style={{width:'100%',backgroundColor:'var(--card)',border:day.isToday?'2px solid var(--accent)':'1px solid var(--accent-faint)',borderRadius:expandedDay===idx?'14px 14px 0 0':'14px',padding:'13px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',textAlign:'right'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          {day.isToday && <span style={{backgroundColor:'var(--accent)',color:'#FFFFFF',borderRadius:6,padding:'2px 8px',fontSize:'.62rem',fontWeight:800,fontFamily:F}}>اليوم</span>}
                          <span style={{fontFamily:F,fontWeight:600,fontSize:15,color:'var(--text-primary)'}}>{day.dateStr}</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,color:'var(--accent)'}}>{day.totalCal} سعرة</span>
                          <span style={{color:'var(--text-secondary)',fontSize:'.75rem'}}>{expandedDay===idx?'▲':'▼'}</span>
                        </div>
                      </button>

                      {/* Expanded meal list */}
                      {expandedDay===idx && (
                        <div style={{backgroundColor:'var(--card)',border:'1px solid var(--accent-faint)',borderTop:'none',borderRadius:'0 0 14px 14px',overflow:'hidden'}}>
                          {day.plan.map((meal, mi) => {
                            const fv = getFoodVisual(meal.food?.name_ar)
                            return (
                              <div key={mi} style={{display:'flex',alignItems:'center',gap:12,paddingInline:16,paddingBlock:14,borderBottom:mi<day.plan.length-1?'1px solid var(--accent-faint)':'none'}}>
                                {/* food visual avatar (RTL: first in DOM = visual right) */}
                                <div style={{width:52,height:52,borderRadius:12,flexShrink:0,overflow:'hidden',backgroundColor:fv.bg}}>
                                  {meal.food?.image_url ? (
                                    <img src={meal.food.image_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}
                                      onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex'}} />
                                  ) : null}
                                  <div style={{width:'100%',height:'100%',display:meal.food?.image_url?'none':'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>{fv.emoji}</div>
                                </div>
                                {/* food info */}
                                <div style={{flex:1,minWidth:0,textAlign:'right'}}>
                                  <div style={{fontSize:12,color:'var(--text-secondary)',fontFamily:F,marginBottom:2}}>{meal.meal_time}</div>
                                  <div style={{fontSize:15,fontWeight:700,color:'var(--text-primary)',fontFamily:F,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{meal.food?.name_ar}</div>
                                  <div style={{fontSize:12,color:'var(--text-secondary)',fontFamily:F,marginBottom:4}}>{meal.food?.portion_desc}</div>
                                  <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                                    {[
                                      ['B',meal.protein_g,'#EFF6FF','#1D4ED8'],
                                      ['C',meal.carbs_g,'#FFFBEB','#92400E'],
                                      ['F',meal.fat_g,'#F5F3FF','#5B21B6'],
                                    ].map(([l,v,bg,tc])=>(
                                      <span key={l} style={{backgroundColor:bg,color:tc,borderRadius:6,padding:'2px 6px',fontSize:11,fontWeight:600,fontFamily:"'Space Grotesk','Tajawal',sans-serif"}}>{l} {Math.round(v||0)}g</span>
                                    ))}
                                  </div>
                                </div>
                                {/* calories */}
                                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',flexShrink:0,minWidth:60}}>
                                  <span style={{fontSize:16,fontWeight:800,color:'var(--accent)',fontFamily:"'Space Grotesk','Tajawal',sans-serif"}}>{meal.actual_calories}</span>
                                  <span style={{fontSize:10,color:'var(--text-secondary)',fontFamily:F}}>kcal</span>
                                </div>
                                {/* log button (RTL: last in DOM = visual left) */}
                                {loggedPlanMeals.has(idx+'-'+meal.meal_time) ? (
                                  <div style={{
                                    flexShrink:0, paddingInline:12, paddingBlock:6,
                                    borderRadius:20, backgroundColor:'#E8F5E9',
                                    fontSize:12, fontWeight:700, color:'#2E7D32',
                                    display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap'
                                  }}>
                                    <span>✓</span><span>تمت الإضافة</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); logSinglePlanMeal(meal, idx) }}
                                    style={{
                                      flexShrink:0, paddingInline:12, paddingBlock:6,
                                      borderRadius:20, backgroundColor:'var(--text-primary)',
                                      color:'#FFFFFF', border:'none', cursor:'pointer',
                                      fontSize:12, fontWeight:700,
                                      display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap'
                                    }}
                                  >
                                    {`+ ${{ 'الفطور':'أضيفي للفطور', 'الغداء':'أضيفي للغداء', 'وجبة خفيفة':'أضيفي للسناك', 'العشاء':'أضيفي للعشاء' }[meal.meal_time] || 'أضيفي'}`}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                          {day.tip && (
                            <div style={{padding:'10px 16px',backgroundColor:'var(--surface-inset)',borderTop:'1px solid var(--accent-faint)'}}>
                              <div style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.55,fontFamily:F}}>💡 {day.tip}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                </div>
              )}

              {/* ── DAILY LOG ── */}
              {tab==='daily' && (
                <div style={{paddingTop:14}}>
                  {mealPlan?.plan && !programMealsLogged && (
                    <div style={{
                      marginInline:16, marginBlockEnd:16,
                      padding:16, borderRadius:20,
                      backgroundColor:'#F7E9DF',
                      border:'1.5px solid #D89B7A',
                      display:'flex', justifyContent:'space-between',
                      alignItems:'center', gap:12
                    }}>
                      <button
                        onClick={logProgramMeals}
                        disabled={loggingProgramMeals}
                        style={{
                          paddingInline:16, paddingBlock:10,
                          backgroundColor: loggingProgramMeals ? '#C4B5A5' : '#3D2A1F',
                          color:'#FFFFFF', border:'none',
                          borderRadius:14, fontSize:13,
                          fontWeight:700, cursor:'pointer',
                          flexShrink:0
                        }}
                      >
                        {loggingProgramMeals ? 'جارٍ التسجيل...' : '✓ سجّل الآن'}
                      </button>
                      <div style={{textAlign:'right', flex:1}}>
                        <div style={{ fontSize:14, fontWeight:700, color:'#3D2A1F', marginBlockEnd:2 }}>
                          لديك خطة وجبات اليوم 🍽️
                        </div>
                        <div style={{ fontSize:12, color:'#8A6A4F' }}>
                          سجّلي وجبات برنامجك بضغطة واحدة
                        </div>
                      </div>
                    </div>
                  )}
                  {programMealsLogged && (
                    <div style={{
                      marginInline:16, marginBlockEnd:16,
                      padding:14, borderRadius:16,
                      backgroundColor:'#E8F5E9',
                      border:'1px solid #A5D6A7',
                      textAlign:'right'
                    }}>
                      <span style={{ fontSize:14, fontWeight:600, color:'#2E7D32' }}>✅ تم تسجيل وجبات اليوم من برنامجك</span>
                    </div>
                  )}
                  <CalorieRing calories={totals.calories||0} goal={G.calories} protein={totals.protein_g||0} carbs={totals.carbs_g||0} fat={totals.fat_g||0} G={G}/>
                  {/* Water */}
                  <div style={{backgroundColor:'#E0F7FA',border:'1px solid #B2EBF2',borderRadius:14,padding:'13px 16px',marginBottom:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                      <div>
                        <div style={{fontSize:'.6rem',fontWeight:700,letterSpacing:1.5,color:'#0097A7',marginBottom:2}}>الماء</div>
                        <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'1.3rem',color:'#00838F'}}>{totalWater}ml <span style={{fontSize:'.7rem',fontWeight:600,color:'#0097A7'}}>/ {G.water_ml||2500}ml</span></div>
                      </div>
                      <div style={{flex:1,margin:'0 12px'}}>
                        <div style={{height:6,backgroundColor:'#B2EBF2',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${pct(totalWater,G.water_ml||2500)}%`,backgroundColor:'#00838F',borderRadius:3,transition:'width .5s'}}/></div>
                        <div style={{fontSize:'.62rem',color:'#0097A7',marginTop:3,textAlign:'right'}}>{pct(totalWater,G.water_ml||2500)}%</div>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      {[150,250,330,500].map(ml=>(
                        <button key={ml} onClick={()=>logWater(ml)} style={{flex:1,padding:'7px 4px',backgroundColor:'#B2EBF2',border:'none',borderRadius:9,color:'#006064',cursor:'pointer',fontSize:'.72rem',fontWeight:700,fontFamily:"'DM Sans','Tajawal',sans-serif"}}>+{ml}ml</button>
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
                      <div key={mt.id} style={{backgroundColor:'var(--card)',border:'1px solid var(--accent-faint)',borderRadius:14,marginBottom:8,overflow:'hidden'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',cursor:'pointer'}} onClick={()=>setExpandMeal(open?null:mt.id)}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{fontSize:'1.2rem'}}>{mt.icon}</span>
                            <span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:600,fontSize:'.88rem',color:'var(--text-primary)'}}>{mt.label}</span>
                            {mls.length>0&&<span style={{background:`${mt.color}20`,color:mt.color,padding:'2px 7px',borderRadius:20,fontSize:'.62rem',fontWeight:700}}>{mls.length}</span>}
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            {mCal>0&&<span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,color:mt.color,fontSize:'.85rem'}}>{mCal} kcal</span>}
                            <button onClick={e=>{e.stopPropagation();setAddMealType(mt.id);setShowAddMeal(true)}}
                              style={{backgroundColor:MEAL_BTN_COLORS[mt.id]?.bg,border:'none',color:MEAL_BTN_COLORS[mt.id]?.tc,borderRadius:7,padding:'4px 9px',cursor:'pointer',fontSize:'.7rem',fontWeight:700,fontFamily:"'DM Sans','Tajawal',sans-serif"}}>+ سجّل وجبة</button>
                            <span style={{color:'var(--text-secondary)',fontSize:'.8rem',transition:'transform .2s',transform:open?'rotate(180deg)':'none'}}>▼</span>
                          </div>
                        </div>
                        {open && (
                          <div style={{borderTop:'1px solid var(--accent-faint)',padding:'10px 14px'}}>
                            {mls.length===0
                              ? <div style={{color:'var(--text-secondary)',fontSize:'.8rem',padding:'6px 0'}}>ما سجّلت شي بعد — يلا ابدأ!</div>
                              : mls.map(m=>(
                                <div key={m.id} onClick={() => setSelectedMeal(m)} style={{
                                  display:'flex', alignItems:'center', gap:12,
                                  paddingInline:0, paddingBlock:10,
                                  borderBottom:'1px solid var(--accent-faint)',
                                  cursor:'pointer',
                                }}>
                                  {/* Meal avatar — photo or emoji fallback */}
                                  <div style={{
                                    width:52, height:52, borderRadius:12,
                                    flexShrink:0, overflow:'hidden',
                                    backgroundColor: MEAL_COLORS[m.meal_type]?.bg || '#F5F5F5',
                                  }}>
                                    {m.image_url ? (
                                      <img
                                        src={m.image_url}
                                        alt={m.meal_name}
                                        style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                        onError={(e) => {
                                          e.target.style.display = 'none'
                                          e.target.nextSibling.style.display = 'flex'
                                        }}
                                      />
                                    ) : null}
                                    <div style={{
                                      width:'100%', height:'100%',
                                      display: m.image_url ? 'none' : 'flex',
                                      alignItems:'center', justifyContent:'center',
                                      fontSize:22,
                                    }}>
                                      {MEAL_COLORS[m.meal_type]?.emoji || '🍽️'}
                                    </div>
                                  </div>
                                  {/* Info */}
                                  <div style={{flex:1, textAlign:'right'}}>
                                    <div style={{fontSize:14, fontWeight:600, color:'var(--text-primary)'}}>{m.meal_name||'Meal'}</div>
                                    <div style={{fontSize:12, color:'var(--text-secondary)', marginBlockStart:2, display:'flex', gap:8, justifyContent:'flex-end'}}>
                                      {m.protein_g > 0 && <span style={{color:'#3B82F6'}}>بروتين {Math.round(m.protein_g)}g</span>}
                                      {m.carbs_g > 0 && <span style={{color:'#F59E0B'}}>كارب {Math.round(m.carbs_g)}g</span>}
                                      {m.fat_g > 0 && <span style={{color:'#8B5CF6'}}>دهن {Math.round(m.fat_g)}g</span>}
                                    </div>
                                    {m.portion_note && <div style={{fontSize:11, color:'var(--text-secondary)', textAlign:'right', marginBlockStart:2}}>{m.portion_note}</div>}
                                  </div>
                                  {/* Calories + arrow */}
                                  <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, flexShrink:0}}>
                                    <span style={{fontSize:15, fontWeight:700, color:'var(--accent)'}}>{m.total_calories}</span>
                                    <span style={{fontSize:10, color:'var(--text-secondary)'}}>سعرة</span>
                                    <span style={{fontSize:12, color:'var(--text-secondary)'}}>←</span>
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
                    <div style={{textAlign:'center',padding:'30px 0'}}>
                      <div style={{fontSize:'2.5rem',marginBottom:8}}>🍽️</div>
                      <div style={{fontWeight:600,marginBottom:4,fontSize:14,color:'var(--text-secondary)',fontFamily:F}}>ما سجّلت شي بعد — يلا ابدأ!</div>
                      <button onClick={()=>setShowAddMeal(true)} style={{backgroundColor:'var(--text-primary)',border:'none',borderRadius:12,padding:'12px 22px',fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.9rem',color:'#FFFFFF',cursor:'pointer',marginTop:10}}>سجّل أول وجبة</button>
                    </div>
                  )}
                </div>
              )}

              {/* ── NUTRIENTS ── */}
              {tab==='nutrients' && (
                <div style={{paddingTop:14,paddingBottom:20}}>
                  {/* Daily summary card */}
                  <div style={{marginInline:16,marginBlockEnd:16,padding:20,backgroundColor:'var(--card)',borderRadius:20,boxShadow:'var(--shadow-card)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBlockEnd:16}}>
                      <span style={{fontSize:13,color:'var(--text-secondary)',fontFamily:F}}>{Math.round(totals.calories||0)} / {G.calories||0} سعرة</span>
                      <span style={{fontSize:13,color:'var(--text-secondary)',fontFamily:F}}>سعراتك اليوم</span>
                    </div>
                    <div style={{textAlign:'center',fontSize:48,fontWeight:800,color:'var(--accent)',marginBlockEnd:8,fontFamily:F,lineHeight:1}}>
                      {Math.round(totals.calories||0)}
                    </div>
                    <div style={{textAlign:'center',marginBlockEnd:16,fontSize:13,fontFamily:F,color:(totals.calories||0)<=(G.calories||0)?'#22C55E':'#EF4444'}}>
                      {(totals.calories||0)<=(G.calories||0)
                        ? `باقي ${(G.calories||0) - Math.round(totals.calories||0)} سعرة`
                        : `تجاوزتَ الهدف بـ ${Math.round(totals.calories||0) - (G.calories||0)} سعرة`}
                    </div>
                    {[
                      {label:'بروتين', val:Math.round(totals.protein_g||0), goal:G.protein_g||0, color:'#3B82F6'},
                      {label:'كارب',   val:Math.round(totals.carbs_g||0),   goal:G.carbs_g||0,   color:'#F59E0B'},
                      {label:'دهن',    val:Math.round(totals.fat_g||0),     goal:G.fat_g||0,     color:'#8B5CF6'},
                    ].map(({label,val,goal,color},i,arr)=>(
                      <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingBlock:8,borderBottom:i<arr.length-1?'1px solid var(--accent-faint)':'none'}}>
                        <span style={{fontSize:14,fontWeight:600,color,fontFamily:F}}>{val}g / {goal}g</span>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:14,color:'var(--text-primary)',fontFamily:F}}>{label}</span>
                          <div style={{width:10,height:10,borderRadius:5,backgroundColor:color,flexShrink:0}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Nutrient groups */}
                  {['macro','fat','micro','vitamin','mineral'].map(group => {
                    const groupNutrients = NUTRIENTS.filter(n=>n.group===group)
                    const groupLabels = {macro:'الكربوهيدرات والبروتين',fat:'الدهون',micro:'الكهارل',vitamin:'الفيتامينات',mineral:'المعادن'}
                    return (
                      <div key={group} style={{marginInline:16,marginBottom:14}}>
                        <div style={{fontSize:'.6rem',fontWeight:700,letterSpacing:1.5,color:'var(--text-secondary)',marginBottom:10}}>{groupLabels[group].toUpperCase()}</div>
                        <div style={{backgroundColor:'var(--card)',border:'1px solid var(--accent-faint)',borderRadius:14,padding:'10px 14px'}}>
                          {groupNutrients.map((n, i) => {
                            const val = totals[n.key]||0
                            const goalVal = G[n.key]||0
                            const p = pct(val, goalVal)
                            const over = val > goalVal && goalVal > 0
                            return (
                              <div key={n.key} style={{padding:'8px 0',borderBottom:i<groupNutrients.length-1?'1px solid var(--accent-faint)':'none'}}>
                                <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                                  <span style={{fontSize:'.82rem',color:'var(--text-primary)',fontWeight:500,fontFamily:F}}>{n.label}</span>
                                  <div style={{display:'flex',alignItems:'baseline',gap:5}}>
                                    <span style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.88rem',color:n.color}}>{fmt(val)}<span style={{fontSize:'.6rem',opacity:.7,marginLeft:1}}>{n.unit}</span></span>
                                    {goalVal>0&&<span style={{fontSize:'.68rem',color:over?'#ef4444':'var(--text-secondary)',fontWeight:over?700:400}}>/ {fmt(goalVal)}{n.unit}</span>}
                                    {goalVal>0&&<span style={{fontSize:'.65rem',color:over?'#ef4444':p>=80?'#4ade80':'var(--text-secondary)',fontWeight:700,minWidth:32,textAlign:'right'}}>{p}%{over&&' ⚠'}</span>}
                                  </div>
                                </div>
                                {goalVal>0&&(
                                  <div style={{height:4,backgroundColor:'var(--accent-faint)',borderRadius:2,overflow:'hidden',position:'relative'}}>
                                    <div style={{height:'100%',width:`${Math.min(100,p)}%`,backgroundColor:over?'#ef4444':n.color,borderRadius:2,transition:'width .5s ease'}}/>
                                    {over&&<div style={{position:'absolute',top:0,left:`${Math.min(100,Math.round((goalVal/Math.max(val,goalVal))*100))}%`,width:2,height:'100%',backgroundColor:'var(--text-secondary)'}}/>}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  {!goals&&<div style={{marginInline:16,background:'rgba(203,162,59,0.05)',border:'1px solid rgba(203,162,59,0.12)',borderRadius:12,padding:'12px 16px',fontSize:'.8rem',color:'rgba(203,162,59,0.6)',lineHeight:1.6,fontFamily:F}}>
                    💡 أضف عمرك ووزنك وطولك وهدفك في الإعدادات للحصول على أهداف غذائية مخصصة بناءً على معادلة ميفلين-سانت جيور.
                  </div>}
                </div>
              )}
            </div>

            {/* ── REPORT TAB (outside maxWidth container, matches original) ── */}
            {tab==='report' && (
              <div style={{maxWidth:520,margin:'0 auto',padding:'16px 16px 100px'}}>
                {!report && !reportLoading && (
                  <div style={{textAlign:'center',padding:'20px 0'}}>
                    <div style={{fontSize:'2.5rem',marginBottom:12}}>🤖</div>
                    <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'1.1rem',marginBottom:6}}>تحليل تغذيتك اليومي</div>
                    <div style={{color:'rgba(255,255,255,0.35)',fontSize:'.82rem',marginBottom:20,lineHeight:1.6}}>AI analyzes your full day of eating - every meal, every ingredient - and gives you a detailed nutritional report with scores, feedback and tips.</div>
                    {!meals.length
                      ? <div style={{color:'rgba(255,255,255,0.25)',fontSize:'.82rem'}}>Log some meals first to generate a report.</div>
                      : <button onClick={generateReport} style={{background:'#CBA23B',border:'none',borderRadius:14,padding:'15px 28px',fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'1rem',color:'#0C0B0D',cursor:'pointer',boxShadow:'0 4px 20px rgba(203,162,59,0.2)'}}>Analyze My Day ←</button>
                    }
                    {reportErr && <div style={{color:'#fca5a5',fontSize:'.8rem',marginTop:12,padding:'10px 14px',background:'rgba(239,68,68,.08)',borderRadius:10,border:'1px solid rgba(239,68,68,.2)'}}>{reportErr}</div>}
                  </div>
                )}
                {reportLoading && (
                  <div style={{textAlign:'center',padding:'40px 0'}}>
                    <div style={{width:48,height:48,border:'3px solid rgba(203,162,59,0.2)',borderTopColor:'#CBA23B',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 16px'}}/>
                    <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,color:'#CBA23B',letterSpacing:1}}>ANALYZING YOUR NUTRITION...</div>
                    <div style={{color:'rgba(255,255,255,0.3)',fontSize:'.78rem',marginTop:6}}>Reviewing {meals.length} meal{meals.length>1?'s':''} logged today</div>
                  </div>
                )}
                {report && (
                  <div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:reportIsStale?8:16}}>
                      <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'1rem'}}>تقرير تغذيتك اليومي</div>
                      <button onClick={generateReport} disabled={reportLoading} style={{background:'rgba(203,162,59,0.08)',border:'1px solid rgba(203,162,59,0.2)',borderRadius:9,padding:'6px 13px',color:'#CBA23B',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.75rem',fontWeight:700,opacity:reportLoading?.6:1}}>
                        {reportLoading ? '...' : 'حاول مرة ثانية'}
                      </button>
                    </div>
                    {reportIsStale && (
                      <div style={{background:'rgba(234,179,8,0.08)',border:'1px solid rgba(234,179,8,0.25)',borderRadius:11,padding:'10px 14px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                        <div>
                          <div style={{fontSize:'.72rem',fontWeight:700,color:'#eab308',marginBottom:2}}>⚠ Meals have changed</div>
                          <div style={{fontSize:'.7rem',color:'rgba(255,255,255,0.4)'}}>This report was generated before your latest meal edits.</div>
                        </div>
                        <button onClick={generateReport} style={{background:'rgba(234,179,8,0.15)',border:'1px solid rgba(234,179,8,0.3)',borderRadius:8,padding:'7px 12px',color:'#eab308',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.72rem',fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>Update now</button>
                      </div>
                    )}
                    {/* Overall score ring */}
                    <div style={{background:'rgba(203,162,59,0.06)',border:'1px solid rgba(203,162,59,0.18)',borderRadius:16,padding:'16px',marginBottom:14}}>
                      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:12}}>
                        <div style={{flexShrink:0}}>
                          {(() => {
                            const score = report.overall_score || 0
                            const r = 36, circ = 2*Math.PI*r
                            const pct = score/10
                            const col = score>=8?'#4ade80':score>=6?'#CBA23B':score>=4?'#eab308':'#ef4444'
                            return (
                              <svg width={88} height={88} viewBox="0 0 88 88">
                                <circle cx={44} cy={44} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8}/>
                                <circle cx={44} cy={44} r={r} fill="none" stroke={col} strokeWidth={8} strokeDasharray={`${pct*circ} ${circ}`} strokeLinecap="round" transform="rotate(-90 44 44)"/>
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
                      {report.macros_balance && (
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          {[['البروتين',report.macros_balance.protein_status,{deficient:'#ef4444',adequate:'#eab308',excellent:'#4ade80'}],['الكارب',report.macros_balance.carbs_status,{low:'#3b82f6',optimal:'#4ade80',high:'#ef4444'}],['الدهن',report.macros_balance.fat_status,{low:'#3b82f6',optimal:'#4ade80',high:'#ef4444'}],['الألياف',report.macros_balance.fiber_status,{deficient:'#ef4444',adequate:'#eab308',good:'#4ade80'}]].map(([label,status,colorMap]) => {
                            const col = colorMap[status] || '#888'
                            return <span key={label} style={{background:col+'18',border:'1px solid '+col+'44',color:col,padding:'4px 11px',borderRadius:20,fontSize:'.7rem',fontWeight:700}}>{label}: {status?.replace('_',' ')}</span>
                          })}
                          {report.hydration_status && <span style={{background:'rgba(6,182,212,0.12)',border:'1px solid rgba(6,182,212,0.3)',color:'#06b6d4',padding:'4px 11px',borderRadius:20,fontSize:'.7rem',fontWeight:700}}>Hydration: {report.hydration_status}</span>}
                        </div>
                      )}
                    </div>
                    {/* Per-meal breakdown */}
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
                              {mr && (<>
                                {mr.assessment && <div style={{fontSize:'.8rem',color:'rgba(255,255,255,0.55)',lineHeight:1.5,marginBottom:8}}>{mr.assessment}</div>}
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                                  {mr.positives?.length > 0 && <div style={{background:'rgba(74,222,128,0.04)',border:'1px solid rgba(74,222,128,0.12)',borderRadius:9,padding:'8px 10px'}}><div style={{fontSize:'.58rem',fontWeight:700,letterSpacing:1,color:'#4ade80',marginBottom:5}}>نقاط قوتك</div>{mr.positives.map((p,i) => <div key={i} style={{fontSize:'.75rem',color:'rgba(255,255,255,0.55)',marginBottom:3,lineHeight:1.4}}>+ {p}</div>)}</div>}
                                  {mr.improvements?.length > 0 && <div style={{background:'rgba(248,113,113,0.04)',border:'1px solid rgba(248,113,113,0.12)',borderRadius:9,padding:'8px 10px'}}><div style={{fontSize:'.58rem',fontWeight:700,letterSpacing:1,color:'#f87171',marginBottom:5}}>طوّر هذا</div>{mr.improvements.map((p,i) => <div key={i} style={{fontSize:'.75rem',color:'rgba(255,255,255,0.55)',marginBottom:3,lineHeight:1.4}}>! {p}</div>)}</div>}
                                </div>
                              </>)}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {report.what_went_well?.length > 0 && (
                      <div style={{background:'rgba(74,222,128,0.05)',border:'1px solid rgba(74,222,128,0.15)',borderRadius:14,padding:'13px 14px',marginBottom:10}}>
                        <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'#4ade80',marginBottom:10}}>ما شاء الله — أحسنت</div>
                        {report.what_went_well.map((w,i) => <div key={i} style={{display:'flex',gap:8,marginBottom:7}}><span style={{color:'#4ade80',flexShrink:0,fontSize:'.85rem'}}>✓</span><span style={{fontSize:'.82rem',color:'rgba(255,255,255,0.65)',lineHeight:1.5}}>{w}</span></div>)}
                      </div>
                    )}
                    {report.improvements?.length > 0 && (
                      <div style={{background:'rgba(248,113,113,0.05)',border:'1px solid rgba(248,113,113,0.15)',borderRadius:14,padding:'13px 14px',marginBottom:10}}>
                        <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'#f87171',marginBottom:10}}>نقاط تحتاج تطوير</div>
                        {report.improvements.map((w,i) => <div key={i} style={{display:'flex',gap:8,marginBottom:7}}><span style={{color:'#f87171',flexShrink:0,fontSize:'.85rem'}}>↑</span><span style={{fontSize:'.82rem',color:'rgba(255,255,255,0.65)',lineHeight:1.5}}>{w}</span></div>)}
                      </div>
                    )}
                    {report.nutrients_of_concern?.length > 0 && (
                      <div style={{background:'rgba(234,179,8,0.05)',border:'1px solid rgba(234,179,8,0.18)',borderRadius:14,padding:'13px 14px',marginBottom:10}}>
                        <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'#eab308',marginBottom:10}}>مغذيات تستحق الانتباه</div>
                        {report.nutrients_of_concern.map((n,i) => <div key={i} style={{fontSize:'.82rem',color:'rgba(255,255,255,0.6)',marginBottom:4}}>⚠ {n}</div>)}
                      </div>
                    )}
                    {report.meal_timing_note && (
                      <div style={{background:'rgba(129,140,248,0.05)',border:'1px solid rgba(129,140,248,0.15)',borderRadius:14,padding:'12px 14px',marginBottom:10}}>
                        <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'#818cf8',marginBottom:6}}>توقيت الوجبة</div>
                        <div style={{fontSize:'.82rem',color:'rgba(255,255,255,0.6)',lineHeight:1.5}}>{report.meal_timing_note}</div>
                      </div>
                    )}
                    {report.tomorrow_tips?.length > 0 && (
                      <div style={{background:'rgba(203,162,59,0.04)',border:'1px solid rgba(203,162,59,0.14)',borderRadius:14,padding:'13px 14px',marginBottom:16}}>
                        <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'rgba(203,162,59,0.6)',marginBottom:10}}>نصيحة للجلسة الجاية</div>
                        {report.tomorrow_tips.map((t,i) => <div key={i} style={{display:'flex',gap:8,marginBottom:7}}><span style={{color:'#CBA23B',flexShrink:0,fontSize:'.85rem'}}>💡</span><span style={{fontSize:'.82rem',color:'rgba(255,255,255,0.65)',lineHeight:1.5}}>{t}</span></div>)}
                      </div>
                    )}
                    <button onClick={generateReport} disabled={reportLoading} style={{width:'100%',padding:'13px',background:'rgba(203,162,59,0.08)',border:'1px solid rgba(203,162,59,0.2)',borderRadius:12,color:'#CBA23B',cursor:reportLoading?'not-allowed':'pointer',fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:700,fontSize:'.9rem',opacity:reportLoading?.6:1}}>
                      {reportLoading ? 'جاري التحليل...' : 'حاول مرة ثانية'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 3 — AI PHOTO/TEXT ANALYZER
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'analyze' && (
          <div style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 100, fontFamily: F }}>
            {!t3Result ? (
              <div>
                {/* Page header */}
                <div style={{ paddingBlock: 16, paddingInline: 16, textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, fontFamily: F }}>تحليل الوجبة 🔍</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: F }}>صوّري وجبتك أو اكتبي مكوناتها</div>
                </div>

                <div style={{ padding: '0 16px' }}>
                  {/* Image upload area */}
                  {t3ImgPreview ? (
                    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 12, cursor: 'pointer' }}
                      onClick={() => { t3FileRef.current.removeAttribute('capture'); t3FileRef.current.click() }}>
                      <img src={t3ImgPreview} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,.75)', borderRadius: 6, padding: '3px 10px', fontSize: '.68rem', color: 'rgba(255,255,255,.6)' }}>اضغطي لتغيير الصورة</div>
                    </div>
                  ) : (
                    <div
                      onClick={() => { t3FileRef.current.removeAttribute('capture'); t3FileRef.current.click() }}
                      style={{
                        backgroundColor: 'var(--card)',
                        border: '2px dashed var(--accent-soft)',
                        borderRadius: 16, padding: 32,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 12, cursor: 'pointer', minHeight: 180,
                        marginBottom: 12,
                      }}>
                      <span style={{ fontSize: 48 }}>📸</span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: F }}>صوّري وجبتك</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: F }}>أو اختاري صورة من المعرض</span>
                    </div>
                  )}
                  <input ref={t3FileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => t3LoadImg(e.target.files[0])} />

                  {/* Camera / Gallery buttons */}
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBlockStart: t3ImgPreview ? 0 : 4, marginBottom: 16 }}>
                    <button
                      onClick={() => { t3FileRef.current.setAttribute('capture', 'environment'); t3FileRef.current.click() }}
                      style={{ paddingInline: 20, paddingBlock: 10, borderRadius: 20, fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'var(--text-primary)', color: '#FFFFFF', fontFamily: F }}>
                      📷 الكاميرا
                    </button>
                    <button
                      onClick={() => { t3FileRef.current.removeAttribute('capture'); t3FileRef.current.click() }}
                      style={{ paddingInline: 20, paddingBlock: 10, borderRadius: 20, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'var(--card)', color: 'var(--text-primary)', border: '1px solid var(--accent-soft)', fontFamily: F }}>
                      🖼 المعرض
                    </button>
                    {t3ImgPreview && (
                      <button
                        onClick={() => { setT3ImgB64(null); setT3ImgPreview(null) }}
                        style={{ paddingInline: 14, paddingBlock: 10, borderRadius: 20, fontSize: 14, cursor: 'pointer', border: '1px solid #FECACA', backgroundColor: '#FEF2F2', color: '#EF4444', fontFamily: F }}>
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--accent-faint)' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '.7rem', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: F }}>أو صفي الوجبة بكلامك</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--accent-faint)' }} />
                  </div>

                  {/* Text input */}
                  <textarea
                    className="t3-textarea"
                    value={t3TextInput}
                    onChange={e => setT3TextInput(e.target.value)}
                    placeholder="أو اكتبي مكونات الوجبة مثل: أرز بسمتي ١٠٠ج، دجاج مشوي ١٥٠ج..."
                    rows={4}
                    style={{
                      marginBottom: 12, resize: 'vertical', lineHeight: 1.7,
                      backgroundColor: 'var(--card)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--accent-soft)',
                      borderRadius: 12, padding: 14, width: '100%',
                      fontSize: 14, textAlign: 'right',
                      minHeight: 100,
                      fontFamily: F,
                    }}
                  />

                  {t3ImgB64 && t3TextInput && (
                    <div style={{ color: 'var(--accent)', fontSize: '.72rem', marginBottom: 10, fontWeight: 600, fontFamily: F }}>✓ سيتم دمج الصورة والوصف لتحليل أدق</div>
                  )}

                  {/* Error */}
                  {t3Err && (
                    <div style={{ color: '#fca5a5', fontSize: '.8rem', marginBottom: 10, padding: '10px 14px', background: 'rgba(239,68,68,.08)', borderRadius: 10, border: '1px solid rgba(239,68,68,.2)', fontFamily: F }}>
                      {t3Err}
                    </div>
                  )}

                  {/* Analyze button */}
                  {t3Analyzing
                    ? <div style={{ textAlign: 'center', padding: '28px' }}>
                        <div style={{ width: 44, height: 44, border: '3px solid rgba(203,162,59,0.2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 14px' }} />
                        <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: F }}>جارٍ التحليل...</div>
                      </div>
                    : <button
                        onClick={t3Analyze}
                        disabled={t3Analyzing || (!t3ImgB64 && !t3TextInput.trim())}
                        style={{
                          marginBlockStart: 16, width: '100%', padding: 14,
                          backgroundColor: (!t3ImgB64 && !t3TextInput.trim()) ? 'var(--accent-soft)' : 'var(--text-primary)',
                          color: '#FFFFFF',
                          border: 'none', borderRadius: 16, fontSize: 15,
                          fontWeight: 700, cursor: (!t3ImgB64 && !t3TextInput.trim()) ? 'not-allowed' : 'pointer',
                          fontFamily: F, opacity: (!t3ImgB64 && !t3TextInput.trim()) ? 0.5 : 1,
                          transition: 'all .2s',
                        }}>
                        تحليل 🔍
                      </button>
                  }
                </div>
              </div>
            ) : (
              <div style={{ padding: '0 16px' }}>
                <ResultView
                  result={t3Result}
                  imgPreview={t3ImgPreview}
                  goals={G}
                  onBack={() => { setT3Result(null); setT3Err('') }}
                  onSave={t3Save}
                  saving={t3Saving}
                  savingTemplate={false}
                  onSaveTemplate={() => {}}
                  err={t3Err}
                  NUTRIENTS={NUTRIENTS}
                  pct={pct}
                />
              </div>
            )}
          </div>
        )}

        <div style={{ height: 'calc(72px + env(safe-area-inset-bottom))' }} />
      </div>

      <BottomTabs active="meals" />
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function CalorieRing({ calories, goal, protein, carbs, fat, G }) {
  const pct = Math.min(1, calories/goal)
  const over = calories > goal
  const r = 42, circ = 2*Math.PI*r
  return (
    <div style={{backgroundColor:'var(--card)',border:'1px solid var(--accent-soft)',borderRadius:18,padding:'16px',marginBottom:12}}>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:14}}>
        <div style={{flexShrink:0}}>
          <svg width={100} height={100} viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={r} fill="none" stroke="var(--accent-faint)" strokeWidth={9}/>
            <circle cx={50} cy={50} r={r} fill="none" stroke={over?'#ef4444':'var(--accent)'} strokeWidth={9}
              strokeDasharray={`${pct*circ} ${circ}`} strokeLinecap="round"
              transform="rotate(-90 50 50)" style={{transition:'stroke-dasharray .6s'}}/>
            <text x={50} y={46} textAnchor="middle" fill={over?'#ef4444':'var(--accent)'} fontSize={15} fontFamily="'Space Grotesk','Tajawal',sans-serif" fontWeight={800}>{Math.round(calories)}</text>
            <text x={50} y={60} textAnchor="middle" fill="var(--text-secondary)" fontSize={9} fontFamily="'DM Sans','Tajawal',sans-serif">سعرة</text>
          </svg>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:'.62rem',fontWeight:700,letterSpacing:1.5,color:'var(--text-secondary)',marginBottom:6}}>هدفك اليومي: {goal} سعرة</div>
          <div style={{fontSize:'.8rem',marginBottom:10,fontWeight:600}}>
            {goal-calories>0
              ? <span style={{color:'#22C55E'}}>{goal-calories} سعرة باقيين لك</span>
              : <span style={{color:'#EF4444'}}>{calories-goal} سعرة زادت</span>}
          </div>
          {[['بروتين',protein,G.protein_g,'#3b82f6'],['كارب',carbs,G.carbs_g,'#f97316'],['دهن',fat,G.fat_g,'#a855f7']].map(([l,v,g,c])=>(
            <div key={l} style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
              <span style={{fontSize:'.65rem',fontWeight:700,color:'var(--text-primary)',minWidth:30,fontFamily:F}}>{l}</span>
              <div style={{flex:1,height:5,backgroundColor:'var(--accent-faint)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.min(100,g>0?(v/g)*100:0)}%`,backgroundColor:c,borderRadius:3,transition:'width .5s'}}/>
              </div>
              <span style={{fontSize:'.65rem',color:'var(--text-secondary)',minWidth:52,textAlign:'right',fontFamily:F}}>{Math.round(v||0)}g / {g}g</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,paddingTop:12,borderTop:'1px solid var(--accent-faint)'}}>
        {[['البروتين',protein,'g','#3b82f6'],['الكارب',carbs,'g','#f97316'],['الدهن',fat,'g','#a855f7']].map(([l,v,u,c])=>(
          <div key={l} style={{textAlign:'center'}}>
            <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.95rem',color:c,lineHeight:1}}>{Math.round(v||0)}<span style={{fontSize:'.58rem',opacity:.6,marginLeft:1}}>{u}</span></div>
            <div style={{fontSize:'.56rem',color:'var(--text-secondary)',letterSpacing:1,marginTop:3,fontWeight:700}}>{l.toUpperCase()}</div>
          </div>
        ))}
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:800,fontSize:'.95rem',color:'var(--accent)',lineHeight:1}}>{Math.round(pct*100)}<span style={{fontSize:'.58rem',opacity:.6}}>%</span></div>
          <div style={{fontSize:'.56rem',color:'var(--text-secondary)',letterSpacing:1,marginTop:3,fontWeight:700}}>من الهدف</div>
        </div>
      </div>
    </div>
  )
}

function ResultView({ result, imgPreview, goals, onBack, onSave, saving, savingTemplate, onSaveTemplate, err, NUTRIENTS, pct }) {
  const [ings, setIngs] = useState(() => initIngs(result.ingredients))
  const [editMode, setEditMode] = useState(true)

  React.useEffect(() => { setIngs(initIngs(result.ingredients)) }, [result])

  function initIngs(rawIngs) {
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

  const ingTotals = ings.reduce((acc, ing) => ({
    calories:  acc.calories  + (ing.calories  || 0),
    protein_g: acc.protein_g + (ing.protein_g || 0),
    carbs_g:   acc.carbs_g   + (ing.carbs_g   || 0),
    fat_g:     acc.fat_g     + (ing.fat_g     || 0),
    fiber_g:   acc.fiber_g   + (ing.fiber_g   || 0),
  }), {calories:0,protein_g:0,carbs_g:0,fat_g:0,fiber_g:0})

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

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:12}}>
        {[['البروتين',showProt,'g','#3b82f6'],['الكارب',showCarbs,'g','#f97316'],['الدهن',showFat,'g','#a855f7'],['الألياف',ings.length?r1(ingTotals.fiber_g):r1(result.fiber_g),'g','#22c55e']].map(([l,v,u,col])=>(
          <div key={l} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(203,162,59,0.10)',borderRadius:10,padding:'10px 4px',textAlign:'center'}}>
            <div style={{fontFamily:"'Space Grotesk','Tajawal',sans-serif",fontWeight:900,fontSize:'1.05rem',color:col,lineHeight:1}}>{v}<span style={{fontSize:'.55rem',opacity:.6}}>{u}</span></div>
            <div style={{fontSize:'.56rem',color:'rgba(255,255,255,0.3)',letterSpacing:1,marginTop:3,fontWeight:700}}>{l.toUpperCase()}</div>
          </div>
        ))}
      </div>

      <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,padding:'12px 14px',marginBottom:12}}>
        <div style={{fontSize:'.6rem',fontWeight:700,letterSpacing:1.5,color:'rgba(255,255,255,0.2)',marginBottom:10}}>التفاصيل الغذائية الكاملة</div>
        {NUTRIENTS.filter(n=>!['protein_g','carbs_g','fat_g','fiber_g'].includes(n.key)).map((n,i)=>result[n.key]>0&&(
          <div key={n.key} className="mrow">
            <span style={{fontSize:'.78rem',color:'rgba(255,255,255,0.5)'}}>{n.label}</span>
            <span style={{fontSize:'.8rem',color:n.color,fontWeight:700}}>{Math.round((result[n.key]||0)*10)/10}{n.unit}</span>
          </div>
        ))}
      </div>

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
            <div>
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
  const [tab, setTab] = useState('ingredients')
  const [ingredients, setIngredients] = useState(() => {
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
    return [withPerGram({ name: meal.meal_name || '', portion: meal.portion_note || '', calories: meal.total_calories || 0, protein_g: meal.protein_g || 0, carbs_g: meal.carbs_g || 0, fat_g: meal.fat_g || 0, fiber_g: meal.fiber_g || 0 })]
  })
  const [saving, setSaving] = useState(false)
  const [imgB64, setImgB64] = useState(null)
  const [imgMime, setImgMime] = useState('image/jpeg')
  const [imgPreview, setImgPreview] = useState(null)
  const [textInput, setTextInput] = useState(meal.meal_name || '')
  const [analyzing, setAnalyzing] = useState(false)
  const [reResult, setReResult] = useState(null)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  const addRow = () => setIngredients(p => [...p, { name:'', portion:'', calories:0, protein_g:0, carbs_g:0, fat_g:0, fiber_g:0, _baseGrams:0, _baseCals:0, _baseProt:0, _baseCarbs:0, _baseFat:0, _baseFiber:0 }])
  const removeRow = i => setIngredients(p => p.filter((_,j) => j !== i))

  const extractGrams = (str) => {
    if (!str) return null
    const s = String(str).trim()
    const paren = s.match(/\((\d+\.?\d*)\s*(?:g|gr|gram)/i)
    if (paren) return parseFloat(paren[1])
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
          let perGramCal, perGramProt, perGramCarbs, perGramFat, perGramFiber

          if (row._perGramCal !== undefined) {
            perGramCal   = row._perGramCal
            perGramProt  = row._perGramProt
            perGramCarbs = row._perGramCarbs
            perGramFat   = row._perGramFat
            perGramFiber = row._perGramFiber
          } else {
            const currentGrams = extractGrams(row.portion)
            if (currentGrams && currentGrams > 0) {
              perGramCal   = (row.calories  || 0) / currentGrams
              perGramProt  = (row.protein_g || 0) / currentGrams
              perGramCarbs = (row.carbs_g   || 0) / currentGrams
              perGramFat   = (row.fat_g     || 0) / currentGrams
              perGramFiber = (row.fiber_g   || 0) / currentGrams
            } else {
              return updated
            }
          }

          updated.calories  = Math.round(perGramCal   * newGrams)
          updated.protein_g = Math.round(perGramProt  * newGrams * 10) / 10
          updated.carbs_g   = Math.round(perGramCarbs * newGrams * 10) / 10
          updated.fat_g     = Math.round(perGramFat   * newGrams * 10) / 10
          updated.fiber_g   = Math.round(perGramFiber * newGrams * 10) / 10

          updated._perGramCal   = perGramCal
          updated._perGramProt  = perGramProt
          updated._perGramCarbs = perGramCarbs
          updated._perGramFat   = perGramFat
          updated._perGramFiber = perGramFiber
        }
      }

      return updated
    }))
  }

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
    delete updates.calories
    await onSave(meal.id, updates)
    onClose()
    setSaving(false)
  }

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
      if (data.ingredients?.length) {
        setIngredients(data.ingredients.map(i => {
          const ing = {
            name: i.name || '', portion: i.portion || '',
            calories: i.calories || 0, protein_g: i.protein_g || 0,
            carbs_g: i.carbs_g || 0, fat_g: i.fat_g || 0, fiber_g: i.fiber_g || 0,
          }
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

        <div style={{display:'flex',background:'rgba(255,255,255,0.04)',borderRadius:10,padding:3,marginBottom:16,gap:3}}>
          {[['ingredients','✏️ Edit Ingredients'],['reanalyze','🔍 Re-analyze with AI']].map(([id,label]) => (
            <button key={id} onClick={() => { setTab(id); setErr('') }}
              style={{flex:1,padding:'9px 8px',background:tab===id?'rgba(203,162,59,0.15)':'transparent',border:'1px solid ' + (tab===id?'rgba(203,162,59,0.3)':'transparent'),borderRadius:8,color:tab===id?'#CBA23B':'rgba(255,255,255,0.4)',cursor:'pointer',fontFamily:"'DM Sans','Tajawal',sans-serif",fontSize:'.76rem',fontWeight:700,transition:'all .15s'}}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'ingredients' && (
          <div>
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
                {hasGrams && <div style={{fontSize:'.62rem',color:'rgba(203,162,59,0.5)',marginBottom:6,marginTop:-2}}>⚖️ Nutrition auto-scales when you change the gram value</div>}
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
