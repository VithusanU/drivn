'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import BottomNav from '@/components/layout/BottomNav'
import SideNav from '@/components/layout/SideNav'
import UndoToast from '@/components/ui/UndoToast'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useUserStore } from '@/stores/userStore'
import { useEventStore } from '@/stores/eventStore'
import { useUIStore } from '@/stores/uiStore'
import { useGlobalTimer } from '@/hooks/useGlobalTimer'
import { useGlobalSpotifyPlayer } from '@/hooks/useGlobalSpotifyPlayer'
import { usePresenceSync } from '@/hooks/usePresenceSync'
import { Analytics, identifyUser } from '@/lib/analytics'
import { getReminderTime } from '@/lib/notifications'
import { AI_TRIAL_DAYS } from '@/lib/constants'
import InstallBanner from '@/components/ui/InstallBanner'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Home is the only route that opts into the wider 65/35 two-column desktop
  // grid (see app/(app)/page.tsx + .home-grid in globals.css) — every other
  // route (Habits, Friends, Summary, Profile, etc.) keeps the centered
  // max-w-2xl reading-width column they already have. Scoped via pathname so
  // this is purely additive: nothing about any other route changes.
  const isHome = pathname === '/'
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)

  const profile = useUserStore((s) => s.profile)
  const trialDaysLeft = profile?.created_at && !profile.beta_access && !profile.anthropic_key_masked
    ? Math.max(0, AI_TRIAL_DAYS - Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000))
    : null
  const showTrialBanner = trialDaysLeft !== null && trialDaysLeft <= 2 && pathname !== '/profile'

  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const fetchHabits = useHabitStore((s) => s.fetchHabits)
  const fetchTodayCompletions = useHabitStore((s) => s.fetchTodayCompletions)
  const fetchProfile = useUserStore((s) => s.fetchProfile)
  const fetchStreak = useUserStore((s) => s.fetchStreak)
  const fetchEvents = useEventStore((s) => s.fetchEvents)

  useGlobalTimer()
  useGlobalSpotifyPlayer()
  usePresenceSync()

  // Re-fetch completions when the tab becomes visible again — guards against the app
  // being left open overnight so yesterday's data doesn't bleed into a new day.
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') fetchTodayCompletions()
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => document.removeEventListener('visibilitychange', handleVisible)
  }, [fetchTodayCompletions])

  useEffect(() => {
    Promise.all([
      fetchTasks(),
      fetchHabits(),
      fetchTodayCompletions(),
      fetchProfile(),
      fetchStreak(),
      fetchEvents(),
    ]).then(() => {
      // Identify user in PostHog so all events are attributed to this person
      const p = useUserStore.getState().profile
      if (p?.id) {
        identifyUser(p.id, {
          email: p.email ?? undefined,
          beta_access: p.beta_access ?? false,
          has_own_key: !!p.anthropic_key_masked,
          created_at: p.created_at,
        })
      }
    })

    // Track session start once per day
    const today = new Date().toISOString().slice(0, 10)
    const lastSession = localStorage.getItem('drivn_last_session')
    if (lastSession !== today) {
      localStorage.setItem('drivn_last_session', today)
      Analytics.sessionInitiated()
    }

    // Track if user opened within 30 min of their reminder time
    getReminderTime().then((localTime) => {
      if (!localTime) return
      const [rh, rm] = localTime.split(':').map(Number)
      const now = new Date()
      const diffMin = (now.getHours() * 60 + now.getMinutes()) - (rh * 60 + rm)
      if (diffMin >= 0 && diffMin <= 30) {
        Analytics.returnedAfterReminder()
      }
    })
  }, [fetchTasks, fetchHabits, fetchTodayCompletions, fetchProfile, fetchStreak, fetchEvents])

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar — fixed on screen, this div reserves its width in the flow.
          Width tracks SideNav's own collapsed state so content reflows into
          the freed space when the sidebar is collapsed. */}
      <div className={cn(
        'hidden md:block flex-shrink-0 transition-[width] duration-200',
        sidebarCollapsed ? 'w-[68px]' : 'w-[220px]'
      )}>
        <SideNav />
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        {/* Bottom padding must clear the fixed mobile BottomNav (60px tall,
            plus env(safe-area-inset-bottom) on notched phones — see
            BottomNav.tsx's `min-h-[60px] pb-safe`). Using calc() here keeps
            the visual gap below the nav constant across devices instead of
            risking content getting tucked behind a taller-than-expected bar
            on iPhones with a home indicator. */}
        {showTrialBanner && (
          <Link href="/profile" className="block">
            <div className="flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20 text-center">
              <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <p className="text-[12px] text-primary font-medium">
                {trialDaysLeft === 0
                  ? 'Your AI trial has ended — upgrade to keep your schedule.'
                  : `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left in your AI trial — tap to upgrade.`}
              </p>
            </div>
          </Link>
        )}
        <div className={cn(
          'mx-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12 pt-safe md:pt-0',
          // Home gets a wider stage at lg:/xl: so its 65/35 grid has room to
          // breathe; every other route stays at the original max-w-2xl.
          isHome ? 'max-w-2xl lg:max-w-5xl xl:max-w-6xl' : 'max-w-2xl'
        )}>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />

      <UndoToast />
      <InstallBanner />
    </div>
  )
}
