'use client'

import { create } from 'zustand'
import type { SessionStore } from '@/types'

// Backed by sessionStorage so skips survive navigation but reset on new browser sessions
function readSkipped(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem('drivn_skipped_tasks')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeSkipped(ids: string[]) {
  try {
    sessionStorage.setItem('drivn_skipped_tasks', JSON.stringify(ids))
  } catch {}
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  skippedTaskIds: readSkipped(),

  skipTask: (id: string) => {
    const next = [...get().skippedTaskIds, id]
    writeSkipped(next)
    set({ skippedTaskIds: next })
  },

  clearSkipped: () => {
    writeSkipped([])
    set({ skippedTaskIds: [] })
  },
}))
