'use client'

import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { getTodayISO } from '@/lib/utils'
import type { Habit, HabitCompletion, HabitStore, HabitWithStreak, CreateHabitInput, HabitCompletionDetails, HabitPriority } from '@/types'

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  completions: [],
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

    const { data } = await supabase
      .from('habit_completions')
      .select('*')
      .eq('completed_date', today)

    set({ completions: data ?? [] })
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
        // Update the existing completion with new details (e.g. adding more water)
        const { data, error } = await supabase
          .from('habit_completions')
          .update({ details })
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
    const { habits, completions } = get()
    const today = getTodayISO()

    return habits.map((habit) => {
      const completedToday = completions.some(
        (c) => c.habit_id === habit.id && c.completed_date === today
      )

      // Calculate current streak from completions
      const habitCompletions = completions
        .filter((c) => c.habit_id === habit.id)
        .map((c) => c.completed_date)
        .sort()
        .reverse()

      let currentStreak = 0
      if (habitCompletions.length > 0) {
        let checkDate = new Date()
        for (const dateStr of habitCompletions) {
          const completionDate = new Date(dateStr)
          const diffDays = Math.floor(
            (checkDate.getTime() - completionDate.getTime()) / 86_400_000
          )
          if (diffDays <= 1) {
            currentStreak++
            checkDate = completionDate
          } else {
            break
          }
        }
      }

      const todayCompletion = completions.find(
        (c) => c.habit_id === habit.id && c.completed_date === today
      )

      return { ...habit, completedToday, currentStreak, lastDetails: todayCompletion?.details ?? null }
    })
  },
}))
