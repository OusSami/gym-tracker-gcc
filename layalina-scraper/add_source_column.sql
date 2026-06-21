-- Run this in the Supabase dashboard SQL editor BEFORE running import_recipes.mjs
-- Adds a 'source' column to track which scraper each recipe came from

ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS source text DEFAULT 'sayidaty';

UPDATE public.recipes SET source = 'sayidaty' WHERE source IS NULL;
