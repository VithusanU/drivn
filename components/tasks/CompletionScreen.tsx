'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Share2, Zap, Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task, HabitWithStreak } from '@/types'

interface CompletionScreenProps {
  streak: number
  onNext: () => void
  quickWin?: Task | null
  matchingHabit?: HabitWithStreak | null
  onLogHabit?: () => void
}

export default function CompletionScreen({ streak, onNext, quickWin, matchingHabit, onLogHabit }: CompletionScreenProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const text = `Just completed a task on Drivn${streak > 0 ? ` — ${streak} day streak 🔥` : ''} drivn.app`
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {}
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col items-center justify-center px-6 bg-background text-center"
    >
      {/* Checkmark */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
        className={cn(
          'w-[72px] h-[72px] rounded-full mb-6',
          'bg-drivn-green/15 border-2 border-drivn-green',
          'flex items-center justify-center text-drivn-green text-3xl'
        )}
      >
        ✓
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-[22px] font-medium text-foreground mb-2"
      >
        Task complete.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-muted-foreground mb-8 leading-relaxed"
      >
        Momentum maintained.
        <br />
        Keep moving.
      </motion.p>

      {/* Streak card */}
      {streak > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, type: 'spring', stiffness: 300 }}
          className={cn(
            'mb-6 px-8 py-4 rounded-2xl',
            'bg-drivn-green/10 border border-drivn-green/25'
          )}
        >
          <p className="text-[32px] font-medium text-drivn-green leading-none">{streak}</p>
          <p className="text-[12px] text-drivn-green/60 mt-1">day streak 🔥</p>
        </motion.div>
      )}

      {/* Habit match suggestion */}
      {matchingHabit && !matchingHabit.completedToday && onLogHabit && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={cn(
            'w-full max-w-xs mb-4 p-4 rounded-2xl',
            'bg-card border border-border text-left'
          )}
        >
          <p className="text-[11px] font-medium tracking-[0.1em] uppercase text-muted-foreground/50 mb-2">
            While you're at it
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{matchingHabit.emoji}</span>
              <p className="text-[13px] font-medium text-foreground">{matchingHabit.title}</p>
            </div>
            <button
              onClick={onLogHabit}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium',
                'bg-drivn-green/15 border border-drivn-green/30 text-drivn-green',
                'transition-all active:scale-[0.97]'
              )}
            >
              <Check className="w-3 h-3" />
              Log habit
            </button>
          </div>
        </motion.div>
      )}

      {/* Quick win suggestion */}
      {quickWin && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: matchingHabit ? 0.45 : 0.4 }}
          className={cn(
            'w-full max-w-xs mb-6 p-4 rounded-2xl',
            'bg-card border border-border text-left'
          )}
        >
          <p className="text-[11px] font-medium tracking-[0.1em] uppercase text-muted-foreground/50 mb-2">
            While you're on a roll →
          </p>
          <p className="text-[13px] text-foreground/80 mb-3 leading-snug">{quickWin.title}</p>
          <button
            onClick={() => router.push(`/focus/${quickWin.id}`)}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-medium',
              'bg-primary/10 border border-primary/25 text-primary',
              'transition-all active:scale-[0.97]'
            )}
          >
            <Zap className="w-3 h-3" />
            {quickWin.estimated_minutes ? `${quickWin.estimated_minutes}m — Start now` : 'Start now'}
          </button>
        </motion.div>
      )}

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-xs space-y-2"
      >
        <button
          onClick={onNext}
          className={cn(
            'w-full py-4 rounded-2xl',
            'bg-primary text-primary-foreground text-[15px] font-medium',
            'transition-all active:scale-[0.98] hover:bg-primary/90'
          )}
        >
          See next action
        </button>

        <button
          onClick={handleShare}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 rounded-2xl',
            'bg-secondary border border-border text-muted-foreground text-[13px]',
            'transition-all active:scale-[0.98] hover:bg-secondary/80'
          )}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-drivn-green" />
              <span className="text-drivn-green">Copied to clipboard</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" />
              Share your streak
            </>
          )}
        </button>
      </motion.div>
    </motion.div>
  )
}
