alter table public.habits
  add column if not exists detail_type text not null default 'none',
  add column if not exists detail_config jsonb;

alter table public.habit_completions
  add column if not exists details jsonb;
