'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, SkipForward, Trash2, Coffee, ArrowRight, Sparkles, RefreshCw } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { useUserStore } from '@/stores/userStore'
import { useAIStore } from '@/stores/aiStore'
import { useTimerStore } from '@/stores/timerStore'
import { useSessionStore } from '@/stores/sessionStore'
import { getReasonLabel, formatEstimatedTime, getRecommendedTask } from '@/lib/engine/recommendation'
import { formatDueDate, cn } from '@/lib/utils'
import type { RecommendationReason } from '@/types'

const REASON_COLORS: Record<RecommendationReason, string> = {
  overdue: 'text-destructive bg-destructive/10 border-destructive/25',
  due_today: 'text-primary bg-primary/10 border-primary/25',
  due_soon: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
  recently_active: 'text-drivn-green bg-drivn-green/10 border-drivn-green/25',
  high_urgency: 'text-primary bg-primary/10 border-primary/25',
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function NextBestAction() {
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const tasks = useTaskStore((s) => s.tasks)
  const skippedIds = useSessionStore((s) => s.skippedTaskIds)
  const skipTask = useSessionStore((s) => s.skipTask)
  const router = useRouter()

  const betaModeEnabled = useUserStore((s) => s.betaModeEnabled)
  const profile = useUserStore((s) => s.profile)
  const hasBetaAccess = profile?.beta_access === true
  const hasOwnKey = !!profile?.anthropic_key_masked
  const canUseAI = hasBetaAccess || hasOwnKey

  const aiRecommendation = useAIStore((s) => s.recommendation)
  const aiFetching = useAIStore((s) => s.fetching)
  const fetchAIRecommendation = useAIStore((s) => s.fetchRecommendation)
  const clearAI = useAIStore((s) => s.clear)

  const timerTaskId = useTimerStore((s) => s.taskId)
  const timerTaskTitle = useTimerStore((s) => s.taskTitle)
  const timerSecondsLeft = useTimerStore((s) => s.secondsLeft)
  const timerRunning = useTimerStore((s) => s.running)
  const timerTimeUp = useTimerStore((s) => s.timeUp)
  const breakActive = useTimerStore((s) => s.breakActive)
  const breakSecondsLeft = useTimerStore((s) => s.breakSecondsLeft)
  const hasFetched = useTaskStore((s) => s.hasFetched)

  // If tasks have loaded and the timer task no longer exists, it was completed/deleted.
  // Don't show a broken Resume card — offer to clear the stale timer instead.
  const timerTaskExists = !timerTaskId || !hasFetched || tasks.some((t) => t.id === timerTaskId)

  const isAIMode = betaModeEnabled && canUseAI

  // Fetch AI recommendation whenever beta mode is on and tasks change
  useEffect(() => {
    if (!isAIMode || tasks.length === 0) {
      clearAI()
      return
    }
    const filtered = tasks.filter((t) => !skippedIds.includes(t.id))
    fetchAIRecommendation(filtered)
  }, [isAIMode, tasks.length, skippedIds.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stale timer card (task was completed/deleted but timer persisted) ────────
  if (timerTaskId && hasFetched && !timerTaskExists) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-2xl overflow-hidden',
          'bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]',
          'border border-primary/20 p-5'
        )}
      >
        <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-primary/60 mb-2">
          Timer
        </p>
        <h2 className="text-xl font-medium text-white leading-snug mb-1">{timerTaskTitle}</h2>
        <p className="text-[12px] text-white/40 mb-4">This task was already completed.</p>
        <button
          onClick={() => useTimerStore.getState().clearTimer()}
          className={cn(
            'flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[14px] font-medium',
            'bg-white/10 border border-white/15 text-white/70 transition-all hover:bg-white/15'
          )}
        >
          Dismiss timer
        </button>
      </motion.div>
    )
  }

  // ── Active timer card ───────────────────────────────────────────────────────
  if (timerTaskId) {
    const displaySeconds = breakActive ? breakSecondsLeft : timerSecondsLeft
    const statusLabel = breakActive
      ? 'On break'
      : timerTimeUp
        ? "Time's up"
        : timerRunning
          ? 'In focus'
          : 'Paused'

    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={cn(
          'relative rounded-2xl overflow-hidden cursor-pointer',
          'bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]',
          'border border-primary/20 p-5'
        )}
        onClick={() => router.push(`/focus/${timerTaskId}`)}
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/8 pointer-events-none" />
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-primary/60">
            {statusLabel}
          </p>
          {breakActive && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25">
              <Coffee className="w-2.5 h-2.5 text-blue-400" />
              <span className="text-[10px] text-blue-400 font-medium">Break</span>
            </div>
          )}
        </div>
        <h2 className="text-xl font-medium text-white leading-snug mb-3">{timerTaskTitle}</h2>
        <div className="flex items-center gap-2 mb-4">
          <span className={cn(
            'text-3xl font-medium tabular-nums',
            breakActive ? 'text-blue-400' : timerTimeUp ? 'text-destructive' : 'text-white'
          )}>
            {timerTimeUp ? "Time's up!" : formatTime(displaySeconds)}
          </span>
          {!timerTimeUp && (
            <span className="text-[11px] text-white/30">
              {breakActive ? 'break remaining' : 'remaining'}
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/focus/${timerTaskId}`) }}
          className={cn(
            'flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[15px] font-medium',
            'bg-primary text-primary-foreground transition-all active:scale-[0.97] hover:bg-primary/90'
          )}
        >
          <ArrowRight className="w-4 h-4" />
          Resume
        </button>
      </motion.div>
    )
  }

  const filteredTasks = tasks.filter((t) => !skippedIds.includes(t.id))

  // ── AI loading skeleton ─────────────────────────────────────────────────────
  if (isAIMode && aiFetching && !aiRecommendation) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'relative rounded-2xl overflow-hidden',
          'bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]',
          'border border-primary/20 p-5'
        )}
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/8 pointer-events-none" />
        <div className="flex items-center gap-1.5 mb-3">
          <Sparkles className="w-3 h-3 text-primary/60 animate-pulse" />
          <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-primary/60">
            AI is thinking…
          </p>
        </div>
        <div className="space-y-2 mb-4">
          <div className="h-6 w-3/4 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-4 w-1/2 rounded-lg bg-white/5 animate-pulse" />
        </div>
        <div className="h-11 rounded-xl bg-white/5 animate-pulse" />
      </motion.div>
    )
  }

  // ── Resolve task — AI or algorithmic ────────────────────────────────────────
  let task = null
  let aiReason: string | null = null
  let reason: RecommendationReason = 'high_urgency'

  if (isAIMode && aiRecommendation?.taskId) {
    const aiTask = filteredTasks.find((t) => t.id === aiRecommendation.taskId)
    if (aiTask) {
      task = aiTask
      aiReason = aiRecommendation.reason
      // Derive a reason label from the task's own metadata for the badge colour
      const algo = getRecommendedTask(filteredTasks)
      if (algo?.task.id === aiTask.id) reason = algo.reason
    }
  }

  if (!task) {
    const recommendation = getRecommendedTask(filteredTasks)
    if (recommendation) {
      task = recommendation.task
      reason = recommendation.reason
    }
  }

  if (!task || tasks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-5 text-center"
      >
        <div className="text-2xl mb-2">✨</div>
        <p className="text-sm font-medium text-foreground">You&apos;re all clear.</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto leading-relaxed">
          Nothing left to do. Use the + button below to capture your next task.
        </p>
      </motion.div>
    )
  }

  const reasonColor = REASON_COLORS[reason]

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={task.id}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={cn(
          'relative rounded-2xl overflow-hidden',
          'bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]',
          'border border-primary/20 p-5'
        )}
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/8 pointer-events-none" />

        {/* Label row */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-primary/60">
            Next best action
          </p>
          {isAIMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAIRecommendation(filteredTasks, true)}
                disabled={aiFetching}
                className="p-1 rounded-full text-white/20 hover:text-white/50 transition-colors disabled:opacity-30"
                aria-label="Refresh AI recommendation"
              >
                <RefreshCw className={cn('w-3 h-3', aiFetching && 'animate-spin')} />
              </button>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25">
                <Sparkles className="w-2.5 h-2.5 text-primary/70" />
                <span className="text-[10px] font-medium text-primary/70">AI</span>
              </div>
            </div>
          )}
        </div>

        {/* Task title */}
        <h2 className="text-xl font-medium text-white leading-snug mb-1">
          {task.title}
        </h2>

        {/* AI reason */}
        {aiReason && (
          <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
            {aiReason}
          </p>
        )}

        {/* Metadata badges */}
        <div className={cn('flex flex-wrap gap-2', aiReason ? 'mb-4' : 'mt-3 mb-4')}>
          <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-full border', reasonColor)}>
            {getReasonLabel(reason)}
          </span>
          {task.due_date && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-primary/20 text-primary/70 bg-primary/8">
              {formatDueDate(task.due_date, task.due_time)}
            </span>
          )}
          {task.estimated_minutes && (
            <span className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 text-white/40 bg-white/5">
              {formatEstimatedTime(task.estimated_minutes)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2.5">
          <button
            onClick={() => router.push(`/focus/${task!.id}`)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2',
              'bg-primary text-primary-foreground',
              'py-3 rounded-xl text-[15px] font-medium',
              'transition-all active:scale-[0.97] hover:bg-primary/90'
            )}
          >
            <Zap className="w-4 h-4" />
            Start now
          </button>
          <button
            onClick={() => skipTask(task!.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3 rounded-xl',
              'bg-white/5 border border-white/8 text-white/40 text-sm',
              'transition-all active:scale-[0.97] hover:bg-white/8'
            )}
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip
          </button>
          <button
            onClick={() => deleteTask(task!.id)}
            className={cn(
              'flex items-center justify-center px-3 py-3 rounded-xl',
              'bg-white/5 border border-white/8 text-white/40',
              'transition-all active:scale-[0.97] hover:bg-destructive/20 hover:text-destructive/70 hover:border-destructive/30'
            )}
            aria-label="Delete task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
