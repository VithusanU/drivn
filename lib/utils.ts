import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isToday, isTomorrow, isPast } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, '0')}${period}`
}

// `due_date` is stored as a `timestamptz` holding UTC-midnight of the user's
// intended LOCAL calendar date — e.g. picking "Today" stores the string
// "2026-06-07", which Postgres records & returns as "2026-06-07T00:00:00+00:00".
// Parsing that with `parseISO` and then formatting/comparing with local-time
// functions (format/isToday/isPast) re-interprets the UTC instant in the
// viewer's own timezone — rolling the date back by one calendar day for anyone
// west of UTC (i.e. all of the Americas: "Jun 7" renders as "Jun 6" and shows
// as overdue). The calendar-date digits are always correct as originally sent,
// so pull them out directly and build a LOCAL date from those components —
// that's the date the user actually picked, independent of viewer timezone.
export function dueDateOnly(dueDateStr: string): Date {
  const [y, mo, d] = dueDateStr.slice(0, 10).split('-').map(Number)
  return new Date(y, mo - 1, d)
}

// Same idea, but also folds in `due_time` (a local "HH:MM" string) to produce
// the precise local instant the task is due — used for time-aware comparisons.
export function effectiveDueDateTime(dueDateStr: string, dueTimeStr?: string | null): Date {
  const [y, mo, d] = dueDateStr.slice(0, 10).split('-').map(Number)
  if (dueTimeStr) {
    const [h, mi] = dueTimeStr.split(':').map(Number)
    return new Date(y, mo - 1, d, h, mi, 0, 0)
  }
  return new Date(y, mo - 1, d)
}

export function formatDueDate(dueDateStr: string | null, dueTimeStr?: string | null): string {
  if (!dueDateStr) return 'No deadline'
  const date = dueDateOnly(dueDateStr)
  const timeSuffix = dueTimeStr ? ` · ${formatTime12h(dueTimeStr)}` : ''
  if (isPast(date) && !isToday(date)) return `Overdue · ${format(date, 'MMM d')}${timeSuffix}`
  if (isToday(date)) return `Due today${timeSuffix}`
  if (isTomorrow(date)) return `Due tomorrow${timeSuffix}`
  return `Due ${format(date, 'MMM d')}${timeSuffix}`
}

export function getGreeting(name: string | null): string {
  const hour = new Date().getHours()
  const firstName = name?.split(' ')[0] ?? 'there'
  if (hour < 12) return `Good morning, ${firstName}.`
  if (hour < 17) return `Good afternoon, ${firstName}.`
  return `Good evening, ${firstName}.`
}

export function getMomentumMessage(streak: number, tasksToday: number): string {
  if (streak === 0 && tasksToday === 0) return 'Complete a task to start your streak.'
  if (tasksToday === 0) return `${streak} day streak. Keep it going today.`
  if (tasksToday === 1) return 'First task done. Momentum building.'
  if (tasksToday >= 5) return `${tasksToday} tasks done. You're in the zone.`
  return `${tasksToday} task${tasksToday > 1 ? 's' : ''} done. You're building consistency.`
}

export function getTodayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
