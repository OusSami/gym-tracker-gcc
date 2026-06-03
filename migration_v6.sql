-- ═══════════════════════════════════════════════════
-- GYM TRACKER GCC v6 — Full Interconnected System
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Health conditions on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS health_conditions  text[]  DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS health_risk_level  text    DEFAULT 'normal';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS health_notes       text;

-- Program days: reason + adaptation + report
ALTER TABLE program_days ADD COLUMN IF NOT EXISTS incomplete_reason  jsonb;
ALTER TABLE program_days ADD COLUMN IF NOT EXISTS adaptation_signal  jsonb;
ALTER TABLE program_days ADD COLUMN IF NOT EXISTS daily_report       jsonb;
ALTER TABLE program_days ADD COLUMN IF NOT EXISTS actual_logs        jsonb;
ALTER TABLE program_days ADD COLUMN IF NOT EXISTS session_id         uuid;
ALTER TABLE program_days ADD COLUMN IF NOT EXISTS meal_date          date;

-- Sessions: link back to program
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS program_id      uuid;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS muscles_trained text[];
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_sets      integer DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS duration_seconds integer DEFAULT 0;
-- NOTE: sessions already has a relational 'exercises' table — no jsonb column needed

-- Meals: ensure date column exists
ALTER TABLE meals ADD COLUMN IF NOT EXISTS meal_date   date;
ALTER TABLE meals ADD COLUMN IF NOT EXISTS program_day_id uuid;

-- Index for fast day lookups
CREATE INDEX IF NOT EXISTS program_days_date_idx ON program_days(planned_date);
CREATE INDEX IF NOT EXISTS sessions_date_idx     ON sessions(session_date);
CREATE INDEX IF NOT EXISTS meals_date_idx        ON meals(meal_date);
