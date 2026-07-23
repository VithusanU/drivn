'use client'

import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { saveAccount } from '@/lib/savedAccounts'
import { Analytics } from '@/lib/analytics'
import type { UserStore, UserProfile, UserStreak, ScheduleBlockedDate } from '@/types'

const STREAK_MILESTONES = [3, 7, 14, 21, 30, 60, 90, 180, 365]

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'vithusan.business@gmail.com'
const BETA_MODE_KEY = 'drivn:betaMode'

export const useUserStore = create<UserStore>((set, get) => ({
  profile: null,
  streak: null,
  isLoading: false,
  blockedDates: [],
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

    const prevStreak = get().streak?.current_streak ?? 0

    const { data } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      set({ streak: data as UserStreak })
      const newStreak = (data as UserStreak).current_streak
      if (newStreak < prevStreak && prevStreak > 0) {
        Analytics.streakBroken(prevStreak)
      } else if (newStreak > prevStreak) {
        for (const milestone of STREAK_MILESTONES) {
          if (prevStreak < milestone && newStreak >= milestone) {
            Analytics.streakMilestone(milestone)
          }
        }
      }
    }
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

  toggleEventLeadReminder: async (pref) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const profile = get().profile
    const next = !(profile?.[pref] ?? true)

    set((state) => ({
      profile: state.profile ? { ...state.profile, [pref]: next } : null,
    }))

    await supabase.from('user_profiles').update({ [pref]: next }).eq('id', user.id)
  },

  updateScheduleSettings: async (settings) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    set((state) => ({
      profile: state.profile ? { ...state.profile, ...settings } : null,
    }))

    await supabase.from('user_profiles').update(settings).eq('id', user.id)
  },

  fetchBlockedDates: async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('schedule_blocked_dates')
      .select('*')
      .eq('user_id', user.id)
      .order('blocked_date', { ascending: true })

    if (data) set({ blockedDates: data as ScheduleBlockedDate[] })
  },

  addBlockedDate: async (date) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('schedule_blocked_dates')
      .insert({ user_id: user.id, blocked_date: date })
      .select()
      .single()

    if (data) {
      set((state) => ({
        blockedDates: [...state.blockedDates, data as ScheduleBlockedDate]
          .sort((a, b) => a.blocked_date.localeCompare(b.blocked_date)),
      }))
    }
  },

  removeBlockedDate: async (date) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    set((state) => ({
      blockedDates: state.blockedDates.filter((d) => d.blocked_date !== date),
    }))

    await supabase.from('schedule_blocked_dates')
      .delete()
      .eq('user_id', user.id)
      .eq('blocked_date', date)
  },
}))
