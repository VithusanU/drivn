-- Migration 013: add last_reminded_at to push_subscriptions
-- Used by the daily reminder cron to avoid sending duplicate reminders on the same day.

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;
