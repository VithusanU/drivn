'use client'

import { create } from 'zustand'

interface UndoState {
  label: string | null
  onUndo: (() => void) | null
  show: (label: string, onUndo: () => void) => void
  dismiss: () => void
}

export const useUndoStore = create<UndoState>((set) => ({
  label: null,
  onUndo: null,
  show: (label, onUndo) => set({ label, onUndo }),
  dismiss: () => set({ label: null, onUndo: null }),
}))
