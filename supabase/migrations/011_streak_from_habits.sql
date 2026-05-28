-- A lightweight streak-maintenance function for habit completions.
-- Unlike record_task_completion it does NOT touch tasks_completed_today
-- or total_tasks_completed — those counters remain task-only.
create or replace function public.record_habit_activity(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  v_streak record;
  v_today date := current_date;
  v_yesterday date := current_date - interval '1 day';
begin
  select * into v_streak from public.user_streaks where user_id = p_user_id for update;

  if not found then
    insert into public.user_streaks (user_id, current_streak, longest_streak, last_completion_date, tasks_completed_today, total_tasks_completed)
    values (p_user_id, 1, 1, v_today, 0, 0);
    return;
  end if;

  -- Already recorded activity today — nothing to do
  if v_streak.last_completion_date = v_today then
    return;
  end if;

  if v_streak.last_completion_date = v_yesterday then
    -- Consecutive day — extend streak
    update public.user_streaks set
      current_streak  = v_streak.current_streak + 1,
      longest_streak  = greatest(v_streak.longest_streak, v_streak.current_streak + 1),
      last_completion_date = v_today,
      updated_at      = now()
    where user_id = p_user_id;
  else
    -- Gap detected — reset streak
    update public.user_streaks set
      current_streak  = 1,
      last_completion_date = v_today,
      updated_at      = now()
    where user_id = p_user_id;
  end if;
end; $$;
