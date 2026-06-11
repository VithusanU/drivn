-- Lead-time reminders for upcoming events ("tomorrow" / "next week"), in
-- addition to the existing exact-time alarm_at notifications (021_event_alarms).
--
-- Per-event dedupe flags: once a lead-time reminder has been sent for an
-- event, it's sent — these never reset, so they're plain booleans (not
-- timestamps like last_alarm_at, which need to be re-armable for recurring
-- alarms).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS reminder_1day_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_1week_sent BOOLEAN NOT NULL DEFAULT false;

-- Per-user opt-in/out for each lead time. Default true — most users want
-- the heads-up, and this matches the "on by default" framing of the other
-- notification settings in Profile.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS remind_event_1day BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS remind_event_1week BOOLEAN NOT NULL DEFAULT true;

-- Speeds up the send-reminders scan for events landing exactly 1 or 7 days
-- out that haven't been notified yet.
CREATE INDEX IF NOT EXISTS events_lead_reminder_idx ON public.events(event_date)
  WHERE NOT reminder_1day_sent OR NOT reminder_1week_sent;
