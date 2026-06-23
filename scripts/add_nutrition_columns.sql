ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS calories integer,
ADD COLUMN IF NOT EXISTS protein_g numeric(6,1),
ADD COLUMN IF NOT EXISTS carbs_g numeric(6,1),
ADD COLUMN IF NOT EXISTS fat_g numeric(6,1),
ADD COLUMN IF NOT EXISTS fiber_g numeric(6,1),
ADD COLUMN IF NOT EXISTS nutrition_estimated_at timestamptz;
