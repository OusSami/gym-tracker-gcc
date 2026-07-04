-- Phase 1 extras: add extra_type column to recipes table
-- Run once in the Supabase SQL editor.
--
-- Adds sub-type classification for recipe_type='extra' entries.
-- Values: dates | nuts | fruit | juice | savory | dairy
--
-- After running this migration, run:  node scripts/insert_extras_v1.mjs

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS extra_type TEXT;

COMMENT ON COLUMN public.recipes.extra_type IS
  'Sub-type for recipe_type=extra entries. Values: dates, nuts, fruit, juice, savory, dairy. NULL for dish/component rows.';
