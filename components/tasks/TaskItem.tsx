'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Circle, CheckCircle2, Trash2, Lock, Flame } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { useUserStore } from '@/stores/userStore'
import { useUndoStore } from '@/stores/undoStore'
import { isTaskBlocked } from '@/lib/engine/recommendation'
import { formatDueDate, cn } from '@/lib/utils'
import type { Task } from '@/types'

interface TaskItemProps {
  task: Task
}

const URGENCY_DOT: Record<Task['urgency'], string> = {
  high: 'bg-destructive',
  medium: 'bg-amber-400',
  low: 'bg-muted-foreground/30',
}

export default function TaskItem({ task }: TaskItemProps) {
  const [completing, setCompleting] = useState(false)
  const completeTask = useTaskStore((s) => s.completeTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const undoDeleteTask = useTaskStore((s) => s.undoDeleteTask)
  const tasks = useTaskStore((s) => s.tasks)
  const updateStreak = useUserStore((s) => s.updateStreak)
  const showUndo = useUndoStore((s) => s.show)
  const router = useRouter()

  const blocked = isTaskBlocked(task, tasks)
  const blockerTask = blocked ? tasks.find((t) => t.id === task.blocked_by) : null

  const isDueDateOverdue =
    task.due_date && new Date(task.due_date) < new Date() && !isToday(new Date(task.due_date))

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setCompleting(true)
    await completeTask(task.id)
    await updateStreak()
    setCompleting(false)
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteTask(task.id)
    showUndo(`"${task.title}" deleted`, () => undoDeleteTask(task.id, task))
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: completing ? 0.4 : blocked ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'flex items-center gap-3 px-3.5 py-3 rounded-xl',
        'bg-card/50 border border-border/50',
        'cursor-pointer group transition-colors',
        blocked
          ? 'opacity-50 hover:opacity-70'
          : 'hover:bg-card hover:border-border active:scale-[0.99]'
      )}
      onClick={() => router.push(`/focus/${task.id}`)}
    >
      {/* Checkbox — hidden for blocked tasks */}
      {blocked ? (
        <div className="flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center">
          <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
        </div>
      ) : (
        <button
          onClick={handleComplete}
          disabled={completing}
          className="flex-shrink-0 touch-target flex items-center justify-center"
          aria-label="Complete task"
        >
          {completing ? (
            <CheckCircle2 className="w-[18px] h-[18px] text-drivn-green animate-pop-in" />
          ) : (
            <Circle className="w-[18px] h-[18px] text-muted-foreground/30 hover:text-drivn-green transition-colors" />
          )}
        </button>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-foreground/80 truncate">{task.title}</p>
        {blocked && blockerTask ? (
          <p className="text-[11px] mt-0.5 text-muted-foreground/40 truncate">
            Waiting on: {blockerTask.title}
          </p>
        ) : task.due_date ? (
          <p className={cn(
            'text-[11px] mt-0.5 flex items-center gap-1',
            isDueDateOverdue ? 'text-destructive/70' : 'text-muted-foreground/50'
          )}>
            {task.is_hard_deadline && (
              <Flame className="w-2.5 h-2.5 text-red-400/70 flex-shrink-0" />
            )}
            {formatDueDate(task.due_date, task.due_time)}
          </p>
        ) : null}
      </div>

      {/* Priority dot */}
      <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', URGENCY_DOT[task.urgency])} />

      {/* Delete (shows on hover) */}
      <button
        onClick={handleDelete}
        className={cn(
          'flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
          'text-muted-foreground/30 hover:text-destructive/70 p-1'
        )}
        aria-label="Delete task"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  )
}

function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}
