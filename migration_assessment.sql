-- ═══════════════════════════════════════════════════════
-- GYM TRACKER GCC — Assessment Migration
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- Body measurements
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS waist_cm    numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hips_cm     numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS neck_cm     numeric;

-- Calculated body composition
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_fat_pct      numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lean_mass_kg      numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fat_mass_kg       numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_fat_method   text;  -- 'photo' | 'measurements'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_fat_updated_at timestamptz;

-- Package inputs
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS days_per_week  integer DEFAULT 3;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipment      text    DEFAULT 'gym';  -- 'gym'|'home'|'both'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sleep_hours    numeric DEFAULT 7;

-- Recommended package
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recommended_package text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS package_updated_at  timestamptz;

-- Calorie target (calculated from BMR)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calorie_target integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sex text;
