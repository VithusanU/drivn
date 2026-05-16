'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { useUserStore } from '@/stores/userStore'
import { formatDueDate, cn } from '@/lib/utils'
import CompletionScreen from '@/components/tasks/CompletionScreen'
import FocusTimer from '@/components/focus/FocusTimer'
import MusicWidget from '@/components/focus/MusicWidget'
import TaskEditSheet from '@/components/tasks/TaskEditSheet'

interface FocusModePageProps {
  params: { id: string }
}

export default function FocusModePage({ params }: FocusModePageProps) {
  const router = useRouter()
  const tasks = useTaskStore((s) => s.tasks)
  const completeTask = useTaskStore((s) => s.completeTask)
  const updateStreak = useUserStore((s) => s.updateStreak)
  const fetchStreak = useUserStore((s) => s.fetchStreak)

  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [newStreak, setNewStreak] = useState(0)
  const [editing, setEditing] = useState(false)

  const task = tasks.find((t) => t.id === params.id)

  useEffect(() => {
    if (task) {
      useTaskStore.getState().updateTask(task.id, { last_engaged_at: new Date().toISOString() } as any)
    }
  }, [task?.id])

  if (!task && !completed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Task not found.</p>
      </div>
    )
  }

  const handleComplete = async () => {
    if (!task) return
    setCompleting(true)
    await completeTask(task.id)
    await updateStreak()
    const updatedStreak = await fetchStreak().then(() => useUserStore.getState().streak)
    setNewStreak(updatedStreak?.current_streak ?? 0)
    setCompleted(true)
  }

  if (completed) {
    return <CompletionScreen streak={newStreak} onNext={() => router.push('/')} />
  }

  const returnPath = `/focus/${params.id}`

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
              initialMinutes={task.estimated_minutes}
              onComplete={handleComplete}
            />
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
              {formatDueDate(task.due_date)}
            </span>
          )}
          {task?.estimated_minutes && (
            <span className="text-[11px] px-3 py-1 rounded-full bg-muted border border-border text-muted-foreground">
              {task.estimated_minutes < 60
                ? `${task.estimated_minutes}m`
                : `${Math.floor(task.estimated_minutes / 60)}h${task.estimated_minutes % 60 ? ` ${task.estimated_minutes % 60}m` : ''}`}
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

        {/* Complete + Pause — only shown when timer hasn't ended */}
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
            Pause
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
