'use client'

import { useEffect } from 'react'
import BottomNav from '@/components/layout/BottomNav'
import SideNav from '@/components/layout/SideNav'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useUserStore } from '@/stores/userStore'
import { useGlobalTimer } from '@/hooks/useGlobalTimer'
import { Analytics } from '@/lib/analytics'
import { getReminderTime } from '@/lib/notifications'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const fetchHabits = useHabitStore((s) => s.fetchHabits)
  const fetchTodayCompletions = useHabitStore((s) => s.fetchTodayCompletions)
  const fetchProfile = useUserStore((s) => s.fetchProfile)
  const fetchStreak = useUserStore((s) => s.fetchStreak)

  useGlobalTimer()

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
    ])

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
  }, [fetchTasks, fetchHabits, fetchTodayCompletions, fetchProfile, fetchStreak])

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar — fixed on screen, this div reserves its width in the flow */}
      <div className="hidden md:block w-[220px] flex-shrink-0">
        <SideNav />
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-2xl mx-auto px-4 pb-24 md:pb-12 pt-0">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}
