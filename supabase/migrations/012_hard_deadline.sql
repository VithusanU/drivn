-- Add hard deadline flag to tasks
-- A hard deadline means the task MUST be completed by its due_date — no flexibility.
-- This is used by the AI recommendation engine to always surface these tasks first on their due date.

alter table public.tasks
  add column if not exists is_hard_deadline boolean not null default false;
