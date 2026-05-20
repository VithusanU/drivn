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

interface HabitRowProps {
  habits: HabitWithStreak[]
  onTap: (habit: HabitWithStreak) => void
}

function HabitRow({ habits, onTap }: HabitRowProps) {
  return (
    // Negative margin breaks out of the parent px-4 so the scroll goes edge-to-edge
    <div className="relative -mx-4">
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-momentum px-4 pb-1">
        {habits.map((habit) => {
          const state = getHabitState(habit)
          const progress = habit.detail_type === 'amount' ? getAmountProgress(habit) : null
          const loggedSections = habit.lastDetails?.body_sections?.length ?? 0

          return (
            <motion.button
              key={habit.id}
              whileTap={{ scale: 0.93 }}
              onClick={() => onTap(habit)}
              className={cn(
                'relative flex flex-col items-center gap-1.5 px-4 pt-3 pb-2 rounded-2xl',
                'flex-shrink-0 min-w-[72px] border transition-all duration-150 overflow-hidden',
                STATE_CARD[state]
              )}
            >
              {/* Essential star badge */}
              {habit.priority === 'essential' && (
                <span className="absolute top-1 right-1.5 text-[9px] leading-none">⭐</span>
              )}

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
      {/* Right fade to hint at more content */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent" />
    </div>
  )
}

export default function HabitStrip() {
  const toggleHabit = useHabitStore((s) => s.toggleHabit)
  const getHabitsWithStreaks = useHabitStore((s) => s.getHabitsWithStreaks)
  // Subscribe to raw data so this component re-renders when habits or completions change
  useHabitStore((s) => s.habits)
  useHabitStore((s) => s.completions)
  const [activeSheet, setActiveSheet] = useState<HabitWithStreak | null>(null)

  const all = getHabitsWithStreaks()
  const essential = all.filter((h) => h.priority === 'essential')
  const niceToHave = all.filter((h) => h.priority !== 'essential')

  if (all.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No habits yet. Add some in the Habits tab.
      </p>
    )
  }

  const handleTap = (habit: HabitWithStreak) => {
    if (habit.detail_type !== 'none') {
      setActiveSheet(habit)
    } else {
      toggleHabit(habit.id)
    }
  }

  const handleConfirm = async (details: HabitCompletionDetails) => {
    if (!activeSheet) return
    setActiveSheet(null)
    await toggleHabit(activeSheet.id, details)
  }

  return (
    <>
      <div className="space-y-3">
        {essential.length > 0 && (
          <div>
            <p className="text-[10px] font-medium tracking-[0.1em] uppercase text-amber-400/80 mb-2">
              ⭐ Must do
            </p>
            <HabitRow habits={essential} onTap={handleTap} />
          </div>
        )}

        {niceToHave.length > 0 && (
          <div>
            {essential.length > 0 && (
              <p className="text-[10px] font-medium tracking-[0.1em] uppercase text-muted-foreground/50 mb-2">
                Nice to have
              </p>
            )}
            <HabitRow habits={niceToHave} onTap={handleTap} />
          </div>
        )}
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
