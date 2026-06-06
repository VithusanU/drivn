-- Migration 016: add category column to tasks
-- Allows users to group tasks by area of life (Work, Personal, Health, etc.)

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS tasks_category_idx ON public.tasks(user_id, category)
  WHERE status = 'active';
