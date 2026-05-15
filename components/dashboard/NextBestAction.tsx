'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, SkipForward, ArrowRight } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { getReasonLabel, formatEstimatedTime } from '@/lib/engine/recommendation'
import { formatDueDate, cn } from '@/lib/utils'
import type { RecommendationReason } from '@/types'

const REASON_COLORS: Record<RecommendationReason, string> = {
  overdue: 'text-destructive bg-destructive/10 border-destructive/25',
  due_today: 'text-primary bg-primary/10 border-primary/25',
  due_soon: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
  recently_active: 'text-drivn-green bg-drivn-green/10 border-drivn-green/25',
  high_urgency: 'text-primary bg-primary/10 border-primary/25',
}

export default function NextBestAction() {
  const getRecommendedTask = useTaskStore((s) => s.getRecommendedTask)
  const tasks = useTaskStore((s) => s.tasks) // subscribe to task list changes
  const [skippedIds, setSkippedIds] = useState<string[]>([])
  const router = useRouter()

  // Get recommendation excluding skipped tasks
  const allTasks = tasks.filter((t) => !skippedIds.includes(t.id))
  const recommendation = getRecommendedTask()

  // Re-derive excluding skips
  const { getRecommendedTask: getRec } = useTaskStore.getState()

  if (!recommendation || tasks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-5 text-center"
      >
        <div className="text-2xl mb-2">✨</div>
        <p className="text-sm font-medium text-foreground">All clear.</p>
        <p className="text-xs text-muted-foreground mt-1">Add a task to get started.</p>
      </motion.div>
    )
  }

  const { task, reason } = recommendation
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
        {/* Ambient glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/8 pointer-events-none" />

        {/* Label */}
        <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-primary/60 mb-2">
          Next best action
        </p>

        {/* Task title */}
        <h2 className="text-xl font-medium text-white leading-snug mb-3">
          {task.title}
        </h2>

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={cn(
            'text-[11px] font-medium px-2.5 py-1 rounded-full border',
            reasonColor
          )}>
            {getReasonLabel(reason)}
          </span>
          {task.due_date && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-primary/20 text-primary/70 bg-primary/8">
              {formatDueDate(task.due_date)}
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
            onClick={() => router.push(`/focus/${task.id}`)}
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
            onClick={() => setSkippedIds((prev) => [...prev, task.id])}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3 rounded-xl',
              'bg-white/5 border border-white/8 text-white/40 text-sm',
              'transition-all active:scale-[0.97] hover:bg-white/8'
            )}
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
