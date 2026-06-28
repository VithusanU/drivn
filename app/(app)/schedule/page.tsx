'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { format } from 'date-fns'
import { RefreshCw, Sparkles, Lock, CalendarOff, CheckCircle2, Circle, Coffee, ArrowRight } from 'lucide-react'
import { useUserStore } from '@/stores/userStore'
import { useTaskStore } from '@/stores/taskStore'
import { useEventStore } from '@/stores/eventStore'
import { useContextStore } from '@/stores/contextStore'
import DayContext from '@/components/dashboard/DayContext'
import { formatEstimatedTime } from '@/lib/engine/recommendation'
import { cn } from '@/lib/utils'
import type { ScheduleBlock } from '@/types'

const EVENT_CATEGORY_EMOJI: Record<string, string> = {
  appointment: '🏥',
  maintenance: '🔧',
  personal: '🙂',
  health: '💊',
  other: '📌',
}

const AI_TRIAL_DAYS = 7

function formatBlockTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Returns true if a recurring event should appear on the given date
function eventFallsOnDate(
  event: { event_date: string; recurrence: string; recurrence_days: number | null },
  dateStr: string
): boolean {
  if (event.recurrence === 'none') return event.event_date === dateStr
  if (dateStr < event.event_date) return false
  if (event.event_date === dateStr) return true
  const [by, bm, bd] = event.event_date.split('-').map(Number)
  const [ty, tm, td] = dateStr.split('-').map(Number)
  const base = new Date(by, bm - 1, bd)
  const target = new Date(ty, tm - 1, td)
  const diffDays = Math.round((target.getTime() - base.getTime()) / 86400000)
  if (event.recurrence === 'weekly') return diffDays % 7 === 0
  if (event.recurrence === 'custom' && event.recurrence_days) return diffDays % event.recurrence_days === 0
  if (event.recurrence === 'monthly') {
    if (base.getDate() !== target.getDate()) return false
    const check = new Date(base)
    while (check < target) check.setMonth(check.getMonth() + 1)
    return check.getTime() === target.getTime()
  }
  return false
}

// Today + next 6 days, as "YYYY-MM-DD" local-date strings
function getWeekDates(): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return dates
}

