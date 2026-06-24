-- Recipe favorites table
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.recipe_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id)
    ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id)
    ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, recipe_id)
);

ALTER TABLE public.recipe_favorites
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own favorites"
  ON public.recipe_favorites
  FOR ALL USING (auth.uid() = user_id);
