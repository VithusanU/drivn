'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHabitStore } from '@/stores/habitStore'
import { cn } from '@/lib/utils'
import HabitDetailSheet from './HabitDetailSheet'
import type { HabitWithStreak, HabitCompletionDetails } from '@/types'

interface HabitCardProps {
  habit: HabitWithStreak
}

function formatDetails(habit: HabitWithStreak): string | null {
  const d = habit.lastDetails
  if (!d) return null
  if (habit.detail_type === 'body_sections' && d.body_sections?.length) {
    return d.body_sections.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
  }
  if (habit.detail_type === 'amount' && d.amount != null) {
    return `${d.amount} ${d.unit ?? ''}`
  }
  return null
}

export default function HabitCard({ habit }: HabitCardProps) {
  const toggleHabit = useHabitStore((s) => s.toggleHabit)
  const [showSheet, setShowSheet] = useState(false)

  const handleTap = () => {
    if (habit.completedToday) {
      // Undo — no detail needed
      toggleHabit(habit.id)
    } else if (habit.detail_type === 'none') {
      toggleHabit(habit.id)
    } else {
      setShowSheet(true)
    }
  }

  const handleConfirm = async (details: HabitCompletionDetails) => {
    setShowSheet(false)
    await toggleHabit(habit.id, details)
  }

  const detailSummary = formatDetails(habit)

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleTap}
        className={cn(
          'flex flex-col p-4 rounded-2xl text-left border transition-all duration-150',
          habit.completedToday
            ? 'bg-drivn-green/10 border-drivn-green/30'
            : 'bg-card/50 border-border/50 hover:bg-card hover:border-border'
        )}
      >
        <span className="text-2xl mb-2">{habit.emoji}</span>
        <p className={cn(
          'text-[15px] font-medium mb-1',
          habit.completedToday ? 'text-drivn-green' : 'text-foreground/75'
        )}>
          {habit.title}
        </p>

        {/* Detail summary or streak */}
        {habit.completedToday && detailSummary ? (
          <p className="text-[11px] text-drivn-green/60 mb-1 truncate">{detailSummary}</p>
        ) : (
          <p className={cn(
            'text-[11px]',
            habit.completedToday ? 'text-drivn-green/55' : 'text-muted-foreground/40'
          )}>
            {habit.currentStreak > 0 ? `${habit.currentStreak} day streak` : 'No streak yet'}
          </p>
        )}

        <div className="flex justify-between items-center mt-3">
          <span className={cn(
            'text-[11px]',
            habit.completedToday ? 'text-drivn-green/60' : 'text-muted-foreground/30'
          )}>
            {habit.completedToday ? 'Done' : habit.detail_type !== 'none' ? 'Tap to log' : 'Not done'}
          </span>
          <div className={cn(
            'w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center',
            habit.completedToday
              ? 'bg-drivn-green border-drivn-green text-white text-[10px] font-bold'
              : 'border-muted-foreground/20'
          )}>
            {habit.completedToday && '✓'}
          </div>
        </div>
      </motion.button>

      <AnimatePresence>
        {showSheet && (
          <HabitDetailSheet
            habit={habit}
            onConfirm={handleConfirm}
            onClose={() => setShowSheet(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
