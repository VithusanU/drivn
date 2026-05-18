import posthog from 'posthog-js'

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.capture(event, properties)
}

// Acquisition
export const Analytics = {
  signupStarted: (source?: string) =>
    trackEvent('signup_started', { source }),

  signupCompleted: (method: 'google' | 'email') =>
    trackEvent('signup_completed', { method }),

  // Core product
  taskCreated: (urgency: string) =>
    trackEvent('task_created', { urgency }),

  taskCompleted: (estimatedMinutes?: number) =>
    trackEvent('task_completed', { estimated_minutes: estimatedMinutes }),

  focusSessionStarted: (taskId: string, hasTimer: boolean) =>
    trackEvent('focus_session_started', { task_id: taskId, has_timer: hasTimer }),

  focusSessionCompleted: (taskId: string) =>
    trackEvent('focus_session_completed', { task_id: taskId }),

  // Technical
  spotifyRequestFailed: (reason: string) =>
    trackEvent('spotify_request_failed', { reason }),

  authFailed: (reason: string) =>
    trackEvent('auth_failed', { reason }),
}
