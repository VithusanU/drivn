'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHabitStore } from '@/stores/habitStore'
import { cn } from '@/lib/utils'
import HabitDetailSheet from './HabitDetailSheet'
import type { HabitWithStreak, HabitCompletionDetails } from '@/types'

interface HabitCardProps {
  habit: HabitWithStreak
  disabled?: boolean
}

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
  completed: 'bg-drivn-green/10 border-drivn-green/30',
  in_progress: 'bg-amber-400/10 border-amber-400/30',
  not_done: 'bg-destructive/8 border-destructive/25',
  pending: 'bg-card/50 border-border/50 hover:bg-card hover:border-border',
}

const STATE_TITLE: Record<HabitState, string> = {
  completed: 'text-drivn-green',
  in_progress: 'text-amber-400',
  not_done: 'text-destructive/70',
  pending: 'text-foreground/75',
}

const STATE_LABEL: Record<HabitState, string> = {
  completed: 'Done ✓',
  in_progress: 'In progress',
  not_done: 'Not done',
  pending: 'Tap to log',
}

const STATE_BAR: Record<HabitState, string> = {
  completed: 'bg-drivn-green',
  in_progress: 'bg-amber-400',
  not_done: 'bg-destructive/50',
  pending: 'bg-muted-foreground/20',
}

const SECTION_LABELS: Record<string, string> = {
  chest: 'Ch', back: 'Ba', shoulders: 'Sh', arms: 'Ar',
  core: 'Co', legs: 'Le', glutes: 'Gl', cardio: 'Ca',
}
const ALL_SECTIONS = ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'glutes', 'cardio']

export default function HabitCard({ habit, disabled }: HabitCardProps) {
  const toggleHabit = useHabitStore((s) => s.toggleHabit)
  const [showSheet, setShowSheet] = useState(false)

  const state = getHabitState(habit)

  const handleTap = () => {
    if (disabled) return
    if (habit.detail_type !== 'none') {
      // Always open the sheet for detail habits so existing logs can be updated
      setShowSheet(true)
    } else {
      toggleHabit(habit.id)
    }
  }

  const handleConfirm = async (details: HabitCompletionDetails) => {
    setShowSheet(false)
    await toggleHabit(habit.id, details)
  }

  const amountProgress = habit.detail_type === 'amount' ? getAmountProgress(habit) : null
  const loggedSections: string[] = habit.lastDetails?.body_sections ?? []

  return (
    <>
      <motion.button
        whileTap={{ scale: disabled ? 1 : 0.95 }}
        onClick={handleTap}
        className={cn(
          'flex flex-col p-4 rounded-2xl text-left border transition-all duration-150 w-full',
          STATE_CARD[state],
          disabled && 'opacity-60 cursor-default'
        )}
      >
        <span className="text-2xl mb-2">{habit.emoji}</span>

        <p className={cn('text-[15px] font-medium mb-1', STATE_TITLE[state])}>
          {habit.title}
        </p>

        {/* Streak or logged detail */}
        <p className={cn('text-[11px] mb-3', state === 'pending' ? 'text-muted-foreground/40' : STATE_TITLE[state] + '/60')}>
          {habit.currentStreak > 0 ? `${habit.currentStreak} day streak` : 'No streak yet'}
        </p>

        {/* ── Amount progress bar ── */}
        {habit.detail_type === 'amount' && (
          <div className="w-full mb-3 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className={cn(STATE_TITLE[state], 'opacity-70')}>
                {habit.lastDetails?.amount ?? 0} {habit.detail_config?.unit ?? ''}
              </span>
              <span className="text-muted-foreground/40">
                {habit.detail_config?.target ?? '?'} {habit.detail_config?.unit ?? ''}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(amountProgress ?? 0) * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className={cn('h-full rounded-full', STATE_BAR[state])}
              />
            </div>
          </div>
        )}

        {/* ── Body sections dots ── */}
        {habit.detail_type === 'body_sections' && (
          <div className="flex flex-wrap gap-1 mb-3">
            {ALL_SECTIONS.map((s) => {
              const done = loggedSections.includes(s)
              return (
                <span
                  key={s}
                  className={cn(
                    'text-[9px] font-medium px-1.5 py-0.5 rounded-md border transition-all',
                    done
                      ? cn(STATE_BAR[state], 'text-white border-transparent')
                      : 'bg-muted/50 border-border/40 text-muted-foreground/40'
                  )}
                >
                  {SECTION_LABELS[s]}
                </span>
              )
            })}
          </div>
        )}

        {/* Status label */}
        <span className={cn('text-[11px]', state === 'pending' ? 'text-muted-foreground/40' : STATE_TITLE[state] + '/70')}>
          {habit.detail_type === 'none' || state === 'not_done' || state === 'pending'
            ? STATE_LABEL[state]
            : state === 'completed'
            ? 'Done ✓'
            : STATE_LABEL[state]}
        </span>
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
