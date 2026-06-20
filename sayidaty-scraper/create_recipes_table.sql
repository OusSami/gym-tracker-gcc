-- Run this in the Supabase dashboard SQL editor (not via CLI).
-- https://supabase.com/dashboard → your project → SQL Editor → New query

create table if not exists public.recipes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  image_url     text,
  cook_time     text,
  servings      text,
  ingredients   text[] not null default '{}',
  steps         text[] not null default '{}',
  created_at    timestamptz default now()
);

-- Enable RLS
alter table public.recipes enable row level security;

-- Allow public read
create policy "public can read recipes"
  on public.recipes for select
  using (true);
