-- Migration 020: support multiple simultaneous push subscriptions per user
--
-- Previously `push_subscriptions.user_id` was UNIQUE, so a user could only
-- ever have ONE active device subscribed — subscribing from a second device
-- silently evicted the first (upsert onConflict: 'user_id'). This migration:
--
--   1. Moves `reminder_time`/`last_reminded_at` to `user_profiles`, since the
--      daily reminder time is a USER preference, not a per-device setting —
--      keeping it on the subscription row would mean each device could carry
--      a different time, or a user with N devices would get N reminders/day.
--   2. Relaxes the uniqueness constraint from `user_id` alone to
--      `(user_id, endpoint)`, so each device/browser gets its own row, while
--      re-subscribing the same device still updates (rather than duplicates)
--      its existing row.

-- 1a. Add user-level reminder columns
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS reminder_time TIME,
  ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;

-- 1b. Backfill from the existing (one-per-user) subscription rows
UPDATE public.user_profiles up
SET reminder_time    = ps.reminder_time,
    last_reminded_at = ps.last_reminded_at
FROM public.push_subscriptions ps
WHERE ps.user_id = up.id
  AND ps.reminder_time IS NOT NULL;

-- 2a. Drop the old single-device uniqueness constraint
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_key;

-- 2b. Add the new per-device uniqueness constraint
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);

-- 3. Drop the now-redundant per-subscription reminder columns
ALTER TABLE public.push_subscriptions
  DROP COLUMN IF EXISTS reminder_time,
  DROP COLUMN IF EXISTS last_reminded_at;
