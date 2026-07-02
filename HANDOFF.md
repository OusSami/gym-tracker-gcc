# GYM Tracker GCC — Claude Handoff Document
**Last updated:** 2026-07-02  
**App version:** 5.6.21  
**Branch:** `main` — HEAD `7ed29da`

---

## 1. App Architecture

### Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 14 (Pages Router) |
| UI | React 18 — no component library, pure CSS |
| Styling | `styles/globals.css` — custom design system, zero Tailwind |
| Database | Supabase PostgreSQL (Auth + Storage + Realtime) |
| AI | Google Gemini 2.5 Flash (server-side only, never browser) |
| Charts | Recharts |
| PWA | Custom service worker `public/sw.js` |

### Routing (Pages Router)
```
pages/
  index.js          → workout logger (core hub, ~1200 lines)
  dashboard.js      → analytics + charts (~1700 lines)
  program.js        → AI training programs / packages (~1500 lines)
  meals.js          → nutrition tracker + recipe browser (~1600 lines)
  coach.js          → AI chat (full page)
  body.js           → body composition
  exercises.js      → exercise library
  weight.js         → weight history
  assessment.js     → health assessment
  onboarding.js     → first-run profile setup
  templates.js      → workout template builder
  packages.js       → subscription tiers
  settings.js       → user preferences
  landing.js        → public marketing page
  admin.js          → admin dashboard
  pending.js        → approval-pending screen
  suspended.js      → suspended account screen
  api/              → all server-side logic (Gemini calls, DB mutations)
```

### Auth & Status Gates
- Provider: Supabase Auth (email/password)
- `_app.js` gates every route by `profiles.status`:
  - `pending` → `/pending`
  - `suspended` → `/suspended`
  - `approved` or `ADMIN_EMAIL` match → full access
- Public routes: `/landing`, `/pending`, `/suspended`

### State Management
No Redux, no Context. Pattern: React hooks + `localStorage` + Supabase REST.

| Data | Storage |
|---|---|
| Active workout | React in-memory state |
| Draft workout recovery | `localStorage` key `gt_v5` |
| Chat history | `localStorage` key `gcc_chat_v4` (7-day TTL) + `chat_messages` table |
| User profile | Fetched once from `/api/profile` per session |
| Charts | Fetched per date range, no caching |

---

## 2. Design System — v3 Blush + Beige

**All styles live in `styles/globals.css`. No Tailwind. No CSS modules.**  
**Direction: RTL globally (`direction: rtl` on `html` and `body`).**

### Color Tokens
```css
--surface:        #F7F1EC   /* page bg — warm beige */
--card:           #FFFFFF   /* card backgrounds */
--surface-inset:  #F7E9DF   /* inset fills, soft cream */

--text-primary:   #3D2A1F   /* warm near-black */
--text-secondary: #8A6A4F   /* muted taupe */
--text-muted:     #B09070   /* lighter taupe */

--accent:         #D89B7A   /* primary terracotta */
--accent-soft:    #ECCDBA   /* light fill */
--accent-faint:   #F7E9DF   /* faintest fill */

--btn-primary-bg: #1A1A1A   /* dark pill button */
--btn-primary-fg: #FFFFFF

--macro-protein:  #3B82F6   /* blue */
--macro-carb:     #F59E0B   /* amber */
--macro-fat:      #8B5CF6   /* purple */
```

