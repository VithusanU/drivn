'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Circle, CheckCircle2, Trash2 } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { useUserStore } from '@/stores/userStore'
import { useUndoStore } from '@/stores/undoStore'
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
  const [showDelete, setShowDelete] = useState(false)
  const completeTask = useTaskStore((s) => s.completeTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const undoDeleteTask = useTaskStore((s) => s.undoDeleteTask)
  const updateStreak = useUserStore((s) => s.updateStreak)
  const showUndo = useUndoStore((s) => s.show)
  const router = useRouter()

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

  const isDueDateOverdue =
    task.due_date && new Date(task.due_date) < new Date() && !isToday(new Date(task.due_date))

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: completing ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'flex items-center gap-3 px-3.5 py-3 rounded-xl',
        'bg-card/50 border border-border/50',
        'cursor-pointer group transition-colors',
        'hover:bg-card hover:border-border active:scale-[0.99]'
      )}
      onClick={() => router.push(`/focus/${task.id}`)}
    >
      {/* Checkbox */}
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

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-foreground/80 truncate">{task.title}</p>
        {task.due_date && (
          <p className={cn(
            'text-[11px] mt-0.5',
            isDueDateOverdue ? 'text-destructive/70' : 'text-muted-foreground/50'
          )}>
            {formatDueDate(task.due_date, task.due_time)}
          </p>
        )}
      </div>

      {/* Priority dot */}
      <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', URGENCY_DOT[task.urgency])} />

      {/* Delete (shows on hover/long-press) */}
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
