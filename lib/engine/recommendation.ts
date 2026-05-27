import { isAfter, isBefore, addHours, addDays, parseISO } from 'date-fns'
import type { Task, RecommendedTask, RecommendationReason, TaskGroup } from '@/types'

// ─── Scoring weights ─────────────────────────────────────────────────────────
const WEIGHTS = {
  overdue: 1000,
  due_today: 500,
  due_soon: 200,        // within 24h
  high_urgency: 150,
  recently_active: 100, // engaged within last 4h
  medium_urgency: 50,
  low_urgency: 0,
}

const URGENCY_SCORES: Record<Task['urgency'], number> = {
  high: WEIGHTS.high_urgency,
  medium: WEIGHTS.medium_urgency,
  low: WEIGHTS.low_urgency,
}

// ─── Score a single task ──────────────────────────────────────────────────────
function scoreTask(task: Task, now: Date): { score: number; reason: RecommendationReason } {
  let score = 0
  let reason: RecommendationReason = 'high_urgency'

  const lastEngaged = task.last_engaged_at ? parseISO(task.last_engaged_at) : null

  if (task.due_date) {
    const hasTime = !!task.due_time
    const effectiveDue = hasTime
      ? parseISO(`${task.due_date}T${task.due_time}`)
      : parseISO(task.due_date)

    if (hasTime) {
      // Precise time-aware scoring: compare exact datetime
      if (isBefore(effectiveDue, now)) {
        score += WEIGHTS.overdue
        reason = 'overdue'
        const hoursOverdue = Math.min((now.getTime() - effectiveDue.getTime()) / 3_600_000, 24)
        score += hoursOverdue * 10
      } else {
        const minsUntil = (effectiveDue.getTime() - now.getTime()) / 60_000
        score += WEIGHTS.due_today
        reason = 'due_today'
        // Tiered boost: closer deadline = higher priority
        if (minsUntil <= 60) score += 300
        else if (minsUntil <= 120) score += 200
        else if (minsUntil <= 240) score += 100
      }
    } else {
      // Date-only: overdue only if before today (not just before now)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      if (isBefore(effectiveDue, todayStart)) {
        score += WEIGHTS.overdue
        reason = 'overdue'
        const hoursOverdue = Math.min((now.getTime() - effectiveDue.getTime()) / 3_600_000, 24)
        score += hoursOverdue * 10
      } else if (isBefore(effectiveDue, addHours(now, 8))) {
        score += WEIGHTS.due_today
        reason = 'due_today'
      } else if (isBefore(effectiveDue, addHours(now, 24))) {
        score += WEIGHTS.due_soon
        reason = 'due_soon'
      }
    }
  }

  // Urgency modifier
  score += URGENCY_SCORES[task.urgency]
  if (reason === 'high_urgency') {
    reason = task.urgency === 'high' ? 'high_urgency' : 'high_urgency'
  }

  // Recently active boost
  if (lastEngaged && isAfter(lastEngaged, addHours(now, -4))) {
    score += WEIGHTS.recently_active
    if (score < WEIGHTS.due_today) reason = 'recently_active'
  }

  return { score, reason }
}

// ─── Main recommendation function ────────────────────────────────────────────
export function getRecommendedTask(tasks: Task[]): RecommendedTask | null {
  const activeTasks = tasks.filter((t) => t.status === 'active')
  if (activeTasks.length === 0) return null

  const now = new Date()

  const scored = activeTasks.map((task) => {
    const { score, reason } = scoreTask(task, now)
    return { task, score, reason }
  })

  // Sort descending by score; tiebreak oldest-first (FIFO)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return parseISO(a.task.created_at).getTime() - parseISO(b.task.created_at).getTime()
  })

  const best = scored[0]
  if (!best) return null

  return {
    task: best.task,
    reason: best.reason,
    score: best.score,
  }
}

// ─── Task grouping logic ──────────────────────────────────────────────────────
export function groupTasks(tasks: Task[]): Record<TaskGroup, Task[]> {
  const now = new Date()
  const in24h = addHours(now, 24)
  const in3days = addDays(now, 3)

  const groups: Record<TaskGroup, Task[]> = {
    now: [],
    soon: [],
    later: [],
  }

  for (const task of tasks) {
    if (task.status !== 'active') continue

    const effectiveDue = task.due_date
      ? (task.due_time ? parseISO(`${task.due_date}T${task.due_time}`) : parseISO(task.due_date))
      : null

    if (!effectiveDue) {
      groups.later.push(task)
      continue
    }

    if (isBefore(effectiveDue, in24h)) {
      groups.now.push(task)
    } else if (isBefore(effectiveDue, in3days)) {
      groups.soon.push(task)
    } else {
      groups.later.push(task)
    }
  }

  // Sort each group: urgency first, then effective due datetime, then FIFO
  const urgencyOrder: Record<Task['urgency'], number> = { high: 0, medium: 1, low: 2 }

  const getEffectiveMs = (t: Task): number => {
    if (!t.due_date) return Infinity
    return (t.due_time ? parseISO(`${t.due_date}T${t.due_time}`) : parseISO(t.due_date)).getTime()
  }

  for (const key of Object.keys(groups) as TaskGroup[]) {
    groups[key].sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
      if (urgencyDiff !== 0) return urgencyDiff
      const timeDiff = getEffectiveMs(a) - getEffectiveMs(b)
      if (timeDiff !== 0) return timeDiff
      return parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime()
    })
  }

  return groups
}

// ─── Human-readable reason labels ────────────────────────────────────────────
export function getReasonLabel(reason: RecommendationReason): string {
  const labels: Record<RecommendationReason, string> = {
    overdue: 'Overdue',
    due_today: 'Due today',
    due_soon: 'Due soon',
    recently_active: 'In progress',
    high_urgency: 'High priority',
  }
  return labels[reason]
}

// ─── Format estimated time ────────────────────────────────────────────────────
export function formatEstimatedTime(minutes: number | null): string | null {
  if (!minutes) return null
  if (minutes < 60) return `~${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (remainder === 0) return `~${hours}h`
  return `~${hours}h ${remainder}m`
}
