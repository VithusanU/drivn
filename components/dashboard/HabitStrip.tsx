'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHabitStore } from '@/stores/habitStore'
import HabitDetailSheet from '@/components/habits/HabitDetailSheet'
import { cn } from '@/lib/utils'
import type { HabitWithStreak, HabitCompletionDetails } from '@/types'

type HabitState = 'completed' | 'in_progress' | 'not_done' | 'pending'

function getHabitState(habit: HabitWithStreak): HabitState {
  const isEOD = new Date().getHours() >= 21
  if (habit.completedToday) {
    if (habit.detail_type === 'amount') {
      const logged = habit.lastDetails?.amount ?? 0
      const target = habit.detail_config?.target ?? 1
      return logged >= target ? 'completed' : 'in_progress'
    }
    return 'completed'
  }
  return isEOD ? 'not_done' : 'pending'
}

function getAmountProgress(habit: HabitWithStreak): number {
  const logged = habit.lastDetails?.amount ?? 0
  const target = habit.detail_config?.target ?? 1
  return Math.min(logged / target, 1)
}

const STATE_CARD: Record<HabitState, string> = {
  completed:   'bg-drivn-green/10 border-drivn-green/30',
  in_progress: 'bg-amber-400/10 border-amber-400/30',
  not_done:    'bg-destructive/8 border-destructive/25',
  pending:     'bg-card/50 border-border/50 hover:bg-card hover:border-border',
}

const STATE_RING: Record<HabitState, string> = {
  completed:   'bg-drivn-green border-drivn-green text-white',
  in_progress: 'bg-amber-400 border-amber-400 text-white',
  not_done:    'bg-destructive/60 border-destructive/60 text-white',
  pending:     'border-muted-foreground/20',
}

const STATE_BAR: Record<HabitState, string> = {
  completed:   'bg-drivn-green',
  in_progress: 'bg-amber-400',
  not_done:    'bg-destructive/50',
  pending:     'bg-muted-foreground/20',
}

const STATE_LABEL: Record<HabitState, string> = {
  completed:   'text-drivn-green',
  in_progress: 'text-amber-400',
  not_done:    'text-destructive/70',
  pending:     'text-muted-foreground',
}

export default function HabitStrip() {
  const toggleHabit = useHabitStore((s) => s.toggleHabit)
  const getHabitsWithStreaks = useHabitStore((s) => s.getHabitsWithStreaks)
  const [activeSheet, setActiveSheet] = useState<HabitWithStreak | null>(null)

  const habitsWithStreaks = getHabitsWithStreaks()

  if (habitsWithStreaks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No habits yet. Add some in the Habits tab.
      </p>
    )
  }

  const handleTap = (habit: HabitWithStreak) => {
    if (habit.completedToday) {
      toggleHabit(habit.id)
    } else if (habit.detail_type === 'none') {
      toggleHabit(habit.id)
    } else {
      setActiveSheet(habit)
    }
  }

  const handleConfirm = async (details: HabitCompletionDetails) => {
    if (!activeSheet) return
    setActiveSheet(null)
    await toggleHabit(activeSheet.id, details)
  }

  return (
    <>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-momentum pb-1">
        {habitsWithStreaks.map((habit) => {
          const state = getHabitState(habit)
          const progress = habit.detail_type === 'amount' ? getAmountProgress(habit) : null
          const loggedSections = habit.lastDetails?.body_sections?.length ?? 0

          return (
            <motion.button
              key={habit.id}
              whileTap={{ scale: 0.93 }}
              onClick={() => handleTap(habit)}
              className={cn(
                'relative flex flex-col items-center gap-1.5 px-4 pt-3 pb-2 rounded-2xl',
                'flex-shrink-0 min-w-[72px] border transition-all duration-150 overflow-hidden',
                STATE_CARD[state]
              )}
            >
              <span className="text-xl">{habit.emoji}</span>

              <span className={cn('text-[11px] font-medium whitespace-nowrap', STATE_LABEL[state])}>
                {habit.title}
              </span>

              {/* Ring / check indicator */}
              <div className={cn(
                'w-3.5 h-3.5 rounded-full border-[1.5px] flex items-center justify-center text-[9px] font-bold',
                STATE_RING[state]
              )}>
                {state === 'completed' && '✓'}
                {state === 'in_progress' && '·'}
                {state === 'not_done' && '✕'}
              </div>

              {/* Amount: fill bar at bottom */}
              {habit.detail_type === 'amount' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-border/40">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress ?? 0) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={cn('h-full', STATE_BAR[state])}
                  />
                </div>
              )}

              {/* Body sections: tiny count */}
              {habit.detail_type === 'body_sections' && loggedSections > 0 && (
                <span className={cn('text-[9px] font-medium -mt-1', STATE_LABEL[state])}>
                  {loggedSections}/8
                </span>
              )}
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {activeSheet && (
          <HabitDetailSheet
            habit={activeSheet}
            onConfirm={handleConfirm}
            onClose={() => setActiveSheet(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
