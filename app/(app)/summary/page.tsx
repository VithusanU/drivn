'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isToday, addMonths, subMonths, isSameDay, parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface DayData {
  habits: number
  tasks: number
}

// Mon–Sun week order
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function mondayOffset(date: Date): number {
  // getDay: 0=Sun…6=Sat → shift so Mon=0…Sun=6
  return (getDay(date) + 6) % 7
}

function activityLevel(d: DayData): 0 | 1 | 2 | 3 {
  const total = d.habits + d.tasks
  if (total === 0) return 0
  if (total <= 2) return 1
  if (total <= 5) return 2
  return 3
}

const LEVEL_BG: Record<0 | 1 | 2 | 3, string> = {
  0: '',
  1: 'bg-primary/10 border-primary/20',
  2: 'bg-primary/20 border-primary/35',
  3: 'bg-primary/35 border-primary/50',
}

export default function SummaryPage() {
  const [month, setMonth] = useState(() => new Date())
  const [dayData, setDayData] = useState<Record<string, DayData>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMonth = useCallback(async (m: Date) => {
    setLoading(true)
    setSelected(null)
    const supabase = createClient()
    const start = format(startOfMonth(m), 'yyyy-MM-dd')
    const end = format(endOfMonth(m), 'yyyy-MM-dd')

    const [{ data: habitRows }, { data: taskRows }] = await Promise.all([
      supabase
        .from('habit_completions')
        .select('completed_date')
        .gte('completed_date', start)
        .lte('completed_date', end),
      supabase
        .from('tasks')
        .select('completed_at')
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth(m).toISOString())
        .lte('completed_at', endOfMonth(m).toISOString())
        .not('completed_at', 'is', null),
    ])

    const data: Record<string, DayData> = {}

    for (const row of habitRows ?? []) {
      const key = row.completed_date as string
      if (!data[key]) data[key] = { habits: 0, tasks: 0 }
      data[key].habits++
    }
    for (const row of taskRows ?? []) {
      const key = format(new Date(row.completed_at as string), 'yyyy-MM-dd')
      if (!data[key]) data[key] = { habits: 0, tasks: 0 }
      data[key].tasks++
    }

    setDayData(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchMonth(month) }, [month, fetchMonth])

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const leadingBlanks = mondayOffset(days[0])

  const totalHabits = Object.values(dayData).reduce((s, d) => s + d.habits, 0)
  const totalTasks = Object.values(dayData).reduce((s, d) => s + d.tasks, 0)
  const activeDays = Object.values(dayData).filter((d) => d.habits + d.tasks > 0).length

  const selectedData = selected ? (dayData[selected] ?? { habits: 0, tasks: 0 }) : null

  return (
    <div className="px-4 pt-6 pb-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-medium text-foreground">Summary</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Your activity at a glance</p>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="p-2 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[15px] font-medium text-foreground">
          {format(month, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="p-2 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Month totals */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="Active days" value={activeDays} color="text-primary" />
        <StatCard label="Habits logged" value={totalHabits} color="text-drivn-green" />
        <StatCard label="Tasks done" value={totalTasks} color="text-primary" />
      </div>

      {/* Calendar grid */}
      <div>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((d) => (
            <p key={d} className="text-center text-[10px] font-medium text-muted-foreground/50 py-1">
              {d}
            </p>
          ))}
        </div>

        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* Leading blank cells */}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}

            {/* Day cells */}
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const data = dayData[key] ?? { habits: 0, tasks: 0 }
              const level = activityLevel(data)
              const isSelected = selected === key
              const today = isToday(day)

              return (
                <button
                  key={key}
                  onClick={() => setSelected(isSelected ? null : key)}
                  className={cn(
                    'relative flex flex-col items-center justify-start pt-1.5 pb-1 rounded-xl border transition-all',
                    'aspect-square',
                    level > 0 ? LEVEL_BG[level] : 'border-transparent hover:border-border hover:bg-secondary/50',
                    isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                    today && !isSelected && 'border-primary/40'
                  )}
                >
                  <span className={cn(
                    'text-[11px] font-medium leading-none',
                    today ? 'text-primary' : level > 0 ? 'text-foreground' : 'text-muted-foreground/60'
                  )}>
                    {format(day, 'd')}
                  </span>

                  {/* Activity dots */}
                  {(data.habits > 0 || data.tasks > 0) && (
                    <div className="flex gap-0.5 mt-1">
                      {data.habits > 0 && (
                        <span className="w-1 h-1 rounded-full bg-drivn-green" />
                      )}
                      {data.tasks > 0 && (
                        <span className="w-1 h-1 rounded-full bg-primary" />
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 justify-center">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-drivn-green" />
            <span className="text-[11px] text-muted-foreground/60">Habits</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[11px] text-muted-foreground/60">Tasks</span>
          </div>
        </div>
      </div>

      {/* Selected day detail */}
      {selected && selectedData && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-[13px] font-medium text-foreground">
            {format(parseISO(selected), 'EEEE, MMMM d')}
          </p>
          {selectedData.habits === 0 && selectedData.tasks === 0 ? (
            <p className="text-[13px] text-muted-foreground/50">No activity logged this day.</p>
          ) : (
            <div className="flex gap-4">
              {selectedData.habits > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-drivn-green flex-shrink-0" />
                  <span className="text-[13px] text-foreground">
                    {selectedData.habits} habit{selectedData.habits !== 1 ? 's' : ''} logged
                  </span>
                </div>
              )}
              {selectedData.tasks > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-[13px] text-foreground">
                    {selectedData.tasks} task{selectedData.tasks !== 1 ? 's' : ''} completed
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3">
      <p className="text-[10px] text-muted-foreground/60 mb-1">{label}</p>
      <p className={cn('text-2xl font-semibold', color)}>{value}</p>
    </div>
  )
}
