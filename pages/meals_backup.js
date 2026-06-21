import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { TopNav, BottomTabs } from '../components/Nav'
import { calcNutrientGoals } from '../lib/nutrition'

// ── Constants ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: 'الكل',    match: null },
  { label: 'رئيسي',  match: ['كبسة','مجبوس','برياني','دجاج','لحم','سمك','أرز','مندي','هريسة','ملوخية','مقلوبة'] },
  { label: 'حلوى',   match: ['حلوى','كيك','تمر','لقيمات','بسبوسة','كنافة','مهلبية','عصيدة','حلو'] },
  { label: 'شوربة',  match: ['شوربة','حساء'] },
  { label: 'سلطة',   match: ['سلطة','تبولة'] },
  { label: 'فطور',   match: ['فطور','بيض','خبز','فول','فلافل','عجة'] },
  { label: 'مشويات', match: ['مشوي','مشاوي','كباب','شيش','تكا'] },
]

const MEAL_TYPES = [
  { id: 'breakfast', label: 'الفطور',      emoji: '☀️' },
  { id: 'lunch',     label: 'الغداء',       emoji: '🌤️' },
  { id: 'dinner',    label: 'العشاء',       emoji: '🌙' },
  { id: 'snack',     label: 'وجبة خفيفة',  emoji: '🍎' },
]

const todayStr = () => new Date().toISOString().split('T')[0]

