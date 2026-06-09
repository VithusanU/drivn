'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTaskStore } from '@/stores/taskStore'
import { useUserStore } from '@/stores/userStore'
import AppHeader from '@/components/layout/AppHeader'
import NextBestAction from '@/components/dashboard/NextBestAction'
import TaskGroups from '@/components/dashboard/TaskGroups'
import HabitStrip from '@/components/dashboard/HabitStrip'
import MomentumCard from '@/components/dashboard/MomentumCard'
import QuickCapture from '@/components/dashboard/QuickCapture'
import QuickWins from '@/components/dashboard/QuickWins'
import TodayFocus from '@/components/dashboard/TodayFocus'
import MotivationalQuote from '@/components/dashboard/MotivationalQuote'

export default function HomePage() {
  const router = useRouter()
  const profile = useUserStore((s) => s.profile)
  const tasks = useTaskStore((s) => s.tasks)
  const hasFetched = useTaskStore((s) => s.hasFetched)

  useEffect(() => {
    if (!hasFetched || !profile) return
    if (!profile.onboarded_at && tasks.length === 0) {
      router.replace('/onboarding')
    }
  }, [hasFetched, profile, tasks, router])

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />

      <div className="flex-1 px-4 pb-6 space-y-6 overflow-y-auto no-scrollbar scroll-momentum">
        {/* Core: Next Best Action */}
        <NextBestAction />

        {/* Today's Focus — hard deadlines + tasks due today */}
        <TodayFocus />

        {/* Quick wins strip */}
        <QuickWins />

        {/* Daily motivational quote */}
        <MotivationalQuote />

        {/* Task Groups: Now / Soon / Later */}
        <TaskGroups />

        {/* Habits strip */}
        <section>
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3">
            Today&apos;s habits
          </p>
          <HabitStrip />
        </section>

        {/* Momentum */}
        <section>
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3">
            Momentum
          </p>
          <MomentumCard />
        </section>
      </div>

      {/* Persistent quick capture */}
      <QuickCapture />
    </div>
  )
}
