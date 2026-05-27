'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { useTimerStore } from '@/stores/timerStore'
import { formatEstimatedTime } from '@/lib/engine/recommendation'
import { cn } from '@/lib/utils'

export default function QuickWins() {
  const tasks = useTaskStore((s) => s.tasks)
  const getQuickWins = useTaskStore((s) => s.getQuickWins)
  const timerTaskId = useTimerStore((s) => s.taskId)
  const router = useRouter()

  // Don't show while in a focus session
  if (timerTaskId) return null

  const quickWins = getQuickWins()
  if (quickWins.length === 0) return null

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-amber-400" />
        <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
          Quick wins
        </p>
        <span className="text-[10px] text-muted-foreground/40">· under 30m</span>
      </div>

      {/* Horizontal scroll strip */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {quickWins.map((task, i) => (
          <motion.button
            key={task.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => router.push(`/focus/${task.id}`)}
            className={cn(
              'flex-shrink-0 flex flex-col gap-1 px-3 py-2.5 rounded-xl text-left',
              'bg-card border border-border/50',
              'hover:border-amber-400/30 hover:bg-amber-400/5',
              'transition-all active:scale-[0.97]',
              'max-w-[180px] min-w-[140px]'
            )}
          >
            <p className="text-[12px] font-medium text-foreground/80 truncate leading-tight">
              {task.title}
            </p>
            <div className="flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-amber-400/70" />
              <span className="text-[10px] text-amber-400/70">
                {formatEstimatedTime(task.estimated_minutes)}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
