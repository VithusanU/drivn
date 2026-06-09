-- ── Migration 012: Social — usernames, friendships, presence ──

-- 1. Add social columns to existing user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS share_activity BOOLEAN DEFAULT true;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_username_key'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_username_key UNIQUE (username);
  END IF;
END $$;

-- Allow authenticated users to read any profile (needed for friend search)
-- Drop the restrictive "own only" read policy and replace with a public one
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Authenticated users can view any profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Keep update restricted to own profile
-- (already exists from migration 001, just keeping it)

-- 2. Friendships
CREATE TABLE IF NOT EXISTS public.friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Addressee can respond to requests"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = addressee_id);

CREATE POLICY "Either party can remove friendship"
  ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- 3. Invite tokens (for shareable invite links)
CREATE TABLE IF NOT EXISTS public.friend_invite_tokens (
  token      TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at    TIMESTAMPTZ
);

ALTER TABLE public.friend_invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own invite tokens"
  ON public.friend_invite_tokens FOR ALL
  USING (auth.uid() = user_id);

-- 4. User presence (live "locked in" status)
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_focusing     BOOLEAN DEFAULT false,
  focus_started_at TIMESTAMPTZ,
  last_seen_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Helper: check if two users are accepted friends
CREATE OR REPLACE FUNCTION public.are_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND (
        (requester_id = user_a AND addressee_id = user_b)
        OR (requester_id = user_b AND addressee_id = user_a)
      )
  );
$$;

CREATE POLICY "Friends or self can view presence"
  ON public.user_presence FOR SELECT
  USING (auth.uid() = user_id OR public.are_friends(auth.uid(), user_id));

CREATE POLICY "Users manage own presence"
  ON public.user_presence FOR ALL
  USING (auth.uid() = user_id);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_friendships_requester
  ON public.friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee
  ON public.friendships(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username
  ON public.user_profiles(username) WHERE username IS NOT NULL;
