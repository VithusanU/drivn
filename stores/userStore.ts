'use client'

import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type { UserStore, UserProfile, UserStreak } from '@/types'

export const useUserStore = create<UserStore>((set) => ({
  profile: null,
  streak: null,
  isLoading: false,

  fetchProfile: async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) set({ profile: data as UserProfile })
  },

  fetchStreak: async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) set({ streak: data as UserStreak })
  },

  updateStreak: async () => {
    // Re-fetch streak after task completion
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) set({ streak: data as UserStreak })
  },

  markOnboarded: async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const now = new Date().toISOString()
    await supabase
      .from('user_profiles')
      .update({ onboarded_at: now })
      .eq('id', user.id)

    set((state) => ({
      profile: state.profile ? { ...state.profile, onboarded_at: now } : null,
    }))
  },
}))
