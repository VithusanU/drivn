'use client'

import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent, CreateEventInput, UpdateEventInput, EventStore } from '@/types'

// Next occurrence date for recurring events
function nextOccurrence(event: CalendarEvent): string {
  const base = new Date(event.event_date)
  if (event.recurrence === 'weekly') {
    base.setDate(base.getDate() + 7)
  } else if (event.recurrence === 'monthly') {
    base.setMonth(base.getMonth() + 1)
  } else if (event.recurrence === 'custom' && event.recurrence_days) {
    base.setDate(base.getDate() + event.recurrence_days)
  }
  return base.toISOString().split('T')[0]
}

export const useEventStore = create<EventStore>((set, get) => ({
  events: [],
  isLoading: false,
  hasFetched: false,

  fetchEvents: async () => {
    const supabase = createClient()
    set({ isLoading: true })
    try {
      // Fetch events from today onwards (and past 7 days in case of recurring)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', weekAgo.toISOString().split('T')[0])
        .order('event_date', { ascending: true })
      if (error) throw error
      set({ events: data ?? [], isLoading: false, hasFetched: true })
    } catch {
      set({ isLoading: false, hasFetched: true })
    }
  },

  createEvent: async (input: CreateEventInput) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: user.id,
        title: input.title,
        event_date: input.event_date,
        event_time: input.event_time ?? null,
        category: input.category ?? 'personal',
        recurrence: input.recurrence ?? 'none',
        recurrence_days: input.recurrence_days ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single()

    if (error || !data) return null
    set((state) => ({
      events: [...state.events, data].sort((a, b) =>
        a.event_date.localeCompare(b.event_date)
      ),
    }))
    return data
  },

  updateEvent: async (id: string, input: UpdateEventInput) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('events')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (error || !data) return
    set((state) => ({
      events: state.events
        .map((e) => (e.id === id ? data : e))
        .sort((a, b) => a.event_date.localeCompare(b.event_date)),
    }))
  },

  deleteEvent: async (id: string) => {
    const supabase = createClient()
    // For recurring events: instead of deleting, create next occurrence first
    const event = get().events.find((e) => e.id === id)
    if (event && event.recurrence !== 'none') {
      const next = nextOccurrence(event)
      // Only create next if it's in the future
      if (next > new Date().toISOString().split('T')[0]) {
        await get().createEvent({
          title: event.title,
          event_date: next,
          event_time: event.event_time,
          category: event.category,
          recurrence: event.recurrence,
          recurrence_days: event.recurrence_days,
          notes: event.notes,
        })
      }
    }
    await supabase.from('events').delete().eq('id', id)
    set((state) => ({ events: state.events.filter((e) => e.id !== id) }))
  },

  undoDeleteEvent: async (id: string, event: CalendarEvent) => {
    const supabase = createClient()
    await supabase.from('events').insert(event)
    set((state) => ({
      events: [...state.events, event].sort((a, b) =>
        a.event_date.localeCompare(b.event_date)
      ),
    }))
  },

  getUpcomingEvents: (days = 30) => {
    // Use local date parts to avoid UTC timezone shifting dates
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const future = new Date(now)
    future.setDate(future.getDate() + days)
    const futureStr = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`
    return get().events.filter(
      (e) => e.event_date >= todayStr && e.event_date <= futureStr
    )
  },
}))
