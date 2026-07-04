-- Fix B: recipe_type column
-- Run once in the Supabase SQL editor.
--
-- Adds a recipe_type column to flag component/sauce/marinade-only records
-- that should not be auto-recommended as standalone meals in the daily
-- meal-plan generator (/api/packages/meal-plan).
--
-- Values:
--   'dish'      (default) — a standalone meal, safe to recommend
--   'component' — a sauce, marinade, side-only or otherwise incomplete
--                 recipe that should be excluded from auto-recommendation
--                 but remains visible in the recipe library and search.
--
-- After running this migration, run:  node scripts/apply_fix_b.mjs

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS recipe_type TEXT DEFAULT 'dish';

COMMENT ON COLUMN public.recipes.recipe_type IS
  'Classifies recipe role: dish (default) = standalone meal eligible for meal-plan recommendation; component = sauce/marinade/side that should not be auto-recommended as a standalone meal.';
