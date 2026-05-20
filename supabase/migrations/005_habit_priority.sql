alter table public.habits
  add column if not exists priority text not null default 'nice_to_have';
