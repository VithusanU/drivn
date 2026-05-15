'use client'

import { useUserStore } from '@/stores/userStore'
import { getMomentumMessage, cn } from '@/lib/utils'

export default function MomentumCard() {
  const streak = useUserStore((s) => s.streak)

  const currentStreak = streak?.current_streak ?? 0
  const tasksToday = streak?.tasks_completed_today ?? 0

  return (
    <div>
      <div className={cn(
        'flex gap-4 p-4 rounded-2xl',
        'bg-card/50 border border-border/50'
      )}>
        {/* Streak */}
        <div className="flex-1">
          <p className="text-[26px] font-medium text-foreground leading-none">{currentStreak}</p>
          <p className="text-[11px] text-muted-foreground mt-1">day streak</p>
        </div>

        {/* Divider */}
        <div className="w-px bg-border/50" />

        {/* Tasks today */}
        <div className="flex-1 pl-4">
          <p className="text-[26px] font-medium text-foreground leading-none">{tasksToday}</p>
          <p className="text-[11px] text-muted-foreground mt-1">done today</p>
        </div>
      </div>

      {/* Momentum message */}
      <p className="text-[12px] text-drivn-green/70 italic mt-2.5 px-0.5">
        {getMomentumMessage(currentStreak, tasksToday)}
      </p>
    </div>
  )
}
