-- Settings for the upcoming day-schedule feature.
--
-- work_end_time: default "done by" time used to build the day's schedule
-- and bound AI planning so it doesn't fill the day indefinitely.
--
-- work_days: which days of the week the user works, as JS-style day numbers
-- (0 = Sunday .. 6 = Saturday). Defaults to every day.
alter table public.user_profiles
  add column if not exists work_end_time time not null default '18:00',
  add column if not exists work_days smallint[] not null default '{0,1,2,3,4,5,6}';

-- One-off days off (vacation, etc.) that the schedule should skip even if
-- they fall on a normal work day.
create table if not exists public.schedule_blocked_dates (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  blocked_date date not null,
  created_at   timestamptz default now() not null,
  unique(user_id, blocked_date)
);
alter table public.schedule_blocked_dates enable row level security;
create policy "Users can CRUD own blocked dates" on public.schedule_blocked_dates for all using (auth.uid() = user_id);
create index if not exists schedule_blocked_dates_user_idx on public.schedule_blocked_dates(user_id, blocked_date);
