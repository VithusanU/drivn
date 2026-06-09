-- Migration 017: enable Realtime on friend_activities
-- This allows the friends page to receive live updates when friends complete tasks.

ALTER TABLE public.friend_activities REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_activities;
