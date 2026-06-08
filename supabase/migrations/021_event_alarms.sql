-- Migration 021: per-event alarms ("Dentist at 3pm", "Oil change at 9am", etc.)
--
-- Mirrors the per-task alarm system added in 018_task_alarms.sql /
-- 019_task_alarm_at.sql:
--   - alarm_enabled: user opt-in toggle (only meaningful once event_time is set)
--   - alarm_at: a single precomputed UTC instant (event_date + event_time
--     collapsed client-side into one absolute timestamp — see deriveEventAlarmAt
--     in stores/eventStore.ts), so the scheduler does a plain range comparison
--     with no string/date-splitting or timezone-skew edge cases
--   - last_alarm_at: dedupe marker so the cron sender fires each alarm once

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS alarm_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alarm_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_alarm_at TIMESTAMPTZ;

-- Events have no `status` column (unlike tasks), so the partial index just
-- filters on alarm_enabled — mirrors tasks_alarm_at_idx from migration 019.
CREATE INDEX IF NOT EXISTS events_alarm_at_idx ON public.events(alarm_at)
  WHERE alarm_enabled = true;
