'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Zap, Sparkles } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { useTimerStore } from '@/stores/timerStore'
import { useUserStore } from '@/stores/userStore'
import { useAIStore } from '@/stores/aiStore'
import { formatEstimatedTime } from '@/lib/engine/recommendation'
import { cn } from '@/lib/utils'

export default function QuickWins() {
  const tasks = useTaskStore((s) => s.tasks)
  const getQuickWins = useTaskStore((s) => s.getQuickWins)
  const timerTaskId = useTimerStore((s) => s.taskId)
  const router = useRouter()

  const betaModeEnabled = useUserStore((s) => s.betaModeEnabled)
  const profile = useUserStore((s) => s.profile)
  const hasBetaAccess = profile?.beta_access === true
  const hasOwnKey = !!profile?.anthropic_key_masked
  const canUseAI = hasBetaAccess || hasOwnKey
  const aiRecommendation = useAIStore((s) => s.recommendation)

  const isAIMode = betaModeEnabled && canUseAI

  // Resolve quick wins — AI list takes priority, fall back to algorithmic
  let quickWins = getQuickWins()
  let usingAI = false

  if (isAIMode && aiRecommendation?.quickWinIds?.length) {
    const aiWins = aiRecommendation.quickWinIds
      .map((id) => tasks.find((t) => t.id === id))
      .filter(Boolean) as typeof tasks
    if (aiWins.length > 0) {
      quickWins = aiWins
      usingAI = true
    }
  }

  // Exclude the task currently in a focus session — it's already shown
  // front-and-center in the NextBestAction card.
  if (timerTaskId) {
    quickWins = quickWins.filter((t) => t.id !== timerTaskId)
  }

  const isEmpty = quickWins.length === 0

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-amber-400" />
        <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
          Quick wins
        </p>
        {usingAI ? (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/25">
            <Sparkles className="w-2 h-2 text-primary/70" />
            <span className="text-[9px] font-medium text-primary/70">AI</span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/40">· under 30m</span>
        )}
      </div>

      {isEmpty ? (
        <div className={cn(
          'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl',
          'border border-dashed border-border/40 text-muted-foreground/30',
          'min-h-[58px]'
        )}>
          <Zap className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-[12px]">No quick wins right now</span>
        </div>
      ) : (
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
      )}
    </div>
  )
}
