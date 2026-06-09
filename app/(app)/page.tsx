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
import TodayFocus from '@/components/dashboard/TodayFocus'
import MotivationalQuote from '@/components/dashboard/MotivationalQuote'
import UpcomingEvents from '@/components/dashboard/UpcomingEvents'
import MiniCalendar from '@/components/dashboard/MiniCalendar'
import StatsPanel from '@/components/dashboard/StatsPanel'

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

      {/* `home-grid` (see globals.css) keeps the DOM/fetch order identical to
          the mobile visual order — every widget renders exactly once — while
          `grid-template-areas` re-arranges things into a 65/35 two-column
          layout on `lg:`+ screens. Mobile renders this as a plain single
          column stack, pixel-identical to the previous `space-y-6` layout. */}
      <div className="home-grid flex-1 px-4 pb-6 overflow-y-auto no-scrollbar scroll-momentum">
        {/* Profile completeness nudge */}
        {profileIncomplete && (
          <div className="home-grid__nudge flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5">
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

        {/* Core: Next Best Action — anchors the left "do stuff" spine on desktop */}
        <div className="home-grid__nba">
          <NextBestAction />
        </div>

        {/* Upcoming events this week — top of the right context rail on desktop */}
        <div className="home-grid__upcoming">
          <UpcomingEvents />
        </div>

        {/* Mini calendar + at-a-glance stats — desktop rail only. Mobile stays
            exactly as it was (no extra scroll distance on the primary surface);
            these exist purely to use the desktop rail's spare width with
            content that's genuinely useful and pulls from data the page
            already has in memory (zero new fetches). */}
        <div className="hidden lg:block home-grid__calendar">
          <MiniCalendar />
        </div>
        <div className="hidden lg:block home-grid__stats">
          <StatsPanel />
        </div>

        {/* Today's Focus — hard deadlines + tasks due today */}
        <TodayFocus />

        {/* Quick wins strip */}
        <div className="home-grid__quickwins">
          <QuickWins />
        </div>

        {/* Daily motivational quote */}
        <div className="home-grid__quote">
          <MotivationalQuote />
        </div>

        {/* Task Groups: Now / Soon / Later — spans the full left column height on desktop */}
        <div className="home-grid__taskgroups">
          <TaskGroups />
        </div>

        {/* Habits strip */}
        <section className="home-grid__habits">
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3">
            Today&apos;s habits
          </p>
          <HabitStrip />
        </section>

        {/* Momentum */}
        <section className="home-grid__momentum">
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
