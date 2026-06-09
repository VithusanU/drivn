'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isToday, addMonths, subMonths, parseISO,
  startOfWeek, endOfWeek, subWeeks,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Clock, TrendingUp, Flame, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface DayData {
  habits: number
  tasks: number
  eventEmojis: string[]
}

interface FocusSession {
  id: string
  task_title: string
  minutes_logged: number
  started_at: string
}

interface WeeklyInsight {
  tasksThisWeek: number
  tasksLastWeek: number
  habitStreakDays: number
  mostProductiveDay: string | null
  mostProductiveDateStr: string | null
  focusMinutesThisWeek: number
}

interface DailyInsight {
  tasksToday: number
  focusMinutesToday: number
  habitsToday: number
}

interface AllTimeStats {
  totalFocusMinutes: number
  totalSessions: number
  totalTasksCompleted: number
  longestFocusStreakDays: number
}

// Mon–Sun week order
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const CATEGORY_EMOJI: Record<string, string> = {
  appointment: '🏥',
  maintenance: '🔧',
  personal: '🙂',
  health: '💊',
  other: '📌',
}

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
  const [weeklyInsight, setWeeklyInsight] = useState<WeeklyInsight | null>(null)
  const [dailyInsight, setDailyInsight] = useState<DailyInsight | null>(null)
  const [recentSessions, setRecentSessions] = useState<FocusSession[]>([])
  const [sessionPage, setSessionPage] = useState(1)
  const [allTimeStats, setAllTimeStats] = useState<AllTimeStats | null>(null)
  const [statsView, setStatsView] = useState<'today' | 'week'>('today')

  const fetchWeeklyInsights = useCallback(async () => {
    const supabase = createClient()
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const lastWeekStart = format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const lastWeekEnd = format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd')

    const [
      { data: thisWeekTasks },
      { data: lastWeekTasks },
      // Separate queries: all focus minutes this week (no limit) + recent 5 for display
      { data: allWeekSessions },
      { data: recentFive },
      // Daily stats
      { data: todayTasks },
      { data: todaySessions },
      { data: todayHabits },
      // All-time stats
      { data: allTimeSessions },
      { count: allTimeTaskCount },
    ] = await Promise.all([
      supabase.from('tasks').select('completed_at').eq('status', 'completed')
        .gte('completed_at', `${weekStart}T00:00:00`).lte('completed_at', `${weekEnd}T23:59:59`),
      supabase.from('tasks').select('completed_at').eq('status', 'completed')
        .gte('completed_at', `${lastWeekStart}T00:00:00`).lte('completed_at', `${lastWeekEnd}T23:59:59`),
      // All sessions this week — no limit so total is accurate
      supabase.from('focus_sessions').select('minutes_logged')
        .gte('started_at', `${weekStart}T00:00:00`),
      // All-time sessions for history list (last 50)
      supabase.from('focus_sessions').select('*')
        .order('started_at', { ascending: false }).limit(50),
      // Today's tasks
      supabase.from('tasks').select('id').eq('status', 'completed')
        .gte('completed_at', `${todayStr}T00:00:00`).lte('completed_at', `${todayStr}T23:59:59`),
      // Today's focus sessions
      supabase.from('focus_sessions').select('minutes_logged')
        .gte('started_at', `${todayStr}T00:00:00`).lte('started_at', `${todayStr}T23:59:59`),
      // Today's habits
      supabase.from('habit_completions').select('id').eq('completed_date', todayStr),
      // All-time focus sessions (minutes + started_at for streak calc)
      supabase.from('focus_sessions').select('minutes_logged, started_at').order('started_at', { ascending: true }),
      // All-time tasks completed
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    ])

    // Most productive day this week
    const dayCount: Record<string, number> = {}
    for (const row of thisWeekTasks ?? []) {
      const dateStr = format(new Date(row.completed_at), 'yyyy-MM-dd')
      dayCount[dateStr] = (dayCount[dateStr] ?? 0) + 1
    }
    const bestEntry = Object.keys(dayCount).length > 0
      ? Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]
      : null
    const mostProductiveDateStr = bestEntry ? bestEntry[0] : null
    const mostProductiveDay = mostProductiveDateStr
      ? format(parseISO(mostProductiveDateStr), 'EEEE')
      : null

    const focusMinutesWeek = (allWeekSessions ?? []).reduce((s: number, f: any) => s + (f.minutes_logged ?? 0), 0)
    const focusMinutesToday = (todaySessions ?? []).reduce((s: number, f: any) => s + (f.minutes_logged ?? 0), 0)

    setWeeklyInsight({
      tasksThisWeek: thisWeekTasks?.length ?? 0,
      tasksLastWeek: lastWeekTasks?.length ?? 0,
      habitStreakDays: 0,
      mostProductiveDay,
      mostProductiveDateStr,
      focusMinutesThisWeek: focusMinutesWeek,
    })
    setDailyInsight({
      tasksToday: todayTasks?.length ?? 0,
      focusMinutesToday,
      habitsToday: todayHabits?.length ?? 0,
    })
    setRecentSessions((recentFive ?? []) as FocusSession[])
    setSessionPage(1)

    // All-time stats
    const totalFocusMinutes = (allTimeSessions ?? []).reduce((s: number, f: any) => s + (f.minutes_logged ?? 0), 0)
    const totalSessions = (allTimeSessions ?? []).length

    // Calculate longest consecutive daily focus streak
    const focusDays = new Set<string>(
      (allTimeSessions ?? []).map((f: any) => format(new Date(f.started_at), 'yyyy-MM-dd'))
    )
    const sortedDays = Array.from(focusDays).sort()
    let longestStreak = 0
    let currentStreak = 0
    for (let i = 0; i < sortedDays.length; i++) {
      if (i === 0) {
        currentStreak = 1
      } else {
        const prev = new Date(sortedDays[i - 1])
        const curr = new Date(sortedDays[i])
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000)
        if (diffDays === 1) {
          currentStreak++
        } else {
          currentStreak = 1
        }
      }
      longestStreak = Math.max(longestStreak, currentStreak)
    }

    setAllTimeStats({
      totalFocusMinutes,
      totalSessions,
      totalTasksCompleted: allTimeTaskCount ?? 0,
      longestFocusStreakDays: longestStreak,
    })
  }, [])

  const fetchMonth = useCallback(async (m: Date) => {
    setLoading(true)
    setSelected(null)
    const supabase = createClient()
    const start = format(startOfMonth(m), 'yyyy-MM-dd')
    const end = format(endOfMonth(m), 'yyyy-MM-dd')

    const [{ data: habitRows }, { data: taskRows }, { data: eventRows }] = await Promise.all([
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
      supabase
        .from('events')
        .select('event_date, category')
        .gte('event_date', start)
        .lte('event_date', end),
    ])

    const data: Record<string, DayData> = {}

    for (const row of habitRows ?? []) {
      const key = row.completed_date as string
      if (!data[key]) data[key] = { habits: 0, tasks: 0, eventEmojis: [] }
      data[key].habits++
    }
    for (const row of taskRows ?? []) {
      const key = format(new Date(row.completed_at as string), 'yyyy-MM-dd')
      if (!data[key]) data[key] = { habits: 0, tasks: 0, eventEmojis: [] }
      data[key].tasks++
    }
    for (const row of eventRows ?? []) {
      const key = row.event_date as string
      if (!data[key]) data[key] = { habits: 0, tasks: 0, eventEmojis: [] }
      const emoji = CATEGORY_EMOJI[row.category as string] ?? '📌'
      if (!data[key].eventEmojis.includes(emoji)) {
        data[key].eventEmojis.push(emoji)
      }
    }

    setDayData(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchMonth(month) }, [month, fetchMonth])
  useEffect(() => { fetchWeeklyInsights() }, [fetchWeeklyInsights])

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const leadingBlanks = mondayOffset(days[0])

  const totalHabits = Object.values(dayData).reduce((s, d) => s + d.habits, 0)
  const totalTasks = Object.values(dayData).reduce((s, d) => s + d.tasks, 0)
  const activeDays = Object.values(dayData).filter((d) => d.habits + d.tasks > 0).length

  const selectedData = selected ? (dayData[selected] ?? { habits: 0, tasks: 0, eventEmojis: [] }) : null

  return (
    <div className="px-4 pt-6 pb-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-medium text-foreground">Summary</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Your activity at a glance</p>
      </div>

      {/* Stats toggle */}
      {(weeklyInsight || dailyInsight) && (
        <div>
          {/* Day / Week toggle */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex rounded-xl border border-border bg-secondary p-0.5 gap-0.5">
              {(['today', 'week'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setStatsView(v)}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-[12px] font-medium transition-all',
                    statsView === v
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {v === 'today' ? 'Today' : 'This week'}
                </button>
              ))}
            </div>
          </div>

          {/* Today stats */}
          {statsView === 'today' && dailyInsight && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="w-3 h-3 text-primary/60" />
                  <p className="text-[10px] text-muted-foreground/60">Tasks done</p>
                </div>
                <p className="text-2xl font-semibold text-primary">{dailyInsight.tasksToday}</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">today</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3 h-3 text-primary/60" />
                  <p className="text-[10px] text-muted-foreground/60">Focus time</p>
                </div>
                <p className="text-2xl font-semibold text-primary">
                  {dailyInsight.focusMinutesToday < 60
                    ? `${dailyInsight.focusMinutesToday}m`
                    : `${Math.floor(dailyInsight.focusMinutesToday / 60)}h${dailyInsight.focusMinutesToday % 60 ? ` ${dailyInsight.focusMinutesToday % 60}m` : ''}`}
                </p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">today</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3.5 col-span-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Flame className="w-3 h-3 text-amber-400/70" />
                  <p className="text-[10px] text-muted-foreground/60">Habits logged</p>
                </div>
                <p className="text-2xl font-semibold text-drivn-green">{dailyInsight.habitsToday}</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">today</p>
              </div>
            </div>
          )}

          {/* Week stats */}
          {statsView === 'week' && weeklyInsight && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="w-3 h-3 text-primary/60" />
                  <p className="text-[10px] text-muted-foreground/60">Tasks done</p>
                </div>
                <p className="text-2xl font-semibold text-primary">{weeklyInsight.tasksThisWeek}</p>
                {weeklyInsight.tasksLastWeek > 0 && (
                  <p className={cn(
                    'text-[11px] mt-0.5',
                    weeklyInsight.tasksThisWeek >= weeklyInsight.tasksLastWeek
                      ? 'text-drivn-green/70' : 'text-muted-foreground/50'
                  )}>
                    {weeklyInsight.tasksThisWeek >= weeklyInsight.tasksLastWeek ? '↑' : '↓'} vs {weeklyInsight.tasksLastWeek} last week
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3 h-3 text-primary/60" />
                  <p className="text-[10px] text-muted-foreground/60">Focus time</p>
                </div>
                <p className="text-2xl font-semibold text-primary">
                  {weeklyInsight.focusMinutesThisWeek < 60
                    ? `${weeklyInsight.focusMinutesThisWeek}m`
                    : `${Math.floor(weeklyInsight.focusMinutesThisWeek / 60)}h${weeklyInsight.focusMinutesThisWeek % 60 ? ` ${weeklyInsight.focusMinutesThisWeek % 60}m` : ''}`}
                </p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">this week</p>
              </div>
              {weeklyInsight.mostProductiveDay && (
                <div className="rounded-xl border border-border bg-card p-3.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Flame className="w-3 h-3 text-amber-400/70" />
                    <p className="text-[10px] text-muted-foreground/60">Best day</p>
                  </div>
                  <p className="text-[15px] font-semibold text-foreground">{weeklyInsight.mostProductiveDay}</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">most tasks done</p>
                </div>
              )}
              <div className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3 h-3 text-primary/60" />
                  <p className="text-[10px] text-muted-foreground/60">Trend</p>
                </div>
                <p className="text-[15px] font-semibold text-foreground">
                  {weeklyInsight.tasksThisWeek === 0
                    ? 'Getting started'
                    : weeklyInsight.tasksThisWeek > weeklyInsight.tasksLastWeek
                      ? 'On the rise 🔥'
                      : weeklyInsight.tasksThisWeek === weeklyInsight.tasksLastWeek
                        ? 'Steady pace' : 'Room to grow'}
                </p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">vs last week</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* All-time stats */}
      {allTimeStats && (allTimeStats.totalSessions > 0 || allTimeStats.totalTasksCompleted > 0) && (
        <div>
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3">
            All time
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3 h-3 text-primary/60" />
                <p className="text-[10px] text-muted-foreground/60">Total focus</p>
              </div>
              <p className="text-2xl font-semibold text-primary">
                {allTimeStats.totalFocusMinutes < 60
                  ? `${allTimeStats.totalFocusMinutes}m`
                  : `${Math.floor(allTimeStats.totalFocusMinutes / 60)}h${allTimeStats.totalFocusMinutes % 60 ? ` ${allTimeStats.totalFocusMinutes % 60}m` : ''}`}
              </p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">{allTimeStats.totalSessions} sessions</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3 h-3 text-primary/60" />
                <p className="text-[10px] text-muted-foreground/60">Tasks done</p>
              </div>
              <p className="text-2xl font-semibold text-primary">{allTimeStats.totalTasksCompleted}</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">all time</p>
            </div>
            {allTimeStats.longestFocusStreakDays > 1 && (
              <div className="rounded-xl border border-border bg-card p-3.5 col-span-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Flame className="w-3 h-3 text-amber-400/70" />
                  <p className="text-[10px] text-muted-foreground/60">Longest focus streak</p>
                </div>
                <p className="text-2xl font-semibold text-amber-400">{allTimeStats.longestFocusStreakDays}</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">consecutive days with a session</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Focus session history */}
      {recentSessions.length > 0 && (
        <div>
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3">
            Focus history
          </p>
          <div className="space-y-2">
            {recentSessions.slice(0, sessionPage * 10).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-3.5 py-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] text-foreground truncate">{session.task_title}</p>
                    <p className="text-[11px] text-muted-foreground/50">
                      {format(new Date(session.started_at), 'EEE, MMM d · h:mm a')}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  'text-[12px] font-medium flex-shrink-0 ml-3',
                  session.minutes_logged >= 25 ? 'text-drivn-green/80' : 'text-primary/70'
                )}>
                  {session.minutes_logged}m
                </span>
              </div>
            ))}
          </div>
          {recentSessions.length > sessionPage * 10 && (
            <button
              onClick={() => setSessionPage((p) => p + 1)}
              className="w-full mt-2 py-2.5 rounded-xl border border-border text-[12px] text-muted-foreground/60 hover:text-foreground hover:border-border/80 transition-colors"
            >
              Show more ({recentSessions.length - sessionPage * 10} remaining)
            </button>
          )}
        </div>
      )}

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
              const data = dayData[key] ?? { habits: 0, tasks: 0, eventEmojis: [] }
              const level = activityLevel(data)
              const isSelected = selected === key
              const today = isToday(day)
              const isBestDay = weeklyInsight?.mostProductiveDateStr === key
              const firstEmoji = data.eventEmojis[0] ?? null

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
                  {/* Best day star badge */}
                  {isBestDay && (
                    <span className="absolute -top-1 -right-1 text-[9px] leading-none pointer-events-none">⭐</span>
                  )}

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

                  {/* Event category emoji */}
                  {firstEmoji && (
                    <span className="text-[8px] leading-none mt-0.5">{firstEmoji}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 justify-center flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-drivn-green" />
            <span className="text-[11px] text-muted-foreground/60">Habits</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[11px] text-muted-foreground/60">Tasks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] leading-none">📅</span>
            <span className="text-[11px] text-muted-foreground/60">Events</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] leading-none">⭐</span>
            <span className="text-[11px] text-muted-foreground/60">Best day</span>
          </div>
        </div>
      </div>

      {/* Selected day detail */}
      {selected && selectedData && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-[13px] font-medium text-foreground">
            {format(parseISO(selected), 'EEEE, MMMM d')}
          </p>
          {selectedData.habits === 0 && selectedData.tasks === 0 && selectedData.eventEmojis.length === 0 ? (
            <p className="text-[13px] text-muted-foreground/50">No activity logged this day.</p>
          ) : (
            <div className="flex gap-4 flex-wrap">
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
              {selectedData.eventEmojis.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[14px] leading-none">{selectedData.eventEmojis.join(' ')}</span>
                  <span className="text-[13px] text-foreground">
                    {selectedData.eventEmojis.length} event{selectedData.eventEmojis.length !== 1 ? 's' : ''}
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
