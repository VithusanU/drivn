-- Migration 018: per-task alarms
-- Lets users set a specific time to be pinged about a task — e.g. "Gym" at 6:00pm,
-- "Morning jog" at 7:00am — distinct from the single daily reminder time on the profile.
--
-- due_date/due_time are stored & displayed in the user's LOCAL time (no conversion),
-- so they can't be matched directly against the UTC-windowed cron scan. We mirror the
-- chosen time into alarm_time_utc (converted client-side, same pattern as reminder_time
-- on push_subscriptions) purely for the scheduler to match against. alarm_enabled opts
-- the task into push notifications at that moment, and last_alarm_at dedupes so the
-- send-reminders function only fires once per task per day.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS alarm_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alarm_time_utc TIME,
  ADD COLUMN IF NOT EXISTS last_alarm_at TIMESTAMPTZ;

-- Speeds up the send-reminders scan: active tasks with an alarm armed for today
CREATE INDEX IF NOT EXISTS tasks_alarm_idx ON public.tasks(due_date, alarm_time_utc)
  WHERE status = 'active' AND alarm_enabled = true;
