'use client'

import { useEffect } from 'react'
import BottomNav from '@/components/layout/BottomNav'
import SideNav from '@/components/layout/SideNav'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useUserStore } from '@/stores/userStore'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const fetchHabits = useHabitStore((s) => s.fetchHabits)
  const fetchTodayCompletions = useHabitStore((s) => s.fetchTodayCompletions)
  const fetchProfile = useUserStore((s) => s.fetchProfile)
  const fetchStreak = useUserStore((s) => s.fetchStreak)

  useEffect(() => {
    Promise.all([
      fetchTasks(),
      fetchHabits(),
      fetchTodayCompletions(),
      fetchProfile(),
      fetchStreak(),
    ])
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
