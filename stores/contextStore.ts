'use client'

import { create } from 'zustand'

const STORAGE_KEY = 'drivn_day_context'

function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface StoredContext {
  text: string
  date: string // YYYY-MM-DD — auto-expires when date changes
}

function loadContext(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return ''
    const stored: StoredContext = JSON.parse(raw)
    // Expire if it's from a previous day
    if (stored.date !== getTodayStr()) {
      localStorage.removeItem(STORAGE_KEY)
      return ''
    }
    return stored.text
  } catch {
    return ''
  }
}

function saveContext(text: string) {
  if (typeof window === 'undefined') return
  if (!text) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  const stored: StoredContext = { text, date: getTodayStr() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

interface ContextStore {
  contextText: string
  setContext: (text: string) => void
  clearContext: () => void
  hydrate: () => void
}

export const useContextStore = create<ContextStore>((set) => ({
  contextText: '',

  setContext: (text: string) => {
    saveContext(text)
    set({ contextText: text })
  },

  clearContext: () => {
    saveContext('')
    set({ contextText: '' })
  },

  // Call once on mount to load persisted value
  hydrate: () => {
    set({ contextText: loadContext() })
  },
}))
