'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useTaskStore } from '@/stores/taskStore'
import { useUserStore } from '@/stores/userStore'
import AppHeader from '@/components/layout/AppHeader'
import NextBestAction from '@/components/dashboard/NextBestAction'
import TaskGroups from '@/components/dashboard/TaskGroups'
import HabitStrip from '@/components/dashboard/HabitStrip'
import MomentumCard from '@/components/dashboard/MomentumCard'
import QuickCapture from '@/components/dashboard/QuickCapture'
import QuickWins from '@/components/dashboard/QuickWins'
import MotivationalQuote from '@/components/dashboard/MotivationalQuote'
import UpcomingEvents from '@/components/dashboard/UpcomingEvents'

const PROFILE_NUDGE_KEY = 'drivn_profile_nudge_dismissed'

export default function HomePage() {
  const router = useRouter()
  const profile = useUserStore((s) => s.profile)
  const tasks = useTaskStore((s) => s.tasks)
  const hasFetched = useTaskStore((s) => s.hasFetched)
  const [nudgeDismissed, setNudgeDismissed] = useState(true) // start hidden to avoid flash

  useEffect(() => {
    setNudgeDismissed(!!localStorage.getItem(PROFILE_NUDGE_KEY))
  }, [])

  useEffect(() => {
    if (!hasFetched || !profile) return
    if (!profile.onboarded_at && tasks.length === 0) {
      router.replace('/onboarding')
    }
  }, [hasFetched, profile, tasks, router])

  const profileIncomplete = profile && !nudgeDismissed && (!profile.full_name || !profile.username)

  const dismissNudge = () => {
    localStorage.setItem(PROFILE_NUDGE_KEY, '1')
    setNudgeDismissed(true)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />

      <div className="flex-1 px-4 pb-6 space-y-6 overflow-y-auto no-scrollbar scroll-momentum">
        {/* Profile completeness nudge */}
        {profileIncomplete && (
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5">
            <span className="text-sm flex-shrink-0">👤</span>
            <p className="flex-1 text-[12px] text-muted-foreground/70">
              Complete your profile so friends can find you.{' '}
              <Link href="/profile" className="text-amber-400/80 underline underline-offset-2">Set up now</Link>
            </p>
            <button onClick={dismissNudge} className="flex-shrink-0 text-muted-foreground/30 hover:text-muted-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Core: Next Best Action */}
        <NextBestAction />

        {/* Upcoming events this week */}
        <UpcomingEvents />

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
