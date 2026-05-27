'use client'

import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { saveAccount } from '@/lib/savedAccounts'
import type { UserStore, UserProfile, UserStreak } from '@/types'

const ADMIN_EMAIL = 'vithusan.business@gmail.com'
const BETA_MODE_KEY = 'drivn:betaMode'

export const useUserStore = create<UserStore>((set, get) => ({
  profile: null,
  streak: null,
  isLoading: false,
  betaModeEnabled:
    typeof window !== 'undefined'
      ? localStorage.getItem(BETA_MODE_KEY) === 'true'
      : false,

  fetchProfile: async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      // Owner always has beta access regardless of DB state
      const profile = data as UserProfile
      if (profile.email === ADMIN_EMAIL) profile.beta_access = true
      set({ profile })
      saveAccount({ email: data.email, name: data.full_name, avatar_url: data.avatar_url })
    }
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

  toggleBetaMode: () => {
    const next = !get().betaModeEnabled
    localStorage.setItem(BETA_MODE_KEY, String(next))
    set({ betaModeEnabled: next })
  },

  requestBetaAccess: async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'error'

    const profile = get().profile

    const { error } = await supabase.from('beta_requests').insert({
      user_id: user.id,
      user_email: profile?.email ?? user.email ?? '',
      user_name: profile?.full_name ?? null,
    })

    if (error) {
      // Unique constraint violation = already requested
      if (error.code === '23505') return 'already_requested'
      return 'error'
    }

    return 'ok'
  },

  saveApiKey: async (key: string) => {
    try {
      const res = await fetch('/api/user-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      if (res.status === 400) return 'invalid'
      if (!res.ok) return 'error'
      const { masked } = await res.json()
      set((state) => ({
        profile: state.profile ? { ...state.profile, anthropic_key_masked: masked } : null,
      }))
      return 'ok'
    } catch {
      return 'error'
    }
  },

  removeApiKey: async () => {
    try {
      await fetch('/api/user-api-key', { method: 'DELETE' })
      set((state) => ({
        profile: state.profile ? { ...state.profile, anthropic_key_masked: null } : null,
      }))
    } catch {}
  },
}))
