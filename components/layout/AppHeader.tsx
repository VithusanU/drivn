'use client'

import { format } from 'date-fns'
import { Flame } from 'lucide-react'
import { useUserStore } from '@/stores/userStore'
import { useTaskStore } from '@/stores/taskStore'
import { getGreeting, dueDateOnly } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function AppHeader() {
  const profile = useUserStore((s) => s.profile)
  const streak = useUserStore((s) => s.streak)
  const tasks = useTaskStore((s) => s.tasks)

  const today = format(new Date(), 'EEEE, MMM d')
  const dueTodayCount = tasks.filter((t) => {
    if (!t.due_date) return false
    // dueDateOnly extracts the calendar-date digits directly — using
    // new Date(t.due_date) re-interprets the stored UTC-midnight instant in
    // local time, rolling the date back a day for anyone west of UTC.
    const due = dueDateOnly(t.due_date)
    const now = new Date()
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    return due <= endOfDay && t.status === 'active'
  }).length

  return (
    <header className="px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-4 flex items-start justify-between">
      <div>
        <h1 className="text-[22px] font-medium text-foreground leading-tight">
          {getGreeting(profile?.full_name ?? null)}
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          {today}
          {dueTodayCount > 0 && (
            <span className="ml-1">
              · {dueTodayCount} task{dueTodayCount > 1 ? 's' : ''} due today
            </span>
          )}
        </p>
      </div>

      {streak && streak.current_streak > 0 && (
        <div className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
          'bg-drivn-green/10 border border-drivn-green/25',
          'text-drivn-green text-[12px] font-medium'
        )}>
          <Flame className="w-3.5 h-3.5" />
          <span>{streak.current_streak} days</span>
        </div>
      )}
    </header>
  )
}
