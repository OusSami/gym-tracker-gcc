# CLAUDE.md — GYM Tracker GCC

## Overview

Production-grade fitness SaaS PWA targeting Arabic Gulf users. Full RTL Arabic UI, AI-powered workout/nutrition analysis, and health-aware program adaptation. Version **5.6.21**, actively developed.

**Stack**: Next.js 14 · React 18 · Supabase (Postgres + Auth + Storage) · Google Gemini 2.5 Flash · Recharts · Custom CSS design system

---

## Project Structure

```
gymapp/
├── pages/
│   ├── _app.js               # Root layout, auth gate, ErrorBoundary, PWA
│   ├── index.js              # Workout logger — the app's core hub
│   ├── dashboard.js          # Analytics, charts, session editing
│   ├── program.js            # AI training programs (packages)
│   ├── meals.js              # Nutrition tracker
│   ├── coach.js              # AI coaching chat (full-page)
│   ├── body.js               # Body composition & analysis
│   ├── exercises.js          # Exercise library browse
│   ├── weight.js             # Weight history
│   ├── assessment.js         # Health assessment
│   ├── onboarding.js         # Initial profile setup
│   ├── templates.js          # Workout template builder
│   ├── packages.js           # Subscription tiers
│   ├── settings.js           # User preferences
│   ├── landing.js            # Public marketing page
│   ├── admin.js              # Admin dashboard
│   ├── pending.js            # Approval pending screen
│   ├── suspended.js          # Suspended account screen
│   └── api/                  # Next.js API routes (server-side)
│       ├── sessions.js
│       ├── meals.js
│       ├── profile.js
│       ├── weight.js
│       ├── body.js
│       ├── analyze.js        # Exercise AI (Gemini, image/text)
│       ├── coach.js          # Coach chat endpoint (Gemini)
│       ├── meal-analyze.js   # Nutrition AI (Gemini)
│       ├── meal-report.js
│       ├── session-report.js
│       ├── analysis-report.js
│       ├── weekly-summary.js
│       ├── admin.js
│       ├── chat-history.js
│       ├── barcode.js
│       ├── templates.js
│       ├── custom-meals.js
│       ├── gcc-foods.js
│       ├── session-exercise.js
│       ├── session-set.js
│       ├── session-draft.js
│       ├── sessions-merge.js
│       └── packages/
│           ├── status.js
│           ├── generate.js
│           ├── daily.js
│           ├── days.js
│           ├── checkin.js
│           ├── day-report.js
│           ├── meal-plan.js
│           ├── analyze-reason.js
│           └── start-session.js
├── components/
│   ├── Nav.js                # Top navbar + bottom tab bar
│   └── ChatWidget.js         # Floating AI chat widget
├── lib/
│   ├── supabase.js           # Supabase client + service-role client
│   ├── muscles.js            # Muscle taxonomy, aliases → canonical names
│   ├── nutrition.js          # Mifflin-St Jeor BMR, TDEE, macro targets
│   ├── bodyFat.js            # US Navy body fat formula
│   ├── adaptEngine.js        # Adaptive program intensity logic
│   ├── content.js            # Gender-aware Arabic phrases
│   ├── features.js           # Feature flags (free / premium / coming_soon)
│   ├── exercise-data.js      # Exercise library data (55KB)
│   └── logApiUsage.js        # Rate limiting & API usage tracking
├── styles/
│   └── globals.css           # Design system tokens + component classes
├── public/
│   └── sw.js                 # Service worker (PWA)
├── migrations/               # SQL migration files (Supabase)
└── .env.example
```

---

## Core Pages

### `pages/index.js` — Workout Logger
The central hub. Users flow through a state machine:

```
AUTH → HOME → WARMUP → EXERCISES → STRETCH → DONE
```

Key capabilities:
- Real-time session creation in Supabase (row created before first exercise)
- AI exercise recognition via Gemini (image or text input)
- Per-set tracking: weight, reps, duration, rest timer
- Auto-select muscle groups from trained muscles
- Draft persistence: `localStorage` key `gt_v5` + Supabase draft endpoint
- Warmup/stretch guided sequences with timers
- Quick-pick from recent exercises

### `pages/dashboard.js` — Analytics
- Recharts visualizations: Line, Bar, Area, Radar
- Volume charts (weight × reps × sets over time)
- Strength progression (max weight per exercise)
- Muscle heatmap (volume by muscle group)
- Weekly / Monthly / Quarterly / Yearly + custom date ranges
- Continue/merge/edit past sessions from here

### `pages/program.js` — AI Training Programs (Premium)
Packages: Foundations (21d), Fat Loss (30d), Muscle Build (21d), Strength (21d), Endurance (21d)
- AI-generated daily workouts via Gemini
- Adaptive adjustment: compliance % + missed days → intensity change
- Daily check-in (complete / incomplete + reason)
- AI-generated meal plan per day
- Health-condition-aware modifications

