'use client'

import { useEffect, useRef, useState } from 'react'
import { getSpotifyToken, transferPlayback, type SpotifyTrack } from '@/lib/spotify'

// Minimal Spotify Web Playback SDK types
declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      }) => SpotifySDKPlayer
    }
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

interface SpotifySDKPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  togglePlay(): Promise<void>
  nextTrack(): Promise<void>
  previousTrack(): Promise<void>
  addListener(event: 'ready', cb: (data: { device_id: string }) => void): void
  addListener(event: 'not_ready', cb: (data: { device_id: string }) => void): void
  addListener(event: 'player_state_changed', cb: (state: SpotifySDKState | null) => void): void
  addListener(event: 'initialization_error' | 'authentication_error' | 'account_error', cb: (data: { message: string }) => void): void
}

interface SpotifySDKState {
  paused: boolean
  position: number
  track_window: {
    current_track: {
      name: string
      duration_ms: number
      artists: { name: string }[]
      album: { images: { url: string }[] }
    }
  }
}

function loadSDK(): Promise<void> {
  return new Promise((resolve) => {
    if (window.Spotify) { resolve(); return }
    window.onSpotifyWebPlaybackSDKReady = resolve
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    document.body.appendChild(script)
  })
}

export function useSpotifyPlayer(connected: boolean) {
  const [track, setTrack] = useState<SpotifyTrack | null>(null)
  const [ready, setReady] = useState(false)
  const playerRef = useRef<SpotifySDKPlayer | null>(null)
  const deviceIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!connected) return

    let cancelled = false

    async function init() {
      await loadSDK()
      if (cancelled) return

      const player = new window.Spotify.Player({
        name: 'Drivn',
        getOAuthToken: async (cb) => {
          const token = await getSpotifyToken()
          if (token) cb(token)
        },
        volume: 0.5,
      })

      player.addListener('ready', async ({ device_id }) => {
        deviceIdRef.current = device_id
        setReady(true)
        // Transfer playback to browser without auto-starting
        await transferPlayback(device_id, false)
      })

      player.addListener('not_ready', () => {
        deviceIdRef.current = null
        setReady(false)
      })

      player.addListener('player_state_changed', (state) => {
        if (!state) { setTrack(null); return }
        const item = state.track_window.current_track
        setTrack({
          name: item.name,
          artists: item.artists.map((a) => a.name).join(', '),
          albumArt: item.album.images[0]?.url ?? '',
          isPlaying: !state.paused,
          progressMs: state.position,
          durationMs: item.duration_ms,
        })
      })

      player.addListener('authentication_error', () => setReady(false))
      player.addListener('account_error', () => setReady(false))
      player.addListener('initialization_error', () => setReady(false))

      await player.connect()
      playerRef.current = player
    }

    init()

    return () => {
      cancelled = true
      playerRef.current?.disconnect()
      playerRef.current = null
      deviceIdRef.current = null
      setReady(false)
      setTrack(null)
    }
  }, [connected])

  const toggle = () => playerRef.current?.togglePlay()
  const next = () => playerRef.current?.nextTrack()
  const prev = () => playerRef.current?.previousTrack()

  return { track, ready, toggle, next, prev }
}