export default function SchedulePage() {
  const profile = useUserStore((s) => s.profile)
  const fetchProfile = useUserStore((s) => s.fetchProfile)
  const blockedDates = useUserStore((s) => s.blockedDates)
  const fetchBlockedDates = useUserStore((s) => s.fetchBlockedDates)

  const updateStreak = useUserStore((s) => s.updateStreak)

  const tasks = useTaskStore((s) => s.tasks)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const hasFetchedTasks = useTaskStore((s) => s.hasFetched)
  const completeTask = useTaskStore((s) => s.completeTask)

  const events = useEventStore((s) => s.events)
  const fetchEvents = useEventStore((s) => s.fetchEvents)
  const hasFetchedEvents = useEventStore((s) => s.hasFetched)

  const contextText = useContextStore((s) => s.contextText)
  const hydrateContext = useContextStore((s) => s.hydrate)

  const [blocks, setBlocks] = useState<ScheduleBlock[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [viewMode, setViewMode] = useState<'today' | 'week'>('today')
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())

  const hasBetaAccess = profile?.beta_access === true
  const hasOwnKey = !!profile?.anthropic_key_masked
  const isInTrial = profile?.created_at
    ? (Date.now() - new Date(profile.created_at).getTime()) < AI_TRIAL_DAYS * 24 * 60 * 60 * 1000
    : false
  const canUseAI = hasBetaAccess || hasOwnKey || isInTrial

  useEffect(() => {
    fetchProfile()
    fetchBlockedDates()
    fetchTasks()
    fetchEvents()
    hydrateContext()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayISO()
  const todayDay = new Date().getDay()
  const workDays = profile?.work_days ?? [0, 1, 2, 3, 4, 5, 6]
  const isBlockedDate = blockedDates.some((d) => d.blocked_date === today)
  const isDayOff = !workDays.includes(todayDay) || isBlockedDate

  const generateSchedule = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)
    try {
      const activeTasks = tasks.filter((t) => t.status === 'active')
      const todaysEvents = events.filter((e) => eventFallsOnDate(e, today))
      const res = await fetch('/api/ai-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: activeTasks,
          events: todaysEvents,
          now: nowHHMM(),
          workEndTime: (profile.work_end_time ?? '18:00').slice(0, 5),
          context: contextText || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Could not generate your schedule')
      }
      const data = await res.json()
      setBlocks(data.blocks ?? [])
      setNotes(data.notes ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setHasGenerated(true)
    }
  }, [profile, tasks, events, today, contextText])

  // Auto-generate once profile + tasks + events have loaded
  useEffect(() => {
    if (canUseAI && !isDayOff && !hasGenerated && profile && hasFetchedTasks && hasFetchedEvents) {
      generateSchedule()
    }
  }, [canUseAI, isDayOff, hasGenerated, profile, hasFetchedTasks, hasFetchedEvents, generateSchedule])

  // Re-plan whenever the user updates today's context (e.g. "convocation 12:30-4pm")
  useEffect(() => {
    if (canUseAI && !isDayOff && hasGenerated) {
      generateSchedule()
    }
  }, [contextText]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCompleteTask = async (taskId: string) => {
    setCompletingIds((prev) => new Set(prev).add(taskId))
    await completeTask(taskId)
    await updateStreak()
    setTimeout(() => {
      setBlocks((prev) => prev.filter((b) => b.id !== taskId))
    }, 400)
  }

  return (
    <div className="px-4 pt-6 pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-medium text-foreground">Schedule</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {format(new Date(), 'EEEE, MMM d')}
          </p>
        </div>
        {canUseAI && !isDayOff && (
          <button
            onClick={generateSchedule}
            disabled={loading}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium',
              'bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors',
              'disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        )}
      </div>

      {/* View toggle */}
      {canUseAI && (
        <div className="flex gap-1 p-1 rounded-xl bg-secondary/40 w-fit">
          {(['today', 'week'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
                viewMode === mode
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {mode === 'today' ? 'Today' : 'This week'}
            </button>
          ))}
        </div>
      )}

      {/* Day context — feeds into the AI schedule */}
      {canUseAI && viewMode === 'today' && !isDayOff && <DayContext />}

      {/* Locked: AI-only feature */}
      {!canUseAI && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Schedule is an AI feature</p>
          <p className="text-[13px] text-muted-foreground max-w-[280px] mx-auto leading-relaxed mb-4">
            Your free trial has ended. Add your own Anthropic API key in Profile to unlock AI-powered
            day planning, or request beta access.
          </p>
          <Link
            href="/profile"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium',
              'bg-primary text-primary-foreground transition-all active:scale-[0.97] hover:bg-primary/90'
            )}
          >
            Go to Profile
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Day off */}
      {canUseAI && viewMode === 'today' && isDayOff && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-secondary/60 flex items-center justify-center mx-auto mb-3">
            <CalendarOff className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Day off</p>
          <p className="text-[13px] text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
            {isBlockedDate
              ? "You've blocked out today as a day off — no schedule needed."
              : "Today isn't one of your work days."}
            {' '}You can change this in Profile.
          </p>
        </div>
      )}

      {/* Loading skeleton (first load only) */}
      {canUseAI && viewMode === 'today' && !isDayOff && loading && blocks.length === 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3 h-3 text-primary/60 animate-pulse" />
            <p className="text-[11px] font-medium text-primary/60">Planning your day…</p>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-secondary/40 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {canUseAI && viewMode === 'today' && !isDayOff && error && (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5 text-center">
          <p className="text-sm font-medium text-destructive mb-1">Couldn&apos;t build your schedule</p>
          <p className="text-[12px] text-muted-foreground mb-3">{error}</p>
          <button
            onClick={generateSchedule}
            className="text-[12px] font-medium text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {canUseAI && viewMode === 'today' && !isDayOff && !loading && !error && hasGenerated && blocks.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="text-2xl mb-2">✨</div>
          <p className="text-sm font-medium text-foreground">Nothing to schedule</p>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-[240px] mx-auto leading-relaxed">
            No events or tasks left for today — enjoy the open time.
          </p>
        </div>
      )}

      {/* Timeline */}
      {canUseAI && viewMode === 'today' && !isDayOff && blocks.length > 0 && (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {blocks.map((block, i) => (
              <motion.div
                key={`${block.id ?? 'free'}-${block.start}-${i}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-3 rounded-xl border',
                  block.type === 'event' && 'bg-card/50 border-border/50',
                  block.type === 'task' && 'bg-card/50 border-border/50',
                  block.type === 'free' && 'border-dashed border-border/40 bg-transparent'
                )}
              >
                <div className="flex-shrink-0 w-[72px] text-[11px] text-muted-foreground/60 leading-tight">
                  <div>{formatBlockTime(block.start)}</div>
                  <div className="text-muted-foreground/30">{formatBlockTime(block.end)}</div>
                </div>

                {block.type === 'task' ? (
                  <button
                    onClick={() => block.id && handleCompleteTask(block.id)}
                    className={cn(
                      'flex-shrink-0 transition-colors',
                      block.id && completingIds.has(block.id)
                        ? 'text-drivn-green'
                        : 'text-muted-foreground/40 hover:text-drivn-green'
                    )}
                    aria-label="Mark task complete"
                  >
                    {block.id && completingIds.has(block.id)
                      ? <CheckCircle2 className="w-4.5 h-4.5" />
                      : <Circle className="w-4.5 h-4.5" />}
                  </button>
                ) : block.type === 'event' ? (
                  <span className="flex-shrink-0 text-base">
                    {EVENT_CATEGORY_EMOJI[block.category ?? 'other'] ?? '📌'}
                  </span>
                ) : (
                  <Coffee className="flex-shrink-0 w-4 h-4 text-muted-foreground/30" />
                )}

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-[13px] font-medium truncate',
                    block.type === 'free' ? 'text-muted-foreground/50' : 'text-foreground',
                    block.id && completingIds.has(block.id) && 'line-through text-muted-foreground/40'
                  )}>
                    {block.title}
                  </p>
                  {block.type === 'event' && (
                    <p className="text-[11px] text-muted-foreground/40 mt-0.5">Fixed event</p>
                  )}
                </div>

                {(() => {
                  const [sh, sm] = block.start.split(':').map(Number)
                  const [eh, em] = block.end.split(':').map(Number)
                  const minutes = (eh * 60 + em) - (sh * 60 + sm)
                  const label = formatEstimatedTime(minutes > 0 ? minutes : null)
                  return label ? (
                    <span className="flex-shrink-0 text-[11px] text-muted-foreground/40">{label}</span>
                  ) : null
                })()}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* AI notes */}
      {canUseAI && viewMode === 'today' && !isDayOff && notes.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-primary/60" />
            <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-primary/60">Notes</p>
          </div>
          {notes.map((note, i) => (
            <p key={i} className="text-[12px] text-foreground/70 leading-relaxed">{note}</p>
          ))}
        </div>
      )}

      {/* Completed-all-tasks indicator */}
      {canUseAI && viewMode === 'today' && !isDayOff && hasGenerated && blocks.length > 0 && !blocks.some((b) => b.type === 'task') && (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground/60">
          <CheckCircle2 className="w-3.5 h-3.5" />
          No tasks slotted in — just your calendar today.
        </div>
      )}

      {/* Week view */}
      {canUseAI && viewMode === 'week' && (
        <div className="space-y-2.5">
          {getWeekDates().map((dateStr, i) => {
            const [y, m, d] = dateStr.split('-').map(Number)
            const dateObj = new Date(y, m - 1, d)
            const dayOfWeek = dateObj.getDay()
            const dayOff = !workDays.includes(dayOfWeek) || blockedDates.some((b) => b.blocked_date === dateStr)

            const dayEvents = events.filter((e) => eventFallsOnDate(e, dateStr))
            const dayTasks = tasks.filter((t) => t.status === 'active' && t.due_date === dateStr)

            const items = [
              ...dayEvents.map((e) => ({
                kind: 'event' as const,
                id: e.id,
                time: e.event_time,
                title: e.title,
                category: e.category as string | null,
                minutes: null as number | null,
              })),
              ...dayTasks.map((t) => ({
                kind: 'task' as const,
                id: t.id,
                time: t.due_time,
                title: t.title,
                category: null as string | null,
                minutes: t.estimated_minutes,
              })),
            ].sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))

            return (
              <div key={dateStr} className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                  <p className="text-[12px] font-medium text-foreground">
                    {i === 0 ? 'Today' : format(dateObj, 'EEEE')}
                    <span className="text-muted-foreground/40 ml-1.5">{format(dateObj, 'MMM d')}</span>
                  </p>
                  {dayOff && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary/60 text-muted-foreground/50">
                      Day off
                    </span>
                  )}
                </div>
                {items.length === 0 ? (
                  <p className="px-4 py-3 text-[12px] text-muted-foreground/40">Nothing scheduled</p>
                ) : (
                  <div className="divide-y divide-border/30">
                    {items.map((item) => (
                      <div key={`${item.kind}-${item.id}`} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="flex-shrink-0 w-[68px] text-[11px] text-muted-foreground/50">
                          {item.time ? formatBlockTime(item.time) : '—'}
                        </span>
                        {item.kind === 'task' ? (
                          <button
                            onClick={() => handleCompleteTask(item.id)}
                            className={cn(
                              'flex-shrink-0 transition-colors',
                              completingIds.has(item.id)
                                ? 'text-drivn-green'
                                : 'text-muted-foreground/40 hover:text-drivn-green'
                            )}
                            aria-label="Mark task complete"
                          >
                            {completingIds.has(item.id)
                              ? <CheckCircle2 className="w-4 h-4" />
                              : <Circle className="w-4 h-4" />}
                          </button>
                        ) : (
                          <span className="flex-shrink-0 text-base">
                            {EVENT_CATEGORY_EMOJI[item.category ?? 'other'] ?? '📌'}
                          </span>
                        )}
                        <span className={cn(
                          'text-[13px] truncate flex-1',
                          completingIds.has(item.id) ? 'line-through text-muted-foreground/40' : 'text-foreground'
                        )}>
                          {item.title}
                        </span>
                        {item.minutes && (
                          <span className="flex-shrink-0 text-[11px] text-muted-foreground/40">
                            {formatEstimatedTime(item.minutes)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
