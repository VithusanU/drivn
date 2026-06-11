'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function playCompletionSound() {
  try {
    const ctx = new AudioContext()
    const notes = [523, 659, 784]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = ctx.currentTime + i * 0.2
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.4, start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7)
      osc.start(start)
      osc.stop(start + 0.7)
    })
  } catch { /* blocked */ }
}

async function showTimerNotification(taskTitle?: string) {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    reg.showNotification('Time is up! ⏰', {
      body: taskTitle
        ? `Your focus session on "${taskTitle}" is complete.`
        : 'Your focus session is complete.',
      icon: '/logo.png',
      badge: '/logo.png',
    })
  } catch {
    try {
      new Notification('Time is up! ⏰', {
        body: taskTitle
          ? `Your focus session on "${taskTitle}" is complete.`
          : 'Your focus session is complete.',
        icon: '/logo.png',
      })
    } catch { /* denied */ }
  }
}

export interface TimerStore {
  // Task timer
  taskId: string | null
  taskTitle: string | null
  secondsLeft: number
  totalSeconds: number
  running: boolean
  timeUp: boolean
  endTimeMs: number
  pausedRemainingMs: number | null

  // Break timer
  breakActive: boolean
  breakSecondsLeft: number
  breakTotalSeconds: number
  breakEndTimeMs: number

  // Actions
  initTimer: (taskId: string, taskTitle: string, minutes: number) => void
  clearTimer: () => void
  pause: () => void
  resume: () => void
  addTime: (minutes: number) => void
  tick: () => void
  startBreak: (minutes: number) => void
  endBreak: () => void
  fireCompletion: () => void
}

export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      taskId: null,
      taskTitle: null,
      secondsLeft: 0,
      totalSeconds: 0,
      running: false,
      timeUp: false,
      endTimeMs: 0,
      pausedRemainingMs: null,

      breakActive: false,
      breakSecondsLeft: 0,
      breakTotalSeconds: 0,
      breakEndTimeMs: 0,

      initTimer: (taskId, taskTitle, minutes) => {
        const totalSeconds = minutes * 60
        set({
          taskId,
          taskTitle,
          secondsLeft: totalSeconds,
          totalSeconds,
          running: true,
          timeUp: false,
          endTimeMs: Date.now() + totalSeconds * 1000,
          pausedRemainingMs: null,
          breakActive: false,
          breakSecondsLeft: 0,
          breakTotalSeconds: 0,
          breakEndTimeMs: 0,
        })
      },

      clearTimer: () => set({
        taskId: null,
        taskTitle: null,
        secondsLeft: 0,
        totalSeconds: 0,
        running: false,
        timeUp: false,
        endTimeMs: 0,
        pausedRemainingMs: null,
        breakActive: false,
        breakSecondsLeft: 0,
        breakTotalSeconds: 0,
        breakEndTimeMs: 0,
      }),

      pause: () => {
        const { endTimeMs } = get()
        set({ running: false, pausedRemainingMs: endTimeMs - Date.now() })
      },

      resume: () => {
        const { pausedRemainingMs, secondsLeft } = get()
        const remainingMs = pausedRemainingMs ?? secondsLeft * 1000
        set({ running: true, endTimeMs: Date.now() + remainingMs, pausedRemainingMs: null })
      },

      addTime: (minutes) => {
        const { endTimeMs, totalSeconds, pausedRemainingMs, timeUp } = get()
        const extraMs = minutes * 60 * 1000
        // Once the timer hits zero, endTimeMs is stuck in the past (it's the
        // instant the timer expired). Adding minutes on top of a stale past
        // timestamp would only grant however much time has elapsed since
        // expiry plus the requested minutes — e.g. tapping "+30m" 25 minutes
        // after expiry would only add 5 minutes. Re-anchor to now instead.
        const baseMs = timeUp ? Date.now() : endTimeMs
        set({
          endTimeMs: baseMs + extraMs,
          totalSeconds: totalSeconds + minutes * 60,
          secondsLeft: Math.round((baseMs + extraMs - Date.now()) / 1000),
          timeUp: false,
          running: true,
          ...(pausedRemainingMs !== null ? { pausedRemainingMs: pausedRemainingMs + extraMs } : {}),
        })
      },

      tick: () => {
        const state = get()
        if (!state.taskId) return

        if (state.breakActive) {
          const remaining = Math.round((state.breakEndTimeMs - Date.now()) / 1000)
          if (remaining <= 0) {
            const newEndTimeMs = Date.now() + (state.pausedRemainingMs ?? state.secondsLeft * 1000)
            set({
              breakActive: false,
              breakSecondsLeft: 0,
              endTimeMs: newEndTimeMs,
              pausedRemainingMs: null,
              running: true,
            })
          } else {
            set({ breakSecondsLeft: remaining })
          }
          return
        }

        if (!state.running || state.timeUp) return

        const remaining = Math.round((state.endTimeMs - Date.now()) / 1000)
        if (remaining <= 0) {
          get().fireCompletion()
        } else {
          set({ secondsLeft: remaining })
        }
      },

      startBreak: (minutes) => {
        const { endTimeMs, running, pausedRemainingMs, secondsLeft } = get()
        const remainingMs = running
          ? endTimeMs - Date.now()
          : (pausedRemainingMs ?? secondsLeft * 1000)
        set({
          running: false,
          pausedRemainingMs: Math.max(0, remainingMs),
          breakActive: true,
          breakTotalSeconds: minutes * 60,
          breakSecondsLeft: minutes * 60,
          breakEndTimeMs: Date.now() + minutes * 60 * 1000,
        })
      },

      endBreak: () => {
        const { pausedRemainingMs, secondsLeft } = get()
        const remainingMs = pausedRemainingMs ?? secondsLeft * 1000
        set({
          breakActive: false,
          breakSecondsLeft: 0,
          breakEndTimeMs: 0,
          endTimeMs: Date.now() + remainingMs,
          pausedRemainingMs: null,
          running: true,
        })
      },

      fireCompletion: () => {
        set({ running: false, secondsLeft: 0, timeUp: true })
        playCompletionSound()
        showTimerNotification(get().taskTitle ?? undefined)
      },
    }),
    {
      name: 'drivn-timer',
      // On rehydration the wall-clock endTimeMs auto-corrects remaining time
      // Only persist the fields needed to restore state
      partialize: (state) => ({
        taskId: state.taskId,
        taskTitle: state.taskTitle,
        secondsLeft: state.secondsLeft,
        totalSeconds: state.totalSeconds,
        running: state.running,
        timeUp: state.timeUp,
        endTimeMs: state.endTimeMs,
        pausedRemainingMs: state.pausedRemainingMs,
        breakActive: state.breakActive,
        breakSecondsLeft: state.breakSecondsLeft,
        breakTotalSeconds: state.breakTotalSeconds,
        breakEndTimeMs: state.breakEndTimeMs,
      }),
    }
  )
)
