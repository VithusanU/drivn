'use client'

import { create } from 'zustand'
import type { AIStore, AIRecommendation, Task } from '@/types'

export const useAIStore = create<AIStore>((set) => ({
  recommendation: null,
  fetching: false,

  fetchRecommendation: async (tasks: Task[], force = false, context = '') => {
    set({ fetching: true })
    try {
      const res = await fetch('/api/ai-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, force, context }),
      })
      if (!res.ok) {
        set({ fetching: false })
        return
      }
      const data: AIRecommendation = await res.json()
      set({ recommendation: data, fetching: false })
    } catch {
      set({ fetching: false })
    }
  },

  clear: () => set({ recommendation: null, fetching: false }),
}))
