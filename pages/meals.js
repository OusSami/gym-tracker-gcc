import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { TopNav, BottomTabs } from '../components/Nav'

// ── Category filter config ──────────────────────────────────────────────────
const CATEGORIES = [
  { label: 'الكل',   match: null },
  { label: 'رئيسي', match: ['كبسة','مجبوس','برياني','دجاج','لحم','سمك','أرز'] },
  { label: 'حلوى',  match: ['حلوى','كيك','تمر','لقيمات','عيش','بسبوسة'] },
  { label: 'شوربة', match: ['شوربة','حساء'] },
  { label: 'سلطة',  match: ['سلطة'] },
  { label: 'فطور',  match: ['فطور','بيض','خبز','فول'] },
]

function categoryMatch(recipe, cat) {
  if (!cat.match) return true
  return cat.match.some(kw => recipe.name.includes(kw))
}

// ── Skeleton card ──────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      backgroundColor: 'var(--accent-faint)',
      aspectRatio: '4/3',
      animation: 'pulse 1.4s ease-in-out infinite',
    }} />
  )
}

// ── Recipe image cell ──────────────────────────────────────────────────────
function RecipeImage({ src, style }) {
  if (!src) {
    return (
      <div style={{ ...style, backgroundColor: 'var(--accent-faint)' }} />
    )
  }
  return <img src={src} alt="" style={{ ...style, objectFit: 'cover' }} />
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN 2 — Recipe Detail
// ══════════════════════════════════════════════════════════════════════════
function RecipeDetail({ recipe, onBack }) {
  const [activeTab, setActiveTab] = useState('ingredients')

  return (
    <div style={{ direction: 'rtl', minHeight: '100vh', backgroundColor: 'var(--surface)' }}>
      {/* 1. Hero image */}
      <div style={{ position: 'relative', height: 280, width: '100%' }}>
        <RecipeImage
          src={recipe.image_url}
          style={{ width: '100%', height: '100%', objectPosition: 'center', display: 'block' }}
        />
        {/* Dark scrim */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%)',
        }} />
        {/* Back button — top-right in RTL */}
        <button
          onClick={onBack}
          style={{
            position: 'absolute', top: 16, insetInlineEnd: 16,
            backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '50%',
            width: 36, height: 36, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFFFFF', fontSize: 18,
          }}
        >
          →
        </button>
        {/* Recipe name overlaid */}
        <div style={{
          position: 'absolute', bottom: 16,
          insetInlineEnd: 16, insetInlineStart: 16,
          fontSize: 22, fontWeight: 700, color: '#FFFFFF', textAlign: 'right',
        }}>
          {recipe.name}
        </div>
      </div>

      {/* 2. Action row */}
      <div style={{
        backgroundColor: 'var(--card)',
        paddingBlock: 16, paddingInline: 24,
        display: 'flex', flexDirection: 'row', justifyContent: 'space-around',
      }}>
        {[
          { icon: '❤️', label: 'المفضلة' },
          { icon: '📅', label: 'تخطيط' },
          { icon: '🔗', label: 'مشاركة' },
        ].map(({ icon, label }) => (
          <button
            key={label}
            onClick={() => console.log(label)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'Tajawal',sans-serif" }}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* 3. Meta row */}
      {(recipe.cook_time || recipe.servings) && (
        <div style={{
          paddingInline: 16, paddingBlock: 12,
          display: 'flex', flexDirection: 'row', gap: 16, justifyContent: 'flex-end',
        }}>
          {recipe.cook_time && (
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'Tajawal',sans-serif" }}>
              🕐 {recipe.cook_time}
            </span>
          )}
          {recipe.servings && (
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'Tajawal',sans-serif" }}>
              👥 {recipe.servings}
            </span>
          )}
        </div>
      )}

      {/* 4. Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--accent-faint)',
        marginInline: 16,
      }}>
        {[
          { key: 'ingredients', label: 'المكونات' },
          { key: 'steps',       label: 'طريقة التحضير' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              flex: 1, paddingBlock: 12, textAlign: 'center',
              fontSize: 14, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === key ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === key ? '2px solid var(--text-primary)' : '2px solid transparent',
              fontFamily: "'Tajawal',sans-serif",
              transition: 'color .15s, border-color .15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 5. Tab content */}
      <div style={{ paddingInline: 16, paddingBlockStart: 16, paddingBlockEnd: 100 }}>
        {/* المكونات */}
        {activeTab === 'ingredients' && (
          <div>
            {(recipe.ingredients ?? []).map((ing, i) => (
              <div
                key={i}
                style={{
                  paddingBlock: 10,
                  borderBottom: '1px solid var(--accent-faint)',
                  display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                }}
              >
                <span style={{
                  fontSize: 14, color: 'var(--text-primary)', textAlign: 'right',
                  fontFamily: "'Tajawal',sans-serif", flex: 1,
                }}>
                  {ing}
                </span>
                <span style={{
                  width: 6, height: 6, borderRadius: 3,
                  backgroundColor: 'var(--accent)',
                  marginInlineStart: 8, flexShrink: 0, alignSelf: 'center',
                  display: 'inline-block',
                }} />
              </div>
            ))}
          </div>
        )}

        {/* طريقة التحضير */}
        {activeTab === 'steps' && (
          <div>
            {(recipe.steps ?? []).map((step, i) => (
              <div
                key={i}
                style={{
                  marginBlockEnd: 12, padding: 14,
                  backgroundColor: 'var(--card)',
                  borderRadius: 12, boxShadow: 'var(--shadow-card)',
                  display: 'flex', flexDirection: 'row-reverse',
                  alignItems: 'flex-start',
                }}
              >
                {/* Step number badge on right */}
                <span style={{
                  width: 24, height: 24, borderRadius: 12,
                  backgroundColor: 'var(--accent)', color: '#FFFFFF',
                  fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginInlineStart: 10, flexShrink: 0, alignSelf: 'flex-start',
                }}>
                  {i + 1}
                </span>
                <span style={{
                  fontSize: 14, color: 'var(--text-primary)',
                  textAlign: 'right', lineHeight: 1.6, flex: 1,
                  fontFamily: "'Tajawal',sans-serif",
                }}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN 1 — Main nutrition page
// ══════════════════════════════════════════════════════════════════════════
export default function Meals() {
  const router = useRouter()
  const [user, setUser]                   = useState(null)
  const [recipes, setRecipes]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [activeCategory, setActiveCategory] = useState('الكل')
  const [selectedRecipe, setSelectedRecipe] = useState(null)

  // ── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.push('/'); return }
      setUser(session.user)
    })
  }, [])

  // ── Fetch recipes ────────────────────────────────────────────────────────
  const loadRecipes = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('id,name,image_url,cook_time,servings,ingredients,steps')
        .order('name', { ascending: true })
      if (!error && data) setRecipes(data)
    } catch (_) {}
    setLoading(false)
  }, [])

  useEffect(() => { loadRecipes() }, [loadRecipes])

  // ── Derived filtered list ────────────────────────────────────────────────
  const activeCat = CATEGORIES.find(c => c.label === activeCategory) ?? CATEGORIES[0]
  const filtered = recipes.filter(r => {
    const catOk = categoryMatch(r, activeCat)
    const searchOk = !search.trim() || r.name.includes(search.trim())
    return catOk && searchOk
  })

  // ── If a recipe is selected, show detail screen ─────────────────────────
  if (selectedRecipe) {
    return (
      <>
        <style>{`
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        `}</style>
        <RecipeDetail recipe={selectedRecipe} onBack={() => setSelectedRecipe(null)} />
        <BottomTabs />
      </>
    )
  }

  // ── Main screen ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .recipe-chip { transition: background .15s, color .15s; }
        .recipe-card { cursor: pointer; transition: transform .15s, box-shadow .15s; }
        .recipe-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(168,120,90,0.18); }
        .chips-scroll::-webkit-scrollbar { display:none; }
        .chips-scroll { scrollbar-width:none; }
        .horiz-scroll::-webkit-scrollbar { display:none; }
        .horiz-scroll { scrollbar-width:none; }
      `}</style>

      <TopNav title="التغذية" user={user} />

      <div style={{ direction: 'rtl', backgroundColor: 'var(--surface)', minHeight: '100vh', paddingBlockEnd: 100 }}>

        {/* 1. Page header */}
        <div style={{
          backgroundColor: 'var(--surface)',
          paddingBlock: 16, paddingInline: 16,
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', fontFamily: "'Tajawal',sans-serif" }}>
            التغذية
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'right', fontFamily: "'Tajawal',sans-serif", marginBlockStart: 2 }}>
            غذّي أهدافك
          </div>
        </div>

        {/* 2. Search bar */}
        <div style={{ marginInline: 16, marginBlockEnd: 12 }}>
          <div style={{
            backgroundColor: '#1A1A1A', borderRadius: 30,
            paddingInline: 16, paddingBlock: 12,
            display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8,
          }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحثي عن وصفة"
              style={{
                flex: 1, color: '#FFFFFF', backgroundColor: 'transparent',
                border: 'none', outline: 'none', textAlign: 'right',
                fontSize: 14, fontFamily: "'Tajawal',sans-serif",
              }}
            />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, flexShrink: 0 }}>🔍</span>
          </div>
        </div>

        {/* 3. Category filter chips */}
        <div
          className="chips-scroll"
          style={{
            display: 'flex', flexDirection: 'row', overflowX: 'auto',
            paddingInline: 16, gap: 8, marginBlockEnd: 16,
          }}
        >
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat.label
            return (
              <button
                key={cat.label}
                className="recipe-chip"
                onClick={() => setActiveCategory(cat.label)}
                style={{
                  paddingInline: 16, paddingBlock: 8, borderRadius: 20,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                  fontFamily: "'Tajawal',sans-serif",
                  backgroundColor: active ? 'var(--text-primary)' : 'var(--card)',
                  color: active ? '#FFFFFF' : 'var(--text-secondary)',
                  border: active ? 'none' : '1px solid var(--accent-soft)',
                }}
              >
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* 4. "وصفات جديدة" horizontal scroll section */}
        <div style={{ marginBlockEnd: 24 }}>
          <div style={{
            fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
            paddingInline: 16, marginBlockEnd: 12, textAlign: 'right',
            fontFamily: "'Tajawal',sans-serif",
          }}>
            وصفات جديدة
          </div>
          <div
            className="horiz-scroll"
            style={{
              display: 'flex', flexDirection: 'row', overflowX: 'auto',
              paddingInline: 16, gap: 12,
            }}
          >
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{
                    width: 160, minWidth: 160, height: 180,
                    borderRadius: 16, backgroundColor: 'var(--accent-faint)',
                    animation: 'pulse 1.4s ease-in-out infinite', flexShrink: 0,
                  }} />
                ))
              : recipes.slice(0, 8).map(recipe => (
                  <div
                    key={recipe.id}
                    className="recipe-card"
                    onClick={() => setSelectedRecipe(recipe)}
                    style={{
                      width: 160, minWidth: 160, borderRadius: 16, overflow: 'hidden',
                      backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-card)',
                      flexShrink: 0,
                    }}
                  >
                    <RecipeImage
                      src={recipe.image_url}
                      style={{ width: 160, height: 120, display: 'block' }}
                    />
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                      paddingInline: 10, paddingBlockStart: 8, textAlign: 'right',
                      fontFamily: "'Tajawal',sans-serif",
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {recipe.name}
                    </div>
                    {recipe.cook_time && (
                      <div style={{
                        fontSize: 11, color: 'var(--text-secondary)',
                        paddingInline: 10, paddingBlockEnd: 10, textAlign: 'right',
                        fontFamily: "'Tajawal',sans-serif",
                      }}>
                        🕐 {recipe.cook_time}
                      </div>
                    )}
                  </div>
                ))
            }
          </div>
        </div>

        {/* 5. "كل الوصفات" grid section */}
        <div>
          {/* Section header */}
          <div style={{
            display: 'flex', flexDirection: 'row',
            alignItems: 'center', justifyContent: 'space-between',
            paddingInline: 16, marginBlockEnd: 12,
          }}>
            <span style={{
              fontSize: 13, color: 'var(--accent)', cursor: 'pointer',
              fontFamily: "'Tajawal',sans-serif",
            }}>
              عرض الكل ←
            </span>
            <span style={{
              fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
              fontFamily: "'Tajawal',sans-serif",
            }}>
              كل الوصفات
            </span>
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingInline: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingInline: 16 }}>
              {filtered.map(recipe => (
                <div
                  key={recipe.id}
                  className="recipe-card"
                  onClick={() => setSelectedRecipe(recipe)}
                  style={{
                    borderRadius: 16, overflow: 'hidden',
                    backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <RecipeImage
                    src={recipe.image_url}
                    style={{ width: '100%', aspectRatio: '4/3', display: 'block' }}
                  />
                  <div style={{ paddingInline: 10, paddingBlock: 8 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                      textAlign: 'right', fontFamily: "'Tajawal',sans-serif",
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {recipe.name}
                    </div>
                    {recipe.cook_time && (
                      <div style={{
                        fontSize: 11, color: 'var(--text-secondary)',
                        textAlign: 'right', fontFamily: "'Tajawal',sans-serif",
                        marginBlockStart: 4,
                      }}>
                        🕐 {recipe.cook_time}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Empty state */}
              {filtered.length === 0 && (
                <div style={{
                  gridColumn: '1 / -1', textAlign: 'center',
                  paddingBlock: 40, color: 'var(--text-secondary)',
                  fontSize: 14, fontFamily: "'Tajawal',sans-serif",
                }}>
                  لا توجد وصفات مطابقة
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomTabs />
    </>
  )
}