### `pages/meals.js` — Nutrition Tracker
- AI meal analysis via Gemini (photo or text)
- GCC food database for Middle Eastern meals
- Custom meals (user-saved recipes)
- Barcode lookup
- Daily macro/micro totals + water logging
- Health score 0–10 per meal

### `pages/coach.js` + `components/ChatWidget.js`
- Context-aware: `meals | program | progress | default`
- 20 messages/day rate limit
- Persistent: localStorage `gcc_chat_v4` (7-day TTL) + Supabase
- Arabic Gulf dialect responses

---

## Data Models (Supabase PostgreSQL)

### `profiles`
```
id                UUID (PK, = auth.users.id)
unit_system       'metric' | 'imperial'
fitness_level     'مبتدئ' | 'متوسط' | 'متقدم'
goal              'muscle' | 'weight' | 'strength' | 'endurance' | 'general'
weight_kg         float
height_cm         int
birthday          date
sex               'male' | 'female'
body_fat_pct      float
waist_cm          int
hips_cm           int
neck_cm           int
lean_mass_kg      float
fat_mass_kg       float
calorie_target    int
status            'pending' | 'approved' | 'suspended'
onboarded         boolean
health_conditions array  -- knee_pain, back_pain, diabetes, etc.
days_per_week     int
equipment         array
sleep_hours       float
```

### `sessions`
```
id                    UUID
user_id               UUID
session_date          date (YYYY-MM-DD)
duration_seconds      int
muscles_trained       array
warmup_duration_seconds   int
warmup_skipped        boolean
warmup_exercises      json  -- [{name, dur}]
stretch_duration_seconds  int
stretch_skipped       boolean
stretch_exercises     json  -- [{name, dur, target}]
image_url             string
```

### `exercises` (child of sessions)
```
id                UUID
session_id        UUID (FK → sessions)
name              string
muscle            string  -- e.g. "Chest" or "Chest › Upper Chest"
duration_seconds  int
notes             text
```

### `sets` (child of exercises)
```
id                UUID
exercise_id       UUID (FK → exercises)
set_number        int
weight_kg         float
reps              int
duration_seconds  int
notes             text
```

### `meals`
```
id                UUID
user_id           UUID
meal_date         date
meal_type         'breakfast' | 'lunch' | 'dinner' | 'snack'
meal_name         string
total_calories    int
protein_g         float
carbs_g           float
fat_g             float
fiber_g           float
health_score      float  -- 0–10
ingredients       array
allergens         array
```

### `water_logs`
```
id          UUID
user_id     UUID
log_date    date
amount_ml   int
```

### `programs`
```
id              UUID
user_id         UUID
package_id      string  -- e.g. 'fat_loss_30'
package_name    string
days_total      int
days_completed  int
current_day     int
status          'active' | 'completed' | 'paused'
```

### `program_days`
```
id                  UUID
program_id          UUID (FK → programs)
day_number          int
workout_exercises   json
meal_plan           json
checkin_status      'pending' | 'completed' | 'missed'
actual_logs         json
incomplete_reason   json
```

### `chat_messages`
```
id          UUID
user_id     UUID
role        'user' | 'assistant'
content     text
context     'meals' | 'program' | 'progress' | 'default'
created_at  timestamp
```

---

## Library Modules (`lib/`)

### `lib/nutrition.js`
- BMR: Mifflin-St Jeor equation
- TDEE: activity multipliers 1.375–1.9
- Protein: 1.6–2.2 g/kg (ISSN 2017)
- Carbs: ≥130 g/day minimum
- Fat: 25–28% of total calories
- Deficit: −500 kcal → 0.5 kg/week loss
- Surplus: +200–300 kcal → lean muscle gain

### `lib/bodyFat.js`
US Navy anthropometric formula (±3% vs DEXA):
- Male: `86.010×log₁₀(waist−neck) − 70.041×log₁₀(height) + 36.76`
- Female: `163.205×log₁₀(waist+hips−neck) − 97.684×log₁₀(height) − 78.387`

### `lib/adaptEngine.js`
- Compliance = `(actual_reps / target_reps) × 100`
- `>95%` compliance + 0 missed → +1 intensity
- `<60%` compliance → −1 intensity
- `>60%` missed days → recovery mode (−2 intensity, −30% reps)

### `lib/muscles.js`
Muscle taxonomy with bilingual aliases → canonical names. Always pass exercise names through this normalization before storing.

### `lib/features.js`
Feature gate: `free | premium | coming_soon`. Check here before rendering premium features.

---

## State Management

No Redux or React Context. Pattern: React hooks + localStorage + Supabase REST.

