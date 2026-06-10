'use client'

import { create } from 'zustand'

interface UIStore {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

const STORAGE_KEY = 'drivn_sidebar_collapsed'

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,

  toggleSidebar: () => set((s) => {
    const next = !s.sidebarCollapsed
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch {}
    return { sidebarCollapsed: next }
  }),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}))

export function readStoredSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
