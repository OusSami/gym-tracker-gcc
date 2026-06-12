# BACKLOG — GYM Tracker GCC

> Single source of truth for pending work. Top section is the active light-theme
> conversion (audited, phased). Lower sections track other open items.

---

## 🎨 EPIC: Light / Pastel Theme Conversion

**Goal:** Replace the dark gold-on-black theme with a light, airy, pastel theme
(white/light-grey surfaces, soft shadows, rounded cards, black pill buttons,
color only in content). Primary audience: GCC women.

**Scope rule:** UI/UX only. Do NOT touch feature logic, Supabase calls, state
machines, the workout flow, or the quiz logic. RTL stays — logical CSS properties
only (`padding-inline`, `margin-inline-start`, `inset-inline-start`,
`text-align: start/end`), never `left`/`right`.

**Reality check (from Phase 1 audit):** ~95% of UI needs manual file-by-file
edits. App is ~90% inline-styled with hardcoded hex. Estimated 3–4 focused days.
This is NOT a token flip.

**Safety net (do before Phase 2):**
- [ ] Confirm the zipped previous version actually opens and runs.
- [ ] `git checkout -b light-theme` — whole experiment is throwaway-safe.
- [ ] Convert ONE screen first, live with it, before committing to all screens.

### Phase 1 — Token layer + audit ✅ (done)
- [x] Light/pastel tokens defined in `globals.css`
- [x] Shared CSS classes (`.card`, `.btn-*`, `.stat-card`, `.tab-bar`) flipped
- [x] `BottomTabs` flipped
- [x] Audit produced (this plan)

### Phase 2 — Shared shell (1 session, highest leverage)
- [ ] `components/Nav.js` → TopNav (34 gold hits)
- [ ] `components/ChatWidget.js` (12 gold hits)

### Phase 3 — Small utility pages (~2 sessions)
- [ ] `pages/coach.js`
- [ ] `pages/weight.js`  ⚠️ has inline `<style>` injection
- [ ] `pages/body.js`
- [ ] `pages/packages.js`
- [ ] `pages/templates.js`

### Phase 4 — Medium feature pages (~2 sessions)
- [ ] `pages/settings.js`  ⚠️ inline `<style>` injection
- [ ] `pages/exercises.js`  ⚠️ GifPlayer dark container (`#000`/`#111`)
- [ ] `pages/assessment.js`

### Phase 5 — Core screens (~2–3 sessions each)
- [ ] `pages/meals.js` (1717 lines, 75 gold hits)
- [ ] `pages/program.js` (1198 lines)  ⚠️ 3 SVG ring tracks invisible on light
- [ ] `pages/index.js` (1976 lines)  ⚠️ auth screen + workout flow + inline `<style>` + 1 SVG ring

### Phase 6 — Dashboard (1 dedicated session)
- [ ] `pages/dashboard.js` (2477 lines, 94 gold hits)
  ⚠️ 6 Recharts instances with dark grid colors (`#1a1a1a`/`#111`)
  ⚠️ inline `<style>` injection for date picker

### Phase 7 — Public-facing (independent)
- [ ] `pages/landing.js` (own design language)
- [ ] `pages/onboarding.js` — LAST, careful: quiz logic interleaved with styling + gradient overlays

### Image work (parallel with Phase 4)
- [ ] GifPlayer in `exercises.js`: remove `background:'#000'`/`'#111'` → light grey or transparent
- [ ] `onboarding.js`: gender-avatar gradient `#09090B` → `var(--surface)` (else black smear)
- [ ] `landing-app-mockup.webp`: remove gold drop-shadow → neutral shadow

### ⚠️ Invisible-on-light landmines (no build error — must eyeball)
- [ ] SVG ring tracks `rgba(255,255,255,0.06)` → dark/translucent track (index ×1, program ×3)
- [ ] Recharts grid/axis `#1a1a1a`/`#111` → light grey (dashboard ×6)
- [ ] Inline `<style>` blocks override globals.css → remove (index, dashboard, settings, weight)
- [ ] Exercise anatomy infographics: re-check framing on light (pages were dark-card framed)

---

## 🏋️ Flutter Kick infographic
- [ ] Regenerate `public/exercises/flutter-kick.png` — bottom Start/Mid/End strip showed wrong
      exercise (prone push-up instead of supine flutter kick). Fix instruction already drafted.

## 🛠️ Admin dashboard CRUD
- [x] Profile editing
- [ ] Meals CRUD
- [ ] Sessions CRUD
- [ ] Programs CRUD
- [ ] Weight tracking CRUD

## 🔢 Home calories card
- [ ] Design + data-accuracy pass (portion vs 100g calc).

---

_Last updated: 2026-06-11_
