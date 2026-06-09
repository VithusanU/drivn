'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Circle, CheckCircle2, Trash2, Lock, Square, CheckSquare, Bell, Flame } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { useUserStore } from '@/stores/userStore'
import { useUndoStore } from '@/stores/undoStore'
import { isTaskBlocked } from '@/lib/engine/recommendation'
import { formatDueDate, dueDateOnly, cn } from '@/lib/utils'
import type { Task } from '@/types'
import { TASK_CATEGORIES } from '@/types'

interface TaskItemProps {
  task: Task
  selectMode?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
}

const URGENCY_DOT: Record<Task['urgency'], string> = {
  high: 'bg-destructive',
  medium: 'bg-amber-400',
  low: 'bg-muted-foreground/30',
}

export default function TaskItem({ task, selectMode = false, selected = false, onSelect }: TaskItemProps) {
  const [completing, setCompleting] = useState(false)
  const completeTask = useTaskStore((s) => s.completeTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const undoDeleteTask = useTaskStore((s) => s.undoDeleteTask)
  const tasks = useTaskStore((s) => s.tasks)
  const updateStreak = useUserStore((s) => s.updateStreak)
  const showUndo = useUndoStore((s) => s.show)
  const router = useRouter()

  const x = useMotionValue(0)
  const SWIPE_THRESHOLD = 80
  const completeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1])
  const deleteOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0])

  const blocked = isTaskBlocked(task, tasks)
  const blockerTask = blocked ? tasks.find((t) => t.id === task.blocked_by) : null
  const catEmoji = task.category && task.category !== 'other'
    ? TASK_CATEGORIES.find((c) => c.value === task.category)?.emoji
    : null

  const isDueDateOverdue =
    task.due_date && (() => {
      const due = dueDateOnly(task.due_date)
      return due < new Date() && !isToday(due)
    })()

  const doComplete = async () => {
    setCompleting(true)
    await completeTask(task.id)
    await updateStreak()
    setCompleting(false)
  }

  const doDelete = async () => {
    await deleteTask(task.id)
    showUndo(`"${task.title}" deleted`, () => undoDeleteTask(task.id, task))
  }

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    doComplete()
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    doDelete()
  }

  const handleDragEnd = async (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x > SWIPE_THRESHOLD) {
      await animate(x, 400, { duration: 0.15 })
      doComplete()
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      await animate(x, -400, { duration: 0.15 })
      doDelete()
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 } as any)
    }
  }

  const handleClick = () => {
    if (selectMode && onSelect) {
      onSelect(task.id)
      return
    }
    if (!blocked) router.push(`/focus/${task.id}`)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: completing ? 0.4 : blocked ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.15 }}
      className="relative overflow-hidden rounded-xl"
    >
      {/* Swipe right → complete (green) */}
      {!selectMode && !blocked && (
        <motion.div
          style={{ opacity: completeOpacity }}
          className="absolute inset-0 bg-drivn-green/20 flex items-center pl-4 pointer-events-none"
        >
          <CheckCircle2 className="w-5 h-5 text-drivn-green" />
        </motion.div>
      )}
      {/* Swipe left → delete (red) */}
      {!selectMode && !blocked && (
        <motion.div
          style={{ opacity: deleteOpacity }}
          className="absolute inset-0 bg-destructive/20 flex items-center justify-end pr-4 pointer-events-none"
        >
          <Trash2 className="w-5 h-5 text-destructive" />
        </motion.div>
      )}
      {/* Draggable card */}
      <motion.div
        drag={!selectMode && !blocked ? 'x' : false}
        style={{ x }}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        className={cn(
          'flex items-center gap-3 px-3.5 py-3',
          'bg-card/50 border border-border/50',
          'cursor-pointer group transition-colors',
          selected && 'bg-primary/5 border-primary/30',
          blocked
            ? 'opacity-50 hover:opacity-70'
            : 'hover:bg-card hover:border-border active:scale-[0.99]'
        )}
        onClick={handleClick}
      >
      {/* Checkbox (select mode) / Complete button / Lock */}
      {selectMode ? (
        <div className="flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center">
          {selected
            ? <CheckSquare className="w-[18px] h-[18px] text-primary" />
            : <Square className="w-[18px] h-[18px] text-muted-foreground/30" />
          }
        </div>
      ) : blocked ? (
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
        <div className="flex items-center gap-1 min-w-0">
          {catEmoji && <span className="text-[12px] flex-shrink-0 opacity-70">{catEmoji}</span>}
          <p className="text-[14px] text-foreground/80 truncate">{task.title}</p>
        </div>
        {/* Notes preview */}
        {task.description && !blocked && (
          <p className="text-[11px] mt-0.5 text-muted-foreground/40 truncate">{task.description}</p>
        )}
        {/* Blocker / due date */}
        {blocked && blockerTask ? (
          <p className="text-[11px] mt-0.5 text-muted-foreground/40 truncate">
            Waiting on: {blockerTask.title}
          </p>
        ) : !task.description && task.due_date ? (
          <p className={cn(
            'text-[11px] mt-0.5 flex items-center gap-1',
            isDueDateOverdue ? 'text-destructive/70' : 'text-muted-foreground/50'
          )}>
            {task.alarm_enabled && <Bell className="w-2.5 h-2.5 text-primary/60 flex-shrink-0" />}
            {task.is_hard_deadline && <Flame className="w-2.5 h-2.5 text-red-400/70 flex-shrink-0" />}
            {formatDueDate(task.due_date, task.due_time)}
          </p>
        ) : null}
        {/* Recurrence badge */}
        {task.recurrence && task.recurrence !== 'none' && (
          <span className="inline-block text-[10px] mt-0.5 text-primary/50">↻ {task.recurrence}</span>
        )}
      </div>

      {/* Priority dot */}
      <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', URGENCY_DOT[task.urgency])} />

      {/* Delete (shows on hover, hidden in select mode) */}
      {!selectMode && (
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
      )}
      </motion.div>
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
