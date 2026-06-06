-- Migration 014: schedule the send-reminders Edge Function every 10 minutes via pg_cron
--
-- SETUP STEPS (run once in Supabase Dashboard → SQL Editor):
--
-- 1. Enable extensions (may already be enabled on your project):
--    SELECT pg_catalog.set_config('search_path', '', false);
--    CREATE EXTENSION IF NOT EXISTS pg_cron;
--    CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- 2. Deploy the Edge Function (run in your terminal):
--    supabase functions deploy send-reminders
--
-- 3. Set the Edge Function secrets (run in your terminal):
--    supabase secrets set VAPID_PUBLIC_KEY=<your-key>
--    supabase secrets set VAPID_PRIVATE_KEY=<your-key>
--    supabase secrets set VAPID_SUBJECT=<your-subject>
--
-- 4. Run this migration in Supabase Dashboard → SQL Editor:

-- Store Supabase project URL and anon key so pg_cron can call the Edge Function.
-- Replace the placeholder values below with your actual project ref and service role key.
-- (Dashboard → Settings → API)

DO $$
DECLARE
  project_url TEXT := current_setting('app.settings.supabase_url', true);
  service_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  -- If settings aren't configured via app.settings, the cron job
  -- won't be scheduled automatically. Use the manual SQL below instead.
  IF project_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'app.settings not configured — run the manual cron setup below';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'drivn-send-reminders',
    '*/10 * * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := %L || '/functions/v1/send-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := '{}'::jsonb
      );
      $cron$,
      project_url, service_key
    )
  );
END $$;

-- MANUAL SETUP (if the DO block above raises a notice, run this instead,
-- replacing YOUR_PROJECT_URL and YOUR_SERVICE_ROLE_KEY):
--
-- SELECT cron.schedule(
--   'drivn-send-reminders',
--   '*/10 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'YOUR_PROJECT_URL/functions/v1/send-reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
