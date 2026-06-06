'use client'

import { useEffect, useRef } from 'react'
import { useTimerStore } from '@/stores/timerStore'

/**
 * Syncs the user's live focus presence to the server whenever
 * the timer starts, stops, or the page mounts/unmounts.
 */
export function usePresenceSync() {
  const running = useTimerStore((s) => s.running)
  const taskId = useTimerStore((s) => s.taskId)
  const endTimeMs = useTimerStore((s) => s.endTimeMs)
  const prevRunningRef = useRef<boolean | null>(null)

  useEffect(() => {
    // Skip the initial render comparison — only fire on actual changes
    if (prevRunningRef.current === null) {
      prevRunningRef.current = running
      // Still sync on mount so presence is accurate after a page reload
      syncPresence(running, running ? new Date(Date.now() - (endTimeMs ? 0 : 0)).toISOString() : null)
      return
    }

    if (prevRunningRef.current === running) return
    prevRunningRef.current = running

    const focusStartedAt = running ? new Date().toISOString() : null
    syncPresence(running, focusStartedAt)
  }, [running, taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear presence on unmount (tab close / navigation)
  useEffect(() => {
    return () => {
      if (useTimerStore.getState().running) {
        syncPresence(false, null)
      }
    }
  }, [])
}

function syncPresence(isFocusing: boolean, focusStartedAt: string | null) {
  fetch('/api/friends/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isFocusing, focusStartedAt }),
  }).catch(() => {/* silent — presence is best-effort */})
}
