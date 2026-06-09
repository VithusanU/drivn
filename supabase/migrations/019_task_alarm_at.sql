-- Migration 019: replace alarm_time_utc with a single combined alarm_at timestamp
--
-- The split due_date (timestamptz, derived from the user's local calendar date) +
-- alarm_time_utc (TIME) representation is fragile: comparing a UTC "today" string
-- against a timestamptz that encodes a *local* calendar date can be off by a day
-- depending on the user's timezone and time of day (e.g. "8pm today" in US timezones
-- often lands on the *next* UTC calendar date). Collapsing both into one precomputed
-- UTC timestamp (alarm_at) lets the scheduler do a single, unambiguous range check.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS alarm_at TIMESTAMPTZ;

DROP INDEX IF EXISTS public.tasks_alarm_idx;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS alarm_time_utc;

CREATE INDEX IF NOT EXISTS tasks_alarm_at_idx ON public.tasks(alarm_at)
  WHERE status = 'active' AND alarm_enabled = true;