const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

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
`

// ── Module-level helpers (stable identity — no re-mount on parent render) ──

function RecipeImg({ src, height = 130, className = '' }) {
  if (!src) {
    return (
      <div className={className} style={{
        width: '100%', height, backgroundColor: 'var(--accent-faint)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
      }}>🍽️</div>
    )
  }
  return <img src={src} alt="" className={className}
    style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />
}

function CalorieRing({ totalCal, goalCal }) {
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

function SearchAndChips({ search, onSearch, activeCategory, onCategory }) {
  return (
    <>
      <div style={{ marginInline: 16, marginBlockEnd: 12 }}>
        <div style={{
          backgroundColor: '#1A1A1A', borderRadius: 30,
          paddingInline: 16, paddingBlock: 12,
          display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8,
        }}>
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="ابحثي عن وصفة"
            style={{
              flex: 1, color: '#FFFFFF', backgroundColor: 'transparent',
              border: 'none', outline: 'none', textAlign: 'right',
              fontSize: 14, fontFamily: F,
            }}
          />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, flexShrink: 0 }}>🔍</span>
        </div>
      </div>
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
    </>
  )
}

// ── Recipe Detail ──────────────────────────────────────────────────────────
function RecipeDetail({ recipe, onBack }) {
  const [detailTab, setDetailTab] = useState('ingredients')

  return (
    <div style={{ direction: 'rtl', backgroundColor: 'var(--surface)', minHeight: '100vh' }}>
      {/* Back row */}
      <div style={{ paddingInline: 16, paddingBlock: 12, textAlign: 'right' }}>
        <button onClick={onBack} style={{
          fontSize: 14, color: 'var(--accent)', border: 'none',
          background: 'none', cursor: 'pointer', fontFamily: F, fontWeight: 600,
        }}>
          → رجوع
        </button>
      </div>

      {/* Hero */}
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

      {/* Actions */}
      <div style={{ backgroundColor: 'var(--card)', paddingBlock: 14, paddingInline: 16, display: 'flex', flexDirection: 'row', justifyContent: 'space-around' }}>
        {[{ icon: '❤️', label: 'المفضلة' }, { icon: '📅', label: 'جدولة' }, { icon: '🔗', label: 'مشاركة' }].map(({ icon, label }) => (
          <button key={label} onClick={() => console.log(label)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            border: 'none', background: 'none', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: F }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Meta */}
      {(recipe.cook_time || recipe.servings) && (
        <div style={{ paddingInline: 16, paddingBlock: 10, display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
          {recipe.cook_time && <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: F }}>🕐 {recipe.cook_time}</span>}
          {recipe.servings  && <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: F }}>👥 {recipe.servings}</span>}
        </div>
      )}

      {/* Detail tabs */}
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

      {/* Ingredients */}
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

      {/* Steps */}
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

  // ── Top tab ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('recipes')

  // ── Recipes tab ─────────────────────────────────────────────────────────
  const [recipes, setRecipes]               = useState([])
  const [recipesLoading, setRecipesLoading] = useState(true)
  const [search, setSearch]                 = useState('')
  const [activeCategory, setActiveCategory] = useState('الكل')
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [showAllRecipes, setShowAllRecipes] = useState(false)

  // ── Nutrition tab ───────────────────────────────────────────────────────
  const [meals, setMeals]               = useState([])
  const [mealsLoading, setMealsLoading] = useState(true)
  const [mealsDate, setMealsDate]       = useState(todayStr)
  const [goals, setGoals]               = useState(null)
  const [mealPlan, setMealPlan]         = useState(null)

  // ── Add meal modal ──────────────────────────────────────────────────────
  const [showAddMeal, setShowAddMeal]   = useState(false)
  const [addMealType, setAddMealType]   = useState('breakfast')
  const [addMealName, setAddMealName]   = useState('')
  const [addMealCal, setAddMealCal]     = useState('')

  // ── Meals loader ────────────────────────────────────────────────────────
  const loadMeals = useCallback(async (uid, date) => {
    setMealsLoading(true)
    try {
      const r = await fetch('/api/meals?userId=' + uid + '&date=' + date)
      const d = await r.json()
      if (r.ok) setMeals(d.meals || [])
    } catch (_) {}
    setMealsLoading(false)
  }, [])

  // ── Mount ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/'); return }
      const u = session.user
      setUser(u)

      // Meal plan — fire and forget, non-blocking
      fetch('/api/packages/meal-plan?userId=' + u.id)
        .then(r => r.json())
        .then(d => { if (d?.plan) setMealPlan(d) })
        .catch(() => {})

      // Profile + recipes in parallel
      const [profResult, recipeResult] = await Promise.allSettled([
        fetch('/api/profile?userId=' + u.id).then(r => r.json()),
        supabase.from('recipes').select('*').order('created_at', { ascending: false }),
      ])

      if (profResult.status === 'fulfilled' && profResult.value?.profile) {
        setProfile(profResult.value.profile)
        setGoals(calcNutrientGoals(profResult.value.profile))
      }
      if (recipeResult.status === 'fulfilled') {
        const { data, error } = recipeResult.value
        if (!error && data) setRecipes(data)
      }
      setRecipesLoading(false)
    }
    init()
  }, [])

  // ── Re-fetch meals when date or user changes ────────────────────────────
  useEffect(() => {
    if (user) loadMeals(user.id, mealsDate)
  }, [mealsDate, user, loadMeals])

  // ── Derived ─────────────────────────────────────────────────────────────
  const filtered = recipes.filter(r => {
    const matchesCat = activeCategory === 'الكل'
      ? true
      : CATEGORIES.find(c => c.label === activeCategory)?.match?.some(kw => r.name?.includes(kw))
    const matchesSearch = !search.trim() || r.name?.includes(search.trim())
    return matchesCat && matchesSearch
  })

  const totalCal   = meals.reduce((s, m) => s + (m.total_calories || 0), 0)
  const totalProt  = meals.reduce((s, m) => s + (m.protein_g || 0), 0)
  const totalCarbs = meals.reduce((s, m) => s + (m.carbs_g || 0), 0)
  const totalFat   = meals.reduce((s, m) => s + (m.fat_g || 0), 0)
  const goalCal    = goals?.calories  || 2000
  const goalProt   = goals?.protein_g || 150
  const goalCarbs  = goals?.carbs_g   || 250
  const goalFat    = goals?.fat_g     || 65

  const today      = todayStr()
  const canGoNext  = mealsDate < today

  // ── Add meal handler ────────────────────────────────────────────────────
  const handleAddMeal = async () => {
    if (!addMealName.trim() || !user?.id) return
    const body = {
      userId: user.id,
      meal_type: addMealType,
      meal_name: addMealName.trim(),
      total_calories: parseInt(addMealCal) || 0,
      meal_date: mealsDate,
      protein_g: 0, carbs_g: 0, fat_g: 0,
    }
    try {
      const r = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (r.ok) {
        setShowAddMeal(false)
        setAddMealName('')
        setAddMealCal('')
        loadMeals(user.id, mealsDate)
      }
    } catch (_) {}
  }

  // ── Main layout ─────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>
      <TopNav title="التغذية" user={user} />

      <div className="meals-container" style={{ paddingBlockEnd: 80 }}>

        {/* ── Top tab bar ───────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 8, padding: '12px 16px',
          backgroundColor: 'var(--surface)',
          borderBottom: '1px solid var(--accent-faint)',
        }}>
          {[{ key: 'recipes', label: '🍽️ وصفات' }, { key: 'nutrition', label: '📊 تغذيتي' }].map(({ key, label }) => {
            const isActive = activeTab === key
            return (
              <button key={key} onClick={() => setActiveTab(key)} style={{
                flex: 1, paddingBlock: 10, borderRadius: 24,
                textAlign: 'center', fontSize: 15, fontWeight: 600,
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
            TAB A — RECIPE BROWSER
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'recipes' && (
          <>
            {/* Recipe detail — renders in place so tab bar stays visible */}
            {selectedRecipe && (
              <RecipeDetail recipe={selectedRecipe} onBack={() => setSelectedRecipe(null)} />
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
                    {filtered.length} وصفة
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
                      style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-card)' }}>
                      <RecipeImg src={recipe.image_url} height={130} className="recipe-card-img" />
                      <div style={{ paddingInline: 10, paddingBlock: 8 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                          textAlign: 'right', fontFamily: F,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>{recipe.name}</div>
                        {recipe.cook_time && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right', fontFamily: F, marginBlockStart: 2 }}>
                            🕐 {recipe.cook_time}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {!recipesLoading && filtered.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', paddingBlock: 40, color: 'var(--text-secondary)', fontFamily: F }}>
                      <div style={{ fontSize: 40 }}>🔍</div>
                      <div style={{ fontSize: 16, marginBlockStart: 8 }}>لا توجد وصفات مطابقة</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-screen A1: Main browse */}
            {!selectedRecipe && !showAllRecipes && (
              <div>
                {/* Page header */}
                <div style={{ paddingBlock: 16, paddingInline: 16, textAlign: 'right' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', fontFamily: F }}>التغذية</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontFamily: F, marginBlockStart: 2 }}>غذّي أهدافك</div>
                </div>

                <SearchAndChips
                  search={search} onSearch={setSearch}
                  activeCategory={activeCategory} onCategory={setActiveCategory}
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
                            width: 150, minWidth: 150, height: 180, flexShrink: 0,
                            borderRadius: 16, backgroundColor: 'var(--accent-faint)',
                          }} />
                        ))
                      : recipes.slice(0, 8).map(recipe => (
                          <div key={recipe.id} className="recipe-card-hover"
                            onClick={() => setSelectedRecipe(recipe)}
                            style={{
                              width: 150, minWidth: 150, borderRadius: 16, overflow: 'hidden',
                              backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-card)', flexShrink: 0,
                            }}>
                            {recipe.image_url
                              ? <img src={recipe.image_url} alt="" className="recipe-card-img"
                                  style={{ width: 150, height: 110, objectFit: 'cover', display: 'block' }} />
                              : <div className="recipe-card-img" style={{
                                  width: 150, height: 110, backgroundColor: 'var(--accent-faint)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                                }}>🍽️</div>
                            }
                            <div style={{ paddingInline: 10, paddingBlock: 8 }}>
                              <div style={{
                                fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                                textAlign: 'right', fontFamily: F,
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                              }}>{recipe.name}</div>
                              {recipe.cook_time && (
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right', fontFamily: F, marginBlockStart: 2 }}>
                                  🕐 {recipe.cook_time}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                    }
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
                          style={{ borderRadius: 16, backgroundColor: 'var(--accent-faint)', height: 190 }} />
                      ))}
                    </div>
                  )}

                  {!recipesLoading && filtered.length === 0 && (
                    <div style={{ textAlign: 'center', paddingBlock: 40, color: 'var(--text-secondary)', fontFamily: F }}>
                      <div style={{ fontSize: 40 }}>🔍</div>
                      <div style={{ fontSize: 16, marginBlockStart: 8 }}>لا توجد وصفات مطابقة</div>
                    </div>
                  )}

                  {!recipesLoading && filtered.length > 0 && (
                    <div className="recipe-grid" style={{ paddingInline: 16, paddingBlockEnd: 16 }}>
                      {filtered.slice(0, 6).map(recipe => (
                        <div key={recipe.id} className="recipe-card-hover"
                          onClick={() => setSelectedRecipe(recipe)}
                          style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-card)' }}>
                          <RecipeImg src={recipe.image_url} height={130} className="recipe-card-img" />
                          <div style={{ paddingInline: 10, paddingBlock: 8 }}>
                            <div style={{
                              fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                              textAlign: 'right', fontFamily: F,
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            }}>{recipe.name}</div>
                            {recipe.cook_time && (
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right', fontFamily: F, marginBlockStart: 2 }}>
                                🕐 {recipe.cook_time}
                              </div>
                            )}
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
            TAB B — DAILY NUTRITION TRACKER
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'nutrition' && (
          <div>
            {/* Page header */}
            <div style={{ paddingBlock: 16, paddingInline: 16 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'right', fontFamily: F }}>تغذيتي</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'right', fontFamily: F, marginBlockStart: 2 }}>سجّلي وجباتك اليومية</div>
            </div>

            {/* Date navigator — RTL: < (first in DOM) appears on right = previous day */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, paddingBlock: 12 }}>
              <button
                onClick={() => setMealsDate(addDays(mealsDate, -1))}
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  border: '1px solid var(--accent-soft)', backgroundColor: 'var(--card)',
                  cursor: 'pointer', fontSize: 16, fontFamily: F,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-primary)',
                }}>
                &lt;
              </button>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: F, textAlign: 'center' }}>
                {new Date(mealsDate + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <button
                onClick={() => setMealsDate(addDays(mealsDate, 1))}
                disabled={!canGoNext}
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  border: '1px solid var(--accent-soft)', backgroundColor: 'var(--card)',
                  cursor: canGoNext ? 'pointer' : 'not-allowed',
                  fontSize: 16, fontFamily: F,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: canGoNext ? 1 : 0.3, color: 'var(--text-primary)',
                }}>
                &gt;
              </button>
            </div>

            {/* Skeleton */}
            {mealsLoading && [1, 2, 3].map(i => (
              <div key={i} className="skeleton"
                style={{ height: 80, borderRadius: 16, marginInline: 16, marginBlockEnd: 12, backgroundColor: 'var(--accent-faint)' }} />
            ))}

            {!mealsLoading && (
              <>
                {/* Daily summary card */}
                <div style={{
                  marginInline: 16, marginBlockEnd: 16, padding: 20,
                  backgroundColor: 'var(--card)', borderRadius: 20, boxShadow: 'var(--shadow-card)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <CalorieRing totalCal={totalCal} goalCal={goalCal} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: 4 }}>
                        <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, fontFamily: F }}>
                          {totalCal} / {goalCal}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: F }}>
                          السعرات اليوم
                        </span>
                      </div>
                      <div style={{
                        fontSize: 12, fontFamily: F, marginBlockEnd: 6, textAlign: 'right',
                        color: totalCal <= goalCal ? '#22C55E' : '#EF4444',
                      }}>
                        {totalCal <= goalCal
                          ? 'باقي ' + (goalCal - totalCal) + ' سعرة'
                          : 'تجاوزتِ الهدف بـ ' + (totalCal - goalCal)}
                      </div>
                      <MacroBar label="بروتين" value={totalProt}  goal={goalProt}  color="#3B82F6" />
                      <MacroBar label="كارب"   value={totalCarbs} goal={goalCarbs} color="#F59E0B" />
                      <MacroBar label="دهن"    value={totalFat}   goal={goalFat}   color="#8B5CF6" />
                    </div>
                  </div>
                </div>

                {/* Meal plan card */}
                <div style={{
                  marginInline: 16, marginBlockEnd: 16,
                  backgroundColor: 'var(--card)', borderRadius: 20,
                  boxShadow: 'var(--shadow-card)', overflow: 'hidden',
                }}>
                  <div style={{
                    paddingInline: 16, paddingBlock: 12,
                    borderBottom: '1px solid var(--accent-faint)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--accent)', fontFamily: F }}>
                      {mealPlan?.total_calories ? mealPlan.total_calories + ' سعرة' : ''}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: F }}>
                      🥗 خطة اليوم المقترحة
                    </span>
                  </div>

                  {!mealPlan && (
                    <div style={{ paddingInline: 16, paddingBlock: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, fontFamily: F }}>
                      جارٍ تحميل الخطة...
                    </div>
                  )}

                  {mealPlan?.plan && mealPlan.plan.map((item, i) => (
                    <div key={i} style={{
                      paddingInline: 16, paddingBlock: 10,
                      borderBottom: i < mealPlan.plan.length - 1 ? '1px solid var(--accent-faint)' : 'none',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 13, color: 'var(--accent)', fontFamily: F }}>
                        {item.actual_calories} سعرة
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: F }}>{item.meal_time}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: F }}>{item.food?.name_ar}</div>
                      </div>
                    </div>
                  ))}

                  {mealPlan?.tip && (
                    <div style={{
                      paddingInline: 16, paddingBlock: 12,
                      backgroundColor: 'var(--accent-faint)', borderRadius: '0 0 20px 20px',
                      fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right', fontFamily: F,
                    }}>
                      💡 {mealPlan.tip}
                    </div>
                  )}
                </div>

                {/* Meal type sections */}
                {MEAL_TYPES.map(({ id, label, emoji }) => {
                  const typeMeals = meals.filter(m => m.meal_type === id)
                  const typeTotal = typeMeals.reduce((s, m) => s + (m.total_calories || 0), 0)
                  return (
                    <div key={id} style={{
                      marginInline: 16, marginBlockEnd: 12,
                      backgroundColor: 'var(--card)', borderRadius: 16,
                      overflow: 'hidden', boxShadow: 'var(--shadow-card)',
                    }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        paddingInline: 16, paddingBlock: 12,
                        borderBottom: typeMeals.length ? '1px solid var(--accent-faint)' : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: F }}>
                            {typeTotal > 0 ? typeTotal + ' سعرة' : ''}
                          </span>
                          <button
                            onClick={() => { setShowAddMeal(true); setAddMealType(id) }}
                            style={{
                              width: 24, height: 24, borderRadius: 12,
                              backgroundColor: 'var(--accent)', color: '#FFFFFF',
                              fontSize: 16, border: 'none', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                            +
                          </button>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: F }}>
                          {emoji} {label}
                        </span>
                      </div>

                      {typeMeals.map((meal, i) => (
                        <div key={meal.id || i} style={{
                          paddingInline: 16, paddingBlock: 10,
                          borderBottom: i < typeMeals.length - 1 ? '1px solid var(--accent-faint)' : 'none',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: F }}>
                            {meal.total_calories} سعرة
                          </span>
                          <span style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: F, textAlign: 'right' }}>
                            {meal.meal_name}
                          </span>
                        </div>
                      ))}

                      {typeMeals.length === 0 && (
                        <div style={{ paddingInline: 16, paddingBlock: 12, textAlign: 'right' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: F, fontStyle: 'italic' }}>
                            أضيفي وجبة
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {/* Add meal modal */}
            {showAddMeal && (
              <div
                onClick={() => setShowAddMeal(false)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 100,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  display: 'flex', alignItems: 'flex-end',
                }}>
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    backgroundColor: 'var(--card)', borderRadius: '24px 24px 0 0',
                    padding: 24, width: '100%', maxWidth: 480, margin: '0 auto',
                  }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', fontFamily: F, marginBlockEnd: 16 }}>
                    أضيفي وجبة
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {MEAL_TYPES.map(type => (
                      <button key={type.id} onClick={() => setAddMealType(type.id)} style={{
                        paddingInline: 12, paddingBlock: 6, borderRadius: 16,
                        fontSize: 13, cursor: 'pointer', fontFamily: F, border: 'none',
                        backgroundColor: addMealType === type.id ? 'var(--accent)' : 'var(--accent-faint)',
                        color: addMealType === type.id ? '#FFFFFF' : 'var(--text-secondary)',
                      }}>
                        {type.emoji} {type.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginBlockStart: 16 }}>
                    <label style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right', display: 'block', marginBlockEnd: 4, fontFamily: F }}>
                      اسم الوجبة
                    </label>
                    <input
                      value={addMealName}
                      onChange={e => setAddMealName(e.target.value)}
                      style={{
                        width: '100%', padding: 12, borderRadius: 12,
                        border: '1px solid var(--accent-soft)',
                        backgroundColor: 'var(--surface)', textAlign: 'right',
                        fontSize: 14, color: 'var(--text-primary)', fontFamily: F,
                        boxSizing: 'border-box', outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ marginBlockStart: 12 }}>
                    <label style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right', display: 'block', marginBlockEnd: 4, fontFamily: F }}>
                      السعرات (تقريباً)
                    </label>
                    <input
                      type="number"
                      value={addMealCal}
                      onChange={e => setAddMealCal(e.target.value)}
                      style={{
                        width: '100%', padding: 12, borderRadius: 12,
                        border: '1px solid var(--accent-soft)',
                        backgroundColor: 'var(--surface)', textAlign: 'right',
                        fontSize: 14, color: 'var(--text-primary)', fontFamily: F,
                        boxSizing: 'border-box', outline: 'none',
                      }}
                    />
                  </div>

                  <button
                    onClick={handleAddMeal}
                    style={{
                      marginBlockStart: 20, width: '100%', padding: 14,
                      backgroundColor: 'var(--text-primary)', color: '#FFFFFF',
                      border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 600,
                      cursor: 'pointer', fontFamily: F,
                    }}>
                    إضافة ✓
                  </button>
                </div>
              </div>
            )}

            {/* FAB — only visible on nutrition tab */}
            <button
              onClick={() => { setShowAddMeal(true); setAddMealType('breakfast') }}
              style={{
                position: 'fixed', bottom: 70, insetInlineEnd: 16,
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: 'var(--accent)', color: '#FFFFFF',
                fontSize: 28, display: 'flex', alignItems: 'center',
                justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                cursor: 'pointer', border: 'none', zIndex: 50,
              }}>
              +
            </button>
          </div>
        )}

      </div>

      <BottomTabs active="meals" />
    </>
  )
}
