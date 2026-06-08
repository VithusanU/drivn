'use client'

import { useMemo } from 'react'
import { useUserStore } from '@/stores/userStore'
import { useHabitStore } from '@/stores/habitStore'

/**
 * Desktop-rail "at a glance" numbers — deliberately distinct from
 * MomentumCard (which already shows current streak + tasks done today, and
 * stays in the rail). To avoid redundancy, this surfaces three *different*,
 * already-aggregated/already-fetched numbers:
 *   - longest streak (the "record" — a different framing than "current")
 *   - habits completed today as a fraction (X of Y active habits)
 *   - total tasks ever completed (a "how far you've come" number)
 * All three come from data the layout already fetches (useUserStore's
 * `streak`, useHabitStore's `habits`/`completions`) — zero new requests,
 * and zero new derived-from-scratch date math (which is exactly what caused
 * the "Best day" badge bug elsewhere — see app/(app)/summary/page.tsx).
 */
export default function StatsPanel() {
  const streak = useUserStore((s) => s.streak)
  const habits = useHabitStore((s) => s.habits)
  const completions = useHabitStore((s) => s.completions)

  const { longestStreak, totalCompleted, habitsLabel } = useMemo(() => {
    const activeHabits = habits.filter((h) => h.active)
    const doneIds = new Set(completions.map((c) => c.habit_id))
    const habitsDone = activeHabits.filter((h) => doneIds.has(h.id)).length

    return {
      longestStreak: streak?.longest_streak ?? 0,
      totalCompleted: streak?.total_tasks_completed ?? 0,
      habitsLabel: activeHabits.length > 0 ? `${habitsDone}/${activeHabits.length}` : '—',
    }
  }, [streak, habits, completions])

  const stats = [
    { value: `${longestStreak}d`, label: 'Best streak' },
    { value: habitsLabel, label: 'Habits today' },
    { value: totalCompleted, label: 'All-time tasks' },
  ]

  return (
    <div className="p-4 rounded-2xl bg-card/50 border border-border/50">
      <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/60 mb-3">
        At a glance
      </p>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[20px] font-medium text-foreground leading-none">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
