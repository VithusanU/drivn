-- ============================================================
-- Drivn MVP — Initial Database Schema
-- ============================================================

create extension if not exists "uuid-ossp";

-- USER PROFILES
create table public.user_profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now() not null,
  last_active_date date
);
alter table public.user_profiles enable row level security;
create policy "Users can view own profile" on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- TASKS
create type task_status as enum ('active', 'completed', 'archived');
create type task_urgency as enum ('high', 'medium', 'low');

create table public.tasks (
  id                uuid default uuid_generate_v4() primary key,
  user_id           uuid references auth.users(id) on delete cascade not null,
  title             text not null,
  description       text,
  status            task_status default 'active' not null,
  urgency           task_urgency default 'medium' not null,
  due_date          timestamptz,
  estimated_minutes integer,
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null,
  completed_at      timestamptz,
  last_engaged_at   timestamptz
);
alter table public.tasks enable row level security;
create policy "Users can CRUD own tasks" on public.tasks for all using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger tasks_updated_at before update on public.tasks for each row execute procedure public.handle_updated_at();

create index tasks_user_status_idx on public.tasks(user_id, status);
create index tasks_due_date_idx on public.tasks(due_date) where status = 'active';

-- HABITS
create table public.habits (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  emoji       text default 'check' not null,
  order_index integer default 0 not null,
  active      boolean default true not null,
  created_at  timestamptz default now() not null
);
alter table public.habits enable row level security;
create policy "Users can CRUD own habits" on public.habits for all using (auth.uid() = user_id);

-- HABIT COMPLETIONS
create table public.habit_completions (
  id             uuid default uuid_generate_v4() primary key,
  habit_id       uuid references public.habits(id) on delete cascade not null,
  user_id        uuid references auth.users(id) on delete cascade not null,
  completed_date date default current_date not null,
  created_at     timestamptz default now() not null,
  unique(habit_id, completed_date)
);
alter table public.habit_completions enable row level security;
create policy "Users can CRUD own habit completions" on public.habit_completions for all using (auth.uid() = user_id);
create index habit_completions_date_idx on public.habit_completions(user_id, completed_date);

-- STREAKS
create table public.user_streaks (
  user_id                 uuid references auth.users(id) on delete cascade primary key,
  current_streak          integer default 0 not null,
  longest_streak          integer default 0 not null,
  last_completion_date    date,
  tasks_completed_today   integer default 0 not null,
  total_tasks_completed   integer default 0 not null,
  updated_at              timestamptz default now() not null
);
alter table public.user_streaks enable row level security;
create policy "Users can manage own streak" on public.user_streaks for all using (auth.uid() = user_id);

create or replace function public.handle_new_user_streak()
returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.user_streaks (user_id) values (new.id); return new; end; $$;
create trigger on_auth_user_created_streak after insert on auth.users for each row execute procedure public.handle_new_user_streak();

-- STREAK UPDATE FUNCTION
create or replace function public.record_task_completion(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  v_streak record;
  v_today date := current_date;
  v_yesterday date := current_date - interval '1 day';
begin
  select * into v_streak from public.user_streaks where user_id = p_user_id for update;
  if not found then
    insert into public.user_streaks (user_id, current_streak, longest_streak, last_completion_date, tasks_completed_today, total_tasks_completed)
    values (p_user_id, 1, 1, v_today, 1, 1); return;
  end if;
  if v_streak.last_completion_date is null or v_streak.last_completion_date < v_today then
    if v_streak.last_completion_date = v_yesterday then
      update public.user_streaks set current_streak = v_streak.current_streak + 1,
        longest_streak = greatest(v_streak.longest_streak, v_streak.current_streak + 1),
        last_completion_date = v_today, tasks_completed_today = 1,
        total_tasks_completed = v_streak.total_tasks_completed + 1, updated_at = now()
      where user_id = p_user_id;
    else
      update public.user_streaks set current_streak = 1, last_completion_date = v_today,
        tasks_completed_today = 1, total_tasks_completed = v_streak.total_tasks_completed + 1, updated_at = now()
      where user_id = p_user_id;
    end if;
  else
    update public.user_streaks set tasks_completed_today = v_streak.tasks_completed_today + 1,
      total_tasks_completed = v_streak.total_tasks_completed + 1, updated_at = now()
    where user_id = p_user_id;
  end if;
end; $$;

-- SEED DEFAULT HABITS
create or replace function public.seed_default_habits(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into public.habits (user_id, title, emoji, order_index) values
    (p_user_id, 'Exercise', '🏋️', 0), (p_user_id, 'Water', '💧', 1),
    (p_user_id, 'Reading', '📖', 2), (p_user_id, 'Meditate', '🧘', 3);
end; $$;
