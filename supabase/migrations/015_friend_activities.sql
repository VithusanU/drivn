-- Migration 015: friend_activities table for the social activity feed
-- Stores recent task completions visible to friends.

CREATE TABLE IF NOT EXISTS public.friend_activities (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL DEFAULT 'task_completed', -- 'task_completed' | 'streak_milestone'
  task_title  TEXT,
  streak_count INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS friend_activities_user_id_idx ON public.friend_activities(user_id);
CREATE INDEX IF NOT EXISTS friend_activities_created_at_idx ON public.friend_activities(created_at DESC);

ALTER TABLE public.friend_activities ENABLE ROW LEVEL SECURITY;

-- Users can insert their own activities
CREATE POLICY "Users can insert own activities"
  ON public.friend_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can see their own activities + activities from accepted friends
CREATE POLICY "Users and friends can read activities"
  ON public.friend_activities FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = friend_activities.user_id)
          OR
          (f.addressee_id = auth.uid() AND f.requester_id = friend_activities.user_id)
        )
    )
  );

-- Auto-cleanup: delete activities older than 14 days to keep the table lean
CREATE OR REPLACE FUNCTION public.cleanup_old_friend_activities()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.friend_activities WHERE created_at < NOW() - INTERVAL '14 days';
$$;
