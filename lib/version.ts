export const APP_VERSION = '0.9.0'

export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.9.0',
    date: 'Jun 2026',
    changes: [
      'Personal events & appointments with reminders',
      'Upcoming this week dashboard widget',
      'Push notifications — even when app is closed',
      'Task notes & descriptions',
      'Recurring tasks (daily, weekly, monthly)',
      'Task templates for common workflows',
      'Focus session history in Summary',
      'Search & flat view for tasks',
      'Bulk complete and archive tasks',
      'Quick wins suggested after completing a task',
      'Estimated vs actual time tracking',
      'Light mode fully supported',
      'Summary page with weekly insights',
      'Habits step added to onboarding',
      'Share your streak with friends',
      'Spotify connect visible in Profile',
      'Version changelog (you are here)',
    ],
  },
  {
    version: '0.8.0',
    date: 'May 2026',
    changes: [
      'AI-powered task recommendations (Beta)',
      'Sticky note scanner — photo to tasks',
      'BYOK — bring your own Groq API key',
      'Undo deleted tasks & habits',
      'Account switching',
      'Blocked task dependencies',
    ],
  },
  {
    version: '0.7.0',
    date: 'Apr 2026',
    changes: [
      'Focus timer with break support',
      'Habit tracking with streaks',
      'Activity heatmap in Summary',
      'Momentum card on dashboard',
      'Quick capture at the bottom of every screen',
    ],
  },
]
