import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDueDate(dueDateStr: string | null): string {
  if (!dueDateStr) return 'No deadline'
  const date = parseISO(dueDateStr)
  if (isPast(date) && !isToday(date)) return `Overdue · ${format(date, 'MMM d')}`
  if (isToday(date)) return 'Due today'
  if (isTomorrow(date)) return 'Due tomorrow'
  return `Due ${format(date, 'MMM d')}`
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
