import posthog from 'posthog-js'

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.capture(event, properties)
}

export const Analytics = {
  // ── Acquisition ────────────────────────────────────────────────────────────
  signupStarted: (source?: string) =>
    trackEvent('signup_started', { source }),

  signupCompleted: (method: 'google' | 'email') =>
    trackEvent('signup_completed', { method }),

  // ── Session ─────────────────────────────────────────────────────────────────
  // Call once per daily session (on app layout mount)
  sessionInitiated: () =>
    trackEvent('session_initiated'),

  // Call when the app is opened within 30 min of the user's reminder time
  returnedAfterReminder: () =>
    trackEvent('returned_after_reminder'),

  // ── Tasks ───────────────────────────────────────────────────────────────────
  taskCreated: (urgency: string) =>
    trackEvent('task_created', { urgency }),

  taskCompleted: (estimatedMinutes?: number) =>
    trackEvent('task_completed', { estimated_minutes: estimatedMinutes }),

  // Fired when a task is deleted/archived without being completed
  taskAbandoned: (urgency: string) =>
    trackEvent('task_abandoned', { urgency }),

  // ── Focus sessions ──────────────────────────────────────────────────────────
  focusSessionStarted: (taskId: string, hasTimer: boolean) =>
    trackEvent('focus_session_started', { task_id: taskId, has_timer: hasTimer }),

  focusSessionCompleted: (taskId: string) =>
    trackEvent('focus_session_completed', { task_id: taskId }),

  // ── Streaks ─────────────────────────────────────────────────────────────────
  streakMilestone: (days: number) =>
    trackEvent('streak_milestone', { days }),

  streakBroken: (previousStreak: number) =>
    trackEvent('streak_broken', { previous_streak: previousStreak }),

  // ── Technical ───────────────────────────────────────────────────────────────
  spotifyRequestFailed: (reason: string) =>
    trackEvent('spotify_request_failed', { reason }),

  authFailed: (reason: string) =>
    trackEvent('auth_failed', { reason }),
}
