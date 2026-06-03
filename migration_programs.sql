-- ═══════════════════════════════════════════════════════
-- GYM TRACKER GCC — Programs Migration
-- Run in Supabase SQL Editor AFTER migration_assessment.sql
-- ═══════════════════════════════════════════════════════

-- Active user programs (one active at a time)
CREATE TABLE IF NOT EXISTS user_programs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  package_id  text NOT NULL,
  package_name text,
  start_date  date NOT NULL DEFAULT CURRENT_DATE,
  end_date    date,
  total_days  integer DEFAULT 21,
  current_day integer DEFAULT 1,
  status      text DEFAULT 'active',   -- 'active'|'completed'|'paused'
  roadmap     jsonb,                    -- Full AI roadmap (generated once)
  generated_at timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_programs_user_id_idx ON user_programs(user_id);
CREATE INDEX IF NOT EXISTS user_programs_status_idx ON user_programs(status);

-- Daily program tracking (one row per day per program)
CREATE TABLE IF NOT EXISTS program_days (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id      uuid REFERENCES user_programs(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE,
  day_number      integer NOT NULL,
  planned_date    date,
  roadmap_target  jsonb,           -- What roadmap says for this day
  daily_workout   jsonb,           -- AI-generated specific workout
  checkin_status  text,            -- 'completed'|'partial'|'missed'|'rest'
  energy_level    text,            -- 'high'|'normal'|'low'|'sick'
  compliance_note text,
  adjusted        boolean DEFAULT false,
  completed_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS program_days_program_id_idx ON program_days(program_id);
CREATE INDEX IF NOT EXISTS program_days_user_id_idx ON program_days(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS program_days_unique ON program_days(program_id, day_number);

-- RLS
ALTER TABLE user_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own programs" ON user_programs;
CREATE POLICY "Users manage own programs" ON user_programs FOR ALL USING (auth.uid() = user_id);

ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own days" ON program_days;
CREATE POLICY "Users manage own days" ON program_days FOR ALL USING (auth.uid() = user_id);