### Hard Rules — Never Break These
1. **RTL everywhere.** Never use `left`/`right` in CSS without mirroring. Use `start`/`end` or explicit RTL-aware values.
2. **No Tailwind** classes — all styling is inline styles or `globals.css` class names.
3. **No background gradients with dark text** — background is always light (`--surface`, `--card`). The old dark design (#09090B) is gone.
4. **Inline styles for dynamic/component-level values.** CSS classes for shared patterns (`.card`, `.btn`, `.tab-btn`).
5. **No hardcoded hex values in component files** — always use CSS variables.
6. **Gemini API key never in browser bundle.** All AI calls are server-side API routes only.
7. **No test files.** Manual QA only — do not add Jest/Vitest.
8. **Arabic-first copy.** All UI strings are Arabic. `lib/content.js` for gender-aware phrases.
9. **Commit + push after every change** (user preference, enforced).

### Fonts
- Arabic: Tajawal, Noto Kufi Arabic
- Numbers/English: DM Sans, Space Grotesk

### Component Classes (from globals.css)
`.card`, `.card-sm`, `.card-inset`, `.btn`, `.btn-ghost`, `.btn-sm`, `.tab-btn`

---

## 3. This Session — Completed Work (with Commit Hashes)

### 3.1 Recipe Database Expansion

**`65333fe`** — `data: add 25 GCC breakfast + 10 Gulf soup recipes`
- Script: `scripts/add_missing_recipes.mjs`
- Inserted 25 authentic فطور recipes + 10 شوربة recipes into `public.recipes`
- DB total went from ~358 → 393

**`980e8c6`** — `feat: generate and upload AI food images for all 35 manual recipes`
- Script: `scripts/generate_manual_recipe_images.mjs`
- Model: `gemini-3.1-flash-image` via `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent`
- Response format: `responseModalities: ["IMAGE", "TEXT"]`, returns base64 `inlineData`
- Pipeline: Gemini → sharp WebP (quality 82) → Supabase Storage `recipes` bucket → DB update
- Local copies saved to `public/recipe-images/manual-[id].webp`
- **CRITICAL: GEMINI_API_KEY must never be hardcoded** — reads from `.env`/`.env.local` at runtime. A previous attempt with a hardcoded key was blocked by GitHub push protection.

### 3.2 Sayidaty Breakfast Scraper Pipeline

**`0407aa6`** — `feat: Sayidaty breakfast scraper pipeline — 297 new recipes in DB`

Files created in `sayidaty-scraper/`:
- `breakfast_urls.txt` — 345 URLs from kitchen.sayidaty.net
- `scrape_breakfast.mjs` — Puppeteer scraper
- `clean_breakfast.mjs` — name/path cleanup
- `upload_breakfast_images.mjs` — WebP conversion + Supabase upload
- `import_breakfast.mjs` — upsert to DB with `category='فطور'`

**Key scraper architecture decisions:**
- Chrome path: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- puppeteer-core v25.1.0
- **Fresh `page` per recipe** (not reusing a single page) — fixes "Detached Frame" cascade failures
- **Browser restart every 80 recipes** — prevents memory leaks
- **Three ingredient extraction fallbacks:**
  1. `.ingredients-area li` (خطوة-بخطوة pages)
  2. `.ingredients-area p`
  3. `.ingredients-area` `innerText` split by `\n` (وصفات pages — BR-separated, no li/p tags)
- Resume-safe: reads existing JSON, skips already-scraped URLs
- Saves after every recipe

**Image storage naming:**
- Layalina batch: `layalina-0001.webp` → `layalina-XXXX.webp`
- Manual AI images: `manual-[uuid].webp`
- Breakfast batch: `recipe-0216.webp` → `recipe-0513.webp` (298 images)
- `sayidaty-scraper/data/image_url_map.json` — maps original filename → Supabase public URL (highest index: 215 at start of breakfast run)
- `sayidaty-scraper/data/breakfast_image_map.json` — breakfast-specific map (298 entries)

**Results:** 304 scraped (41 failed — connection timeouts), 297 inserted, 7 duplicate skips

### 3.3 Category Fixes

**`b70e380`** — `feat: fix breakfast category coverage — 28 recipes reassigned to فطور`
- Script: `scripts/fix_breakfast_categories.mjs`
- Also created: `scripts/analyze_breakfast_coverage.mjs` (read-only audit)
- 28 clear breakfast recipes (omelettes, tameez, pancakes, etc.) moved from wrong categories to فطور
- Excluded intentionally: أم علي بالتوست (dessert), فطيرة الفراولة (dessert)
- فطور count: 79 → 107

**`460dacd`** — `feat: reassign_all_categories.mjs — smarter category classification`
- Script: `scripts/reassign_all_categories.mjs`
- Uses **name + first 8 ingredients** (not name only)
- 14-priority rule chain (drinks → breakfast overrides → desserts → breakfast → soups → salads → appetizers → fish → chicken → meat → rice → gulf → breads → default)
- Key fix: **breakfast-specific overrides before desserts** to handle shared words (`مافن`, `وافل`, `بان كيك`)
- Egg compound patterns use `البيض ال/بال/م/ب` — avoids false match on `بيضاء` (white adjective)
- 135 + 46 = 181 total category changes across two runs
- أطباق خليجية category cleared (12 → 0) — recipes absorbed into correct parent categories

### 3.4 Meal Plan API Fixes

**`032978c`** — `fix: meal-plan calorie targeting — pick recipes within per-slot calorie band`
- File: `pages/api/packages/meal-plan.js`
- Added `MEAL_DISTRIBUTION` (فطور 25%, غداء 35%, خفيفة 15%, عشاء 25%)
- Queries recipes within ±30% of target → ±50% → any (3-tier fallback)
- Resolves `dailyGoal` from `profile.calorie_target` → `calcNutrientGoals()` → 2000 default
- Maps profile `goal: 'weight'` → nutrition lib `'weight_loss'` (−500 kcal deficit)
- Response adds `daily_goal` and `target_breakdown` fields
- Live sample: 3619 cal vs 3585 goal (Δ +34, < 1%)

**`7ed29da`** — `fix: meal-plan — guarantee required meals never skipped (5-tier fallback)`
- File: `pages/api/packages/meal-plan.js`
- Replaced `MEAL_CATEGORY_MAP + MEAL_ORDER` with `MEAL_STRUCTURE` array
- Each entry: `{ time, pct, required, categories }`
- الفطور / الغداء / العشاء: `required: true` — NEVER skipped
- وجبة خفيفة: `required: false` — skipped if no candidates
- 5-tier fallback per slot:
  1. ±30% in rotated primary category
  2. ±50% in rotated primary category
  3. Any calories in rotated primary category
  4. ±50% across ALL categories for this meal
  5. Absolute emergency: any recipe with calories > 0
- Post-loop validation: if any required meal still missing, emergency query with `.limit(10)`
- `console.log('[meal-plan] Plan meals:', ...)` added for server-side debugging
- `queryRecipes()` now accepts string or array of categories

---

## 4. Database State

### `public.recipes` — 690 rows

**Schema:**
```
id                    UUID (PK)
name                  text
image_url             text          ← Supabase Storage public URL or CDN URL
cook_time             text
servings              text
ingredients           text[]
steps                 text[]
source                text          ← 'layalina' | 'sayidaty' | 'manual'
category              text          ← see distribution below
calories              integer       ← per serving
protein_g             float
carbs_g               float
fat_g                 float
fiber_g               float
cal_per_100g          float
protein_per_100g      float
carbs_per_100g        float
fat_per_100g          float
nutrition_estimated_at timestamp
created_at            timestamp
```

**Category distribution (live, 2026-07-02):**
```
لحم                    146
فطور                   117
دجاج                    88
أخرى                    86   ← needs further work (see §6)
سلطة                    59
سمك ومأكولات بحرية      55
مقبلات                  43
أرز ومجبوس              34
شوربة                   29
حلويات                  22
مشروبات                  6
خبز ومعجنات              5
```

**Coverage:**
- With `image_url`: 690/690 (100%)
- With `calories`: 690/690 (100%)
- With `ingredients`: 690/690 (100%)

**Note:** ~41 breakfast recipes still have raw Sayidaty CDN URLs (not Supabase Storage). These are the failed scrapes from the batch that timed out — the images were downloaded from Sayidaty directly rather than going through the WebP conversion + upload pipeline.

### Supabase Storage Bucket: `recipes`
- `layalina-0001.webp` → `layalina-XXXX.webp` (Layalina scraper batch)
- `manual-[uuid].webp` (AI-generated images for 35 manual recipes)
- `recipe-0216.webp` → `recipe-0513.webp` (breakfast batch — 298 images)
- Public URL format: `https://jwhetqqlbkggojjvxhch.supabase.co/storage/v1/object/public/recipes/{filename}`

### Other Tables
See `CLAUDE.md` §Data Models for full schemas: `profiles`, `sessions`, `exercises`, `sets`, `meals`, `water_logs`, `programs`, `program_days`, `chat_messages`.

---

## 5. Key Files Modified This Session

### API
| File | Change |
|---|---|
| `pages/api/packages/meal-plan.js` | Full rewrite — MEAL_STRUCTURE, calorie targeting, 5-tier fallback, required-meal guarantee |

### Scripts (all in `scripts/`)
| File | Purpose |
|---|---|
| `add_missing_recipes.mjs` | Insert 35 manual Gulf recipes (25 فطور + 10 شوربة) |
| `generate_manual_recipe_images.mjs` | AI image generation for manual recipes via Gemini |
| `analyze_breakfast_coverage.mjs` | Read-only audit — finds miscategorized breakfast recipes |
| `fix_breakfast_categories.mjs` | Updates 28 recipes to فطور (excludes 2 confirmed desserts) |
| `reassign_all_categories.mjs` | Full re-categorisation using name + ingredients, 14-priority chain |

### Scraper (all in `sayidaty-scraper/`)
| File | Purpose |
|---|---|
| `breakfast_urls.txt` | 345 sayidaty.net recipe URLs |
| `scrape_breakfast.mjs` | Puppeteer scraper — fresh page/recipe + browser restart/80 |
| `clean_breakfast.mjs` | Strips name suffixes, normalises image paths, deduplicates names |
| `upload_breakfast_images.mjs` | WebP conversion + Supabase upload, continues from recipe-0215 |
| `import_breakfast.mjs` | Upsert to DB, forces category='فطور', skips duplicates by name |

---

## 6. Pending Tasks (Priority Order)

### HIGH — Functional bugs

1. **41 breakfast recipes with raw CDN image URLs**
   - These recipes have `image_url` pointing to `media.sayidaty.net` CDN (not Supabase Storage)
   - They're the 41 that timed out during the scrape (connection closed)
   - Fix: query `WHERE image_url LIKE '%sayidaty%' OR image_url LIKE '%media%'`, download → convert WebP → upload → update
   - Or: just re-run `scrape_breakfast.mjs` (it's resume-safe) to retry the 41 failures

2. **86 recipes in `أخرى` category**
   - These are recipes with no Arabic keyword anchor — fusion dishes, generic names, unusual Gulf dishes
   - Sample: المعدس الكويتي, كيشة القمح السعودية, مطبق زبيدي, العريكة السعودية, القشد الملكي
   - Many of these are genuine Gulf dishes that need a revived `أطباق خليجية` category
   - Fix: Add Gulf-specific keywords to `reassign_all_categories.mjs` (or manual pass)
   - Consider: restaurant the `أطباق خليجية` category for dishes like هريس, مطازيز, عريكة, عصيد, قشد, كيشة

3. **`وجبة خفيفة` sometimes picks soups or heavy dishes via الحلويات category**
   - Some recipes in حلويات are ≥800 cal — too heavy for a snack slot
   - Calorie targeting should handle this (snack target ≈ 15% of goal) but worth monitoring

### MEDIUM — Data quality

4. **`مقبلات` category includes recipes that are meal-level dishes** (e.g. hummus with meat)
   - Fine for now, but a future pass could split into `مقبلات` vs `أطباق جانبية`

5. **`مشروبات` only has 6 recipes** — very sparse for that category
   - The smoothies and drinks got narrowed to avoid false positives
   - Consider: add more drink recipes from a dedicated scrape

6. **Nutrition accuracy for complex dishes**
   - `estimate_nutrition.mjs` uses ingredient-parsing heuristics, not a real nutrition DB
   - Some dishes (e.g. كبسة الروبيان) show 892–1200 cal — plausible but unverified
   - For a production release, consider integrating a real USDA/Open Food Facts API

### LOW — Enhancement

7. **`خطة اليوم` (7-day meal plan in meals.js)** calls `/api/packages/meal-plan` — now fixed with calorie targeting. Verify the UI shows the `daily_goal` and `target_breakdown` fields correctly.

8. **Recipe favorites** (`feat: add recipe favorites with heart button`) — favorites table exists (`scripts/create_favorites_table.sql`). Confirm the table was applied in Supabase.

9. **Barcode lookup UI** is hidden (`{false && <BarcodeUI />}` in add-meal modal). Re-enable when barcode scanning is tested.

10. **`meals_backup` page** shows in build output — dead code that can be deleted.

---

## 7. Known Issues / Gotchas

### Scraper
- **Sayidaty URL formats:** Two distinct page layouts exist:
  - `/خطوة-بخطوة/` pages: ingredients in `<li>` tags inside `.ingredients-area`
  - `/وصفات/` pages: ingredients as BR-separated plaintext inside `.ingredients-area` div (no li/p)
- Always use the **three-fallback extraction** (li → p → innerText.split('\n')) or you get 0 ingredients
- **Detached Frame error:** caused by reusing a single Puppeteer `page` object across many URLs. Solution: fresh `browser.newPage()` per recipe, close in `finally`.

### Category Assignment
- **`بيض` as bare substring matches `بيضاء`** (white, adjective). In `reassign_all_categories.mjs` we use compound patterns (`البيض ال`, `البيض بال`, etc.) instead of bare `بيض`.
- **`مافن` appears in both desserts and breakfast** — the script has a "breakfast override" block that runs before desserts specifically for `مافن بيض` / `مافن البيض`.
- **`أطباق خليجية` is currently empty (0 recipes)** after `reassign_all_categories.mjs` moved everything to parent categories. The meal-plan API still lists `أطباق خليجية` as a lunch category — this means the Tier 1 rotation will sometimes land on that category and fall through to Tier 3/4. This is safe but slightly inefficient.

### Gemini Image Generation
- Model ID: `gemini-3.1-flash-image` (not `gemini-2.5-flash`)
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent`
- Request body needs: `responseModalities: ["IMAGE", "TEXT"]`
- Response: `candidates[0].content.parts[].inlineData.data` (base64)
- **NEVER hardcode the API key** — GitHub push protection will block the push and flag the key as compromised

### Meal Plan API
- `calcNutrientGoals()` from `lib/nutrition.js` expects `goal` to be `'weight_loss'` not `'weight'` — the profile stores `'weight'`. The API does `GOAL_MAP[profile.goal]` to convert. Don't remove this mapping.
- `seed = Math.floor(Date.now() / 86400000)` changes daily, so the same `day=N` param gives different recipes each calendar day. This is intentional.

### Design System
- **Old dark tokens** (`--bg: #09090B`, `--primary: #CBA23B`) are referenced in some older inline styles. CLAUDE.md mentions them but they've been replaced. If you see these in code, replace with the v3 Blush+Beige tokens.
- **`pages/meals_new.js` was deleted** in a previous session — build output shows `meals_backup` instead. Both are dead code.

---

## 8. Script Infrastructure Reference

All scripts in `scripts/` follow this pattern for credentials:
```javascript
function readEnv(filePath) {
  const env = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}
const env    = readEnv(path.join(__dirname, '..', '.env.local'))
const SB_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SB_KEY = env['SUPABASE_SERVICE_ROLE_KEY']
```

GEMINI_API_KEY is read from `.env` first, then `.env.local`:
```javascript
function readGeminiKey() {
  for (const f of ['.env', '.env.local']) {
    // read file, match GEMINI_API_KEY=...
  }
}
```

**Key scripts and what they do:**
```
scripts/
  add_missing_recipes.mjs          Insert manual recipes (checks for existing name first)
  generate_manual_recipe_images.mjs AI image gen for source='manual' recipes
  assign_categories.mjs            Old keyword-only categoriser (deprecated — use reassign_all)
  reassign_all_categories.mjs      Current categoriser — name + 8 ingredients, 14-priority chain
  analyze_breakfast_coverage.mjs   Read-only audit for فطور coverage
  fix_breakfast_categories.mjs     One-off fix for 28 miscategorised breakfast recipes
  estimate_nutrition.mjs           Heuristic calorie/macro estimation from ingredients
  audit_recipe_nutrition.mjs       Audit nutrition data quality
  audit_recipe_quality.mjs         General data quality audit
```

**Scraper pipeline (sayidaty-scraper/):**
```
1. scrape_breakfast.mjs    → data/new_batch_recipes.json + data/new_batch_images/
2. clean_breakfast.mjs     → data/new_batch_clean.json
3. upload_breakfast_images.mjs → Supabase Storage + data/breakfast_image_map.json
4. import_breakfast.mjs    → public.recipes (upsert, forces category='فطور')
5. scripts/assign_categories.mjs   (or reassign_all_categories.mjs)
6. scripts/estimate_nutrition.mjs
```

---

## 9. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL        = https://jwhetqqlbkggojjvxhch.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJ...
SUPABASE_SERVICE_ROLE_KEY       = eyJ...   ← used by all scripts + server API routes
ADMIN_EMAIL                     = rholam8oussama@gmail.com
NEXT_PUBLIC_ADMIN_EMAIL         = rholam8oussama@gmail.com
GEMINI_API_KEY                  = (in .env — never commit)
```

---

## 10. Build & Deploy

```bash
npm run build    # Next.js production build — must pass before committing
git add <specific files>    # never git add -A (risk of committing .env)
git commit -m "..."
git push origin main
```

Remote: `https://github.com/OusSami/gym-tracker-gcc.git`

The last clean build (2026-07-02) compiled 23 static pages + all API routes with 0 errors.

---

## 11. Commit History — This Session

| Hash | Description |
|---|---|
| `7ed29da` | fix: meal-plan — guarantee required meals never skipped (5-tier fallback) |
| `460dacd` | feat: reassign_all_categories.mjs — smarter category classification for all 690 recipes |
| `032978c` | fix: meal-plan calorie targeting — pick recipes within per-slot calorie band |
| `b70e380` | feat: fix breakfast category coverage — 28 recipes reassigned to فطور |
| `0407aa6` | feat: Sayidaty breakfast scraper pipeline — 297 new recipes in DB |
| `980e8c6` | feat: generate and upload AI food images for all 35 manual recipes |
| `65333fe` | data: add 25 GCC breakfast + 10 Gulf soup recipes to public.recipes |
| `ce525d7` | chore: add analyze_meal_coverage_v2.mjs |
| `e2c484c` | chore: add delete_stuck_duplicates.mjs |
| `946888b` | chore: add deep_clean_video_refs.mjs |
| `3d99821` | chore: add delete_duplicate_recipes.mjs |
| `ef6ac3f` | chore: add clean_recipe_names.mjs |
| `67caef5` | feat(meals): switch خطة اليوم to pull from public.recipes with images |

**Prior sessions (relevant context):**
| Hash | Description |
|---|---|
| `50129a5` | fix(meals): per-day unique meal plans in خطة اليوم |
| `74ca795` | feat(meals): tappable meal rows in خطة اليوم open recipe detail |
| `889dd5f` | feat: log program meals in one tap + add recipe to meal from detail view |
| `b2e1e2a` | feat: smart recipe search — name + ingredients + category with scoring |
| `012be28` | feat(recipes): add recipe favorites with heart button |
| `7650628` | feat(meals): replace day meal plan with 7-day week plan view |
| `faf3191` | feat: rewrite recipe nutrition estimator v2 with ingredient-quantity parsing |
| `897829e` | feat(recipes): add category column + assign 370 recipes + update filter UI |
