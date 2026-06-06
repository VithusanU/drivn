-- ── Migration 009: Events, Focus Sessions, AI Cache, Recurring Tasks, Indexes ──

-- Personal events / appointments
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  category TEXT DEFAULT 'personal'
    CHECK (category IN ('appointment', 'maintenance', 'personal', 'health', 'other')),
  recurrence TEXT DEFAULT 'none'
    CHECK (recurrence IN ('none', 'weekly', 'monthly', 'custom')),
  recurrence_days INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own events"
  ON events FOR ALL
  USING (auth.uid() = user_id);

-- Focus session history
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  task_title TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  minutes_logged INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own focus_sessions"
  ON focus_sessions FOR ALL
  USING (auth.uid() = user_id);

-- AI recommendation server-side cache (replaces broken in-memory Map)
CREATE TABLE IF NOT EXISTS ai_recommendation_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  json TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_recommendation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for ai_recommendation_cache"
  ON ai_recommendation_cache FOR ALL
  USING (auth.uid() = user_id);

-- Recurring tasks support
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT 'none'
  CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly'));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_status
  ON tasks(user_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date
  ON tasks(due_date) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date
  ON habit_completions(user_id, completed_date);

CREATE INDEX IF NOT EXISTS idx_events_user_date
  ON events(user_id, event_date);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user
  ON focus_sessions(user_id, created_at DESC);
