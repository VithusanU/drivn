'use client'

import { useEffect } from 'react'
import { useTimerStore } from '@/stores/timerStore'

export function useGlobalTimer() {
  const tick = useTimerStore((s) => s.tick)
  const taskId = useTimerStore((s) => s.taskId)

  // Drive the timer interval — lives in the layout so it persists across navigation
  useEffect(() => {
    if (!taskId) return
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [taskId, tick])

  // Sync display immediately when the tab becomes visible again
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) useTimerStore.getState().tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
}
