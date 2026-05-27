-- Add beta_access flag to user profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS beta_access BOOLEAN NOT NULL DEFAULT FALSE;

-- Auto-approve the owner account if it already exists
UPDATE user_profiles SET beta_access = TRUE WHERE email = 'vithusan.business@gmail.com';

-- Beta access request queue
CREATE TABLE IF NOT EXISTS beta_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email    TEXT NOT NULL,
  user_name     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'denied')),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  UNIQUE (user_id)   -- one request per user at a time
);

ALTER TABLE beta_requests ENABLE ROW LEVEL SECURITY;

-- Users can read and insert only their own row
CREATE POLICY "users_own_beta_request_select"
  ON beta_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_own_beta_request_insert"
  ON beta_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
