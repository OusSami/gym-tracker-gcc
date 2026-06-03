-- ═══════════════════════════════════════════════════════
-- GYM TRACKER GCC — V5 Database Migration
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. Add status column to profiles (access control)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_by text;

-- Approve all existing users so they keep access
UPDATE profiles SET status = 'approved', approved_at = now() WHERE status IS NULL OR status = 'pending';

-- 2. AI API usage tracking (cost control)
CREATE TABLE IF NOT EXISTS api_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  cost_usd numeric(10,6) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_usage_user_id_idx ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS api_usage_created_at_idx ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS api_usage_endpoint_idx ON api_usage(endpoint);

-- 3. App session tracking (time in app)
CREATE TABLE IF NOT EXISTS app_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer
);
CREATE INDEX IF NOT EXISTS app_sessions_user_id_idx ON app_sessions(user_id);

-- 4. RLS policies for new tables
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can see own usage" ON api_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Service can insert usage" ON api_usage FOR INSERT WITH CHECK (true);

ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can see own sessions" ON app_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can manage own sessions" ON app_sessions FOR ALL USING (auth.uid() = user_id);
