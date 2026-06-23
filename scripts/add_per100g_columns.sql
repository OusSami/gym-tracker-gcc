ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS cal_per_100g integer,
ADD COLUMN IF NOT EXISTS protein_per_100g numeric(6,1),
ADD COLUMN IF NOT EXISTS carbs_per_100g numeric(6,1),
ADD COLUMN IF NOT EXISTS fat_per_100g numeric(6,1);
