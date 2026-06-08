'use client'

import { useMemo } from 'react'
import { useEventStore } from '@/stores/eventStore'
import { useTaskStore } from '@/stores/taskStore'
import { cn } from '@/lib/utils'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * Desktop-rail "month at a glance" — current month only (no prev/next nav).
 * Deliberately read-only and scoped to *this* month: useEventStore only
 * fetches events from ~7 days ago onward, so showing other months would risk
 * silently rendering an incomplete (and misleadingly "empty") picture. Marks
 * days that have an event and/or an active task due — both already-fetched,
 * already-in-memory datasets, so this adds zero new network requests.
 */
export default function MiniCalendar() {
  const events = useEventStore((s) => s.events)
  const tasks = useTaskStore((s) => s.tasks)

  const { monthLabel, cells, todayStr } = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const todayStr = `${year}-${pad(month + 1)}-${pad(now.getDate())}`

    const firstOfMonth = new Date(year, month, 1)
    const startWeekday = firstOfMonth.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells: (string | null)[] = []
    for (let i = 0; i < startWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${pad(month + 1)}-${pad(d)}`)
    while (cells.length % 7 !== 0) cells.push(null)

    return {
      monthLabel: firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      cells,
      todayStr,
    }
  }, [])

  const markers = useMemo(() => {
    const map: Record<string, { event: boolean; task: boolean }> = {}
    for (const e of events) {
      const m = map[e.event_date] ?? { event: false, task: false }
      m.event = true
      map[e.event_date] = m
    }
    for (const t of tasks) {
      if (t.due_date && t.status === 'active') {
        const m = map[t.due_date] ?? { event: false, task: false }
        m.task = true
        map[t.due_date] = m
      }
    }
    return map
  }, [events, tasks])

  return (
    <div className="p-4 rounded-2xl bg-card/50 border border-border/50">
      <p className="text-[12px] font-medium text-foreground/80 mb-3">{monthLabel}</p>

      <div className="grid grid-cols-7 gap-y-1.5">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i} className="text-[9px] font-medium text-muted-foreground/40 text-center">
            {label}
          </span>
        ))}

        {cells.map((dateStr, i) => {
          if (!dateStr) return <span key={i} />
          const day = Number(dateStr.split('-')[2])
          const isToday = dateStr === todayStr
          const marker = markers[dateStr]
          return (
            <div key={i} className="flex flex-col items-center gap-1 py-0.5">
              <span
                className={cn(
                  'w-6 h-6 flex items-center justify-center rounded-full text-[11px] transition-colors',
                  isToday ? 'bg-primary text-primary-foreground font-medium' : 'text-foreground/70'
                )}
              >
                {day}
              </span>
              <span className="flex items-center gap-0.5 h-1">
                {marker?.event && <span className="w-1 h-1 rounded-full bg-drivn-green" />}
                {marker?.task && <span className="w-1 h-1 rounded-full bg-amber-400" />}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
          <span className="w-1.5 h-1.5 rounded-full bg-drivn-green" /> Event
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Task due
        </span>
      </div>
    </div>
  )
}
