'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useUserStore } from '@/stores/userStore'
import { useTimerStore } from '@/stores/timerStore'
import { formatDueDate, cn } from '@/lib/utils'
import { Analytics } from '@/lib/analytics'
import { createClient } from '@/lib/supabase/client'
import CompletionScreen from '@/components/tasks/CompletionScreen'
import FocusTimer from '@/components/focus/FocusTimer'
import MusicWidget from '@/components/focus/MusicWidget'
import TaskEditSheet from '@/components/tasks/TaskEditSheet'
import type { HabitWithStreak, Task } from '@/types'

interface FocusModePageProps {
  params: { id: string }
}

// Simple word-overlap fuzzy match for task <-> habit
function habitMatchesTask(habitTitle: string, taskTitle: string): boolean {
  const habitWords = habitTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  const taskLower = taskTitle.toLowerCase()
  return habitWords.some((word) => taskLower.includes(word))
}

export default function FocusModePage({ params }: FocusModePageProps) {
  const router = useRouter()
  const tasks = useTaskStore((s) => s.tasks)
  const completeTask = useTaskStore((s) => s.completeTask)
  const getQuickWins = useTaskStore((s) => s.getQuickWins)
  const updateStreak = useUserStore((s) => s.updateStreak)
  const fetchStreak = useUserStore((s) => s.fetchStreak)
  const getHabitsWithStreaks = useHabitStore((s) => s.getHabitsWithStreaks)
  const toggleHabit = useHabitStore((s) => s.toggleHabit)
  useHabitStore((s) => s.habits)
  useHabitStore((s) => s.completions)

  const isLoading = useTaskStore((s) => s.isLoading)
  const hasFetched = useTaskStore((s) => s.hasFetched)
  const timerTimeUp = useTimerStore((s) => s.timeUp)
  const addTime = useTimerStore((s) => s.addTime)

  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [newStreak, setNewStreak] = useState(0)
  const [editing, setEditing] = useState(false)
  const [quickWin, setQuickWin] = useState<Task | null>(null)
  const [matchingHabit, setMatchingHabit] = useState<HabitWithStreak | null>(null)

  const sessionStartRef = useRef<Date>(new Date())
  // Tracks whether the session has been finalized (completed or saved on unmount)
  const sessionFinalizedRef = useRef(false)
  const task = tasks.find((t) => t.id === params.id)

  useEffect(() => {
    if (!task) return
    const capturedTask = task
    sessionStartRef.current = new Date()
    sessionFinalizedRef.current = false
    useTaskStore.getState().updateTask(task.id, { last_engaged_at: new Date().toISOString() } as any)
    Analytics.focusSessionStarted(task.id, !!task.estimated_minutes)

    // Save session on unmount (user navigated away without completing)
    return () => {
      if (sessionFinalizedRef.current) return
      const endedAt = new Date()
      const minutesLogged = Math.round((endedAt.getTime() - sessionStartRef.current.getTime()) / 60000)
      if (minutesLogged < 1) return // Skip sub-minute sessions
      createClient().auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        createClient().from('focus_sessions').insert({
          user_id: user.id,
          task_id: capturedTask.id,
          task_title: capturedTask.title,
          started_at: sessionStartRef.current.toISOString(),
          ended_at: endedAt.toISOString(),
          minutes_logged: minutesLogged,
        }).then().catch(() => {})
      }).catch(() => {})
    }
  }, [task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for tasks to load before deciding the task doesn't exist
  if (!task && !completed) {
    if (isLoading || !hasFetched) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground animate-pulse">Loading…</p>
        </div>
      )
    }
    // Task loaded but not found — it was completed or deleted while the timer was still running.
    // Offer to clear the stale timer and go home.
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
        <div className="text-3xl">✅</div>
        <p className="text-[17px] font-medium text-foreground">Task already done</p>
        <p className="text-[13px] text-muted-foreground max-w-xs">
          This task was completed or removed. You can clear the timer and head back home.
        </p>
        <button
          onClick={() => {
            useTimerStore.getState().clearTimer()
            router.push('/')
          }}
          className="mt-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-medium"
        >
          Clear timer &amp; go home
        </button>
      </div>
    )
  }

  const handleComplete = async () => {
    if (!task) return
    sessionFinalizedRef.current = true // Prevent unmount cleanup from double-logging
    setCompleting(true)
    useTimerStore.getState().clearTimer()
    Analytics.focusSessionCompleted(task.id)

    // Record focus session
    const endedAt = new Date()
    const minutesLogged = Math.round((endedAt.getTime() - sessionStartRef.current.getTime()) / 60000)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('focus_sessions').insert({
          user_id: user.id,
          task_id: task.id,
          task_title: task.title,
          started_at: sessionStartRef.current.toISOString(),
          ended_at: endedAt.toISOString(),
          minutes_logged: minutesLogged > 0 ? minutesLogged : 1,
        })
      }
    } catch {}

    // Find quick win (exclude current task)
    const wins = getQuickWins().filter((t) => t.id !== task.id)
    setQuickWin(wins[0] ?? null)

    // Find matching habit
    const habits = getHabitsWithStreaks()
    const match = habits.find((h) => !h.completedToday && habitMatchesTask(h.title, task.title))
    setMatchingHabit(match ?? null)

    await completeTask(task.id)
    await updateStreak()
    const updatedStreak = await fetchStreak().then(() => useUserStore.getState().streak)
    setNewStreak(updatedStreak?.current_streak ?? 0)
    setCompleted(true)
    setCompleting(false)
  }

  const handleLogHabit = async () => {
    if (!matchingHabit) return
    await toggleHabit(matchingHabit.id)
    setMatchingHabit(null)
  }

  if (completed) {
    return (
      <CompletionScreen
        streak={newStreak}
        onNext={() => router.push('/')}
        quickWin={quickWin}
        matchingHabit={matchingHabit}
        onLogHabit={handleLogHabit}
      />
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex flex-col bg-background px-6"
      >
        {/* Back */}
        <div className="pt-14 pb-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 max-w-xs mx-auto w-full text-center">
          {/* Label */}
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-[10px] font-medium tracking-[0.15em] uppercase text-primary/60"
          >
            In focus
          </motion.p>

          {/* Timer or placeholder */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="w-full"
          >
            {task?.estimated_minutes ? (
              <FocusTimer
                taskId={task.id}
                initialMinutes={task.estimated_minutes}
                onComplete={handleComplete}
                taskTitle={task.title}
              />
            ) : timerTimeUp ? (
              /* Timer expired but task has no estimate — show inline time's up UI */
              <div className="w-full max-w-xs mx-auto rounded-2xl border border-border bg-card p-5 text-center">
                <p className="text-[15px] font-medium text-foreground mb-1">Time&apos;s up!</p>
                <p className="text-[12px] text-muted-foreground mb-4">Need more time?</p>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[5, 10, 15, 30].map((m) => (
                    <button
                      key={m}
                      onClick={() => addTime(m)}
                      className={cn(
                        'py-2 rounded-xl border border-border text-[12px] font-medium',
                        'text-muted-foreground hover:text-primary hover:border-primary/40 transition-all'
                      )}
                    >
                      +{m}m
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="w-full py-2.5 rounded-xl text-[13px] font-medium bg-drivn-green text-white hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {completing ? 'Completing…' : 'Complete task'}
                </button>
              </div>
            ) : (
              <div className={cn(
                'w-[160px] h-[160px] mx-auto rounded-full',
                'border-[5px] border-border',
                'flex flex-col items-center justify-center'
              )}>
                <span className="text-3xl">🎯</span>
              </div>
            )}
          </motion.div>

          {/* Task title */}
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-2xl font-medium text-foreground leading-snug"
          >
            {task?.title}
          </motion.h1>

          {/* Task description / notes */}
          {task?.description && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.18 }}
              className="text-[13px] text-muted-foreground/60 leading-relaxed -mt-4"
            >
              {task.description}
            </motion.p>
          )}

          {/* Metadata badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-2 justify-center"
          >
            {task?.urgency && (
              <span className="text-[11px] px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary/70">
                {task.urgency === 'high' ? 'High urgency' : task.urgency === 'medium' ? 'Medium urgency' : 'Low urgency'}
              </span>
            )}
            {task?.due_date && (
              <span className="text-[11px] px-3 py-1 rounded-full bg-muted border border-border text-muted-foreground">
                {formatDueDate(task.due_date, task.due_time)}
              </span>
            )}
            {task?.estimated_minutes && (
              <span className="text-[11px] px-3 py-1 rounded-full bg-muted border border-border text-muted-foreground">
                {task.estimated_minutes < 60
                  ? `${task.estimated_minutes}m`
                  : `${Math.floor(task.estimated_minutes / 60)}h${task.estimated_minutes % 60 ? ` ${task.estimated_minutes % 60}m` : ''}`}
              </span>
            )}
            {task?.recurrence && task.recurrence !== 'none' && (
              <span className="text-[11px] px-3 py-1 rounded-full bg-primary/5 border border-primary/15 text-primary/50">
                ↻ {task.recurrence}
              </span>
            )}
          </motion.div>

          {/* Music widget */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="w-full"
          >
            <MusicWidget />
          </motion.div>

          {/* Complete + Back */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full space-y-2"
          >
            <button
              onClick={handleComplete}
              disabled={completing}
              className={cn(
                'w-full py-4 rounded-2xl text-[17px] font-medium',
                'bg-drivn-green text-white',
                'transition-all active:scale-[0.98] hover:opacity-90',
                'disabled:opacity-50'
              )}
            >
              {completing ? 'Completing…' : 'Complete'}
            </button>

            <button
              onClick={() => router.back()}
              className="w-full py-3 rounded-xl bg-secondary text-secondary-foreground/60 text-sm transition-colors hover:bg-secondary/80"
            >
              Back to home
            </button>
          </motion.div>
        </div>
      </motion.div>

      {task && (
        <TaskEditSheet task={task} open={editing} onClose={() => setEditing(false)} />
      )}
    </>
  )
}
