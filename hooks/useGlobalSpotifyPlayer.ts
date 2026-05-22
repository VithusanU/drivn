'use client'

import { useEffect } from 'react'
import { useSpotifyStore } from '@/stores/spotifyStore'

export function useGlobalSpotifyPlayer() {
  const initFromStorage = useSpotifyStore((s) => s.initFromStorage)
  const connected = useSpotifyStore((s) => s.connected)
  const initPlayer = useSpotifyStore((s) => s.initPlayer)

  // Sync connected state from localStorage on mount and when tab regains focus
  useEffect(() => {
    initFromStorage()
    const onFocus = () => initFromStorage()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [initFromStorage])

  // Start the player as soon as connected — lives in layout so it never gets torn down
  useEffect(() => {
    if (connected) initPlayer()
  }, [connected, initPlayer])
}