| Data | Storage |
|------|---------|
| Active workout | React state (in-memory) |
| Draft recovery | `localStorage` key `gt_v5` |
| User profile | Fetched once from `/api/profile` |
| Chat history | `localStorage` key `gcc_chat_v4` (7-day TTL) + Supabase |
| Charts data | Fetched per date range, no caching |

---

## Authentication & Authorization

- Provider: Supabase Auth (email/password)
- All API routes filter by `user_id` from session
- Admin check: email matches `ADMIN_EMAIL` env var
- Status gates in `_app.js`:
  - `pending` → `/pending`
  - `suspended` → `/suspended`
  - `approved` / admin → full access
- Public routes: `/landing`, `/pending`, `/suspended`

---

## AI Integration (Gemini 2.5 Flash)

All calls are server-side (API routes), never from the browser.

| Endpoint | Task | Temperature | Timeout |
|----------|------|-------------|---------|
| `/api/analyze` | Exercise ID from image/text | 0.1 | 25s |
| `/api/coach` | Chat response | 0.4 | 30s |
| `/api/meal-analyze` | Nutrition breakdown from photo | 0.1 | 25s |
| `/api/packages/generate` | AI training program | 0.3 | 60s |

Rate limiting tracked in `api_usage_logs` table via `lib/logApiUsage.js`.

---

## Health-Aware Filtering

Conditions stored in `profiles.health_conditions` modify AI outputs:

| Condition | Exercise exclusions | Nutrition modifications |
|-----------|--------------------|-----------------------|
| `knee_pain` | squats, lunges, jumps | — |
| `back_pain` | deadlifts, crunches | — |
| `diabetes` | — | low sugar, high fiber |
| `hypertension` | — | low sodium |
| `heart_condition` | blocked entirely | — |
| `pregnancy` | blocked entirely | — |

---

## Design System

All styles in `styles/globals.css` — **no Tailwind**, no CSS modules.

**Tokens:**
```css
--primary:  #CBA23B  /* Gold */
--bg:       #09090B  /* Onyx black */
--text:     #ECE3CF  /* Cream */
```

**Direction:** RTL globally. All layout assumes Arabic reading direction.

**Fonts:** Tajawal (Arabic), DM Sans / Space Grotesk (English/numbers)

**Component classes:** `.card`, `.card-sm`, `.card-inset`, `.btn`, `.btn-ghost`, `.btn-sm`, `.tab-btn`

**Mobile-first:** Bottom tab bar with `env(safe-area-inset-bottom)`. Sticky top nav with blur backdrop. `maximum-scale=1` to prevent zoom.

---

## Conventions

- **Inline styles** over CSS modules for dynamic theming
- **Ternary rendering** (`condition ? <A /> : <B />`) over if/switch in JSX
- **`useRef`** for timers, file inputs, scroll anchors
- **`useCallback`** for stable identity on data-fetching and AI calls
- **Date format**: ISO `YYYY-MM-DD` strings everywhere (no Date objects in storage)
- **Muscle names**: normalize through `lib/muscles.js` aliases before storing
- **Gender-aware copy**: use `lib/content.js` helpers, not inline ternaries
- **Loading states**: one boolean per async operation (not a single shared flag)
- **No test files** — manual QA only; do not add mocks for prod paths

---

## Environment Variables

```
GEMINI_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ADMIN_EMAIL
NEXT_PUBLIC_ADMIN_EMAIL
```

---

## Database Migrations

Run in order against Supabase SQL editor:
1. `migrations/supabase-setup.sql` — initial schema
2. `migrations/migration_v5.sql`
3. `migrations/migration_v6.sql`
4. `migrations/supabase-v6-migration.sql` — latest comprehensive
5. `migrations/migration_programs.sql`
6. `migrations/migration_chat.sql`
7. `migrations/migration_assessment.sql`
8. `migrations/migration_gcc_foods.sql` — GCC food DB

---

## Key File Reference

| File | Purpose |
|------|---------|
| `pages/index.js` | Workout logger (core, ~1200 lines) |
| `pages/dashboard.js` | Analytics (core, ~1700 lines) |
| `pages/program.js` | AI programs (premium, ~1500 lines) |
| `pages/meals.js` | Nutrition (core, ~1600 lines) |
| `pages/api/analyze.js` | Exercise AI endpoint |
| `pages/api/coach.js` | Chat AI endpoint |
| `lib/muscles.js` | Muscle taxonomy & normalization |
| `lib/nutrition.js` | Calorie & macro math |
| `lib/adaptEngine.js` | Program adaptation logic |
| `lib/bodyFat.js` | US Navy body fat formula |
| `components/Nav.js` | Navigation UI |
| `styles/globals.css` | Design system |
