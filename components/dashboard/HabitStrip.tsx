'use client'

import { motion } from 'framer-motion'
import { useHabitStore } from '@/stores/habitStore'
import { cn } from '@/lib/utils'

export default function HabitStrip() {
  const habits = useHabitStore((s) => s.habits)
  const completions = useHabitStore((s) => s.completions)
  const toggleHabit = useHabitStore((s) => s.toggleHabit)
  const getHabitsWithStreaks = useHabitStore((s) => s.getHabitsWithStreaks)

  const habitsWithStreaks = getHabitsWithStreaks()

  if (habitsWithStreaks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No habits yet. Add some in the Habits tab.
      </p>
    )
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-momentum pb-1">
      {habitsWithStreaks.map((habit) => (
        <motion.button
          key={habit.id}
          whileTap={{ scale: 0.93 }}
          onClick={() => toggleHabit(habit.id)}
          className={cn(
            'flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl',
            'flex-shrink-0 min-w-[72px] border transition-all duration-150',
            habit.completedToday
              ? 'bg-drivn-green/10 border-drivn-green/30'
              : 'bg-card/50 border-border/50 hover:bg-card hover:border-border'
          )}
        >
          <span className="text-xl">{habit.emoji}</span>
          <span className={cn(
            'text-[11px] font-medium whitespace-nowrap',
            habit.completedToday ? 'text-drivn-green' : 'text-muted-foreground'
          )}>
            {habit.title}
          </span>

          {/* Ring indicator */}
          <div className={cn(
            'w-3.5 h-3.5 rounded-full border-[1.5px] flex items-center justify-center',
            habit.completedToday
              ? 'bg-drivn-green border-drivn-green text-[#0a0a0f] text-[9px] font-bold'
              : 'border-muted-foreground/20'
          )}>
            {habit.completedToday && '✓'}
          </div>
        </motion.button>
      ))}
    </div>
  )
}
