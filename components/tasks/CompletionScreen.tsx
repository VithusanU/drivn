'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface CompletionScreenProps {
  streak: number
  onNext: () => void
}

export default function CompletionScreen({ streak, onNext }: CompletionScreenProps) {
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
            'mb-8 px-8 py-4 rounded-2xl',
            'bg-drivn-green/10 border border-drivn-green/25'
          )}
        >
          <p className="text-[32px] font-medium text-drivn-green leading-none">{streak}</p>
          <p className="text-[12px] text-drivn-green/60 mt-1">day streak 🔥</p>
        </motion.div>
      )}

      {/* Next action */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={onNext}
        className={cn(
          'w-full max-w-xs py-4 rounded-2xl',
          'bg-primary text-primary-foreground text-[15px] font-medium',
          'transition-all active:scale-[0.98] hover:bg-primary/90'
        )}
      >
        See next action
      </motion.button>
    </motion.div>
  )
}
