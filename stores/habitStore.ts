'use client'

import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { getTodayISO } from '@/lib/utils'
import type { Habit, HabitCompletion, HabitStore, HabitWithStreak, CreateHabitInput, HabitCompletionDetails, HabitPriority } from '@/types'

// Parse 'YYYY-MM-DD' as a local calendar date (avoids UTC midnight timezone shifts)
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Days between two 'YYYY-MM-DD' strings (later - earlier)
function daysDiff(laterStr: string, earlierStr: string): number {
  return Math.round(
    (parseLocalDate(laterStr).getTime() - parseLocalDate(earlierStr).getTime()) / 86_400_000
  )
}

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  completions: [],
  lastCompletions: [],
  isLoading: false,

  fetchHabits: async () => {
    const supabase = createClient()
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('active', true)
        .order('order_index')

      if (error) throw error
      // Sort: essentials first, then by order_index
      const sorted = (data ?? []).sort((a, b) => {
        if (a.priority === b.priority) return a.order_index - b.order_index
        return a.priority === 'essential' ? -1 : 1
      })
      set({ habits: sorted, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  fetchTodayCompletions: async () => {
    const supabase = createClient()
    const today = getTodayISO()

    // Today's completions (for progress tracking)
    const { data: todayData } = await supabase
      .from('habit_completions')
      .select('*')
      .eq('completed_date', today)

    // All completions before today from last 60 days (for streak calculation)
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0]

    const { data: prevData } = await supabase
      .from('habit_completions')
      .select('*')
      .lt('completed_date', today)
      .gte('completed_date', sixtyDaysAgoStr)
      .order('completed_date', { ascending: false })

    set({ completions: todayData ?? [], lastCompletions: (prevData ?? []) as HabitCompletion[] })
  },

  toggleHabit: async (habitId: string, details?: HabitCompletionDetails) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = getTodayISO()
    const { completions } = get()
    const existingCompletion = completions.find(
      (c) => c.habit_id === habitId && c.completed_date === today
    )

    if (existingCompletion) {
      if (details) {
        // Accumulate amount instead of replacing (e.g. 250ml + 250ml = 500ml)
        const mergedDetails = { ...details }
        if (typeof details.amount === 'number') {
          const existing = (existingCompletion.details as HabitCompletionDetails | null)?.amount ?? 0
          mergedDetails.amount = existing + details.amount
        }
        const { data, error } = await supabase
          .from('habit_completions')
          .update({ details: mergedDetails })
          .eq('id', existingCompletion.id)
          .select()
          .single()
        if (!error && data) {
          set((state) => ({
            completions: state.completions.map((c) => c.id === existingCompletion.id ? data : c),
          }))
        }
      } else {
        // No details = user wants to unmark (simple habits)
        await supabase.from('habit_completions').delete().eq('id', existingCompletion.id)
        set((state) => ({
          completions: state.completions.filter((c) => c.id !== existingCompletion.id),
        }))
      }
    } else {
      const { data, error } = await supabase
        .from('habit_completions')
        .insert({ habit_id: habitId, user_id: user.id, completed_date: today, details: details ?? null })
        .select()
        .single()

      if (!error && data) {
        set((state) => ({ completions: [...state.completions, data] }))
      }
    }
  },

  deleteHabit: async (id: string) => {
    const supabase = createClient()
    await supabase.from('habits').update({ active: false }).eq('id', id)
    set((state) => ({ habits: state.habits.filter((h) => h.id !== id) }))
  },

  updateHabitPriority: async (id: string, priority: HabitPriority) => {
    const supabase = createClient()
    await supabase.from('habits').update({ priority }).eq('id', id)
    set((state) => ({
      habits: state.habits
        .map((h) => h.id === id ? { ...h, priority } : h)
        .sort((a, b) => {
          if (a.priority === b.priority) return a.order_index - b.order_index
          return a.priority === 'essential' ? -1 : 1
        }),
    }))
  },

  createHabit: async (input: CreateHabitInput) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { habits } = get()
    const { data, error } = await supabase
      .from('habits')
      .insert({
        user_id: user.id,
        title: input.title,
        emoji: input.emoji,
        order_index: habits.length,
        detail_type: input.detail_type ?? 'none',
        detail_config: input.detail_config ?? null,
        priority: input.priority ?? 'nice_to_have',
      })
      .select()
      .single()

    if (!error && data) {
      set((state) => ({ habits: [...state.habits, data] }))
    }
  },

  getHabitsWithStreaks: (): HabitWithStreak[] => {
    const { habits, completions, lastCompletions } = get()
    const today = getTodayISO()

    return habits.map((habit) => {
      const todayCompletion = completions.find(
        (c) => c.habit_id === habit.id && c.completed_date === today
      )
      const completedToday = !!todayCompletion

      // All past dates for this habit, sorted descending
      const pastDates = lastCompletions
        .filter((c) => c.habit_id === habit.id)
        .map((c) => c.completed_date)

      // Walk consecutive days backward from today
      const allDates = completedToday ? [today, ...pastDates] : pastDates
      let currentStreak = 0
      for (let i = 0; i < allDates.length; i++) {
        if (i === 0) {
          // First entry must be today or yesterday to start a streak
          if (daysDiff(today, allDates[0]) <= 1) currentStreak++
          else break
        } else {
          if (daysDiff(allDates[i - 1], allDates[i]) === 1) currentStreak++
          else break
        }
      }

      const lastCompletedDate = pastDates[0] ?? null

      return {
        ...habit,
        completedToday,
        currentStreak,
        lastDetails: todayCompletion?.details ?? null,
        lastCompletedDate,
      }
    })
  },
}))
