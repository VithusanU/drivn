'use client'

import { create } from 'zustand'
import {
  isSpotifyConnected,
  getSpotifyToken,
  transferPlayback,
  type SpotifyTrack,
} from '@/lib/spotify'

// ── SDK types (same as useSpotifyPlayer.ts, globally merged by TS) ────────────
interface SpotifySDKPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  togglePlay(): Promise<void>
  nextTrack(): Promise<void>
  previousTrack(): Promise<void>
  addListener(event: 'ready', cb: (data: { device_id: string }) => void): void
  addListener(event: 'not_ready', cb: (data: { device_id: string }) => void): void
  addListener(event: 'player_state_changed', cb: (state: SpotifySDKState | null) => void): void
  addListener(
    event: 'initialization_error' | 'authentication_error' | 'account_error',
    cb: (data: { message: string }) => void
  ): void
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

declare global {
  interface Window {
    Spotify: { Player: new (opts: { name: string; getOAuthToken: (cb: (t: string) => void) => void; volume?: number }) => SpotifySDKPlayer }
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

// ── Module-level singleton — survives navigation, not stored in Zustand ───────
let _player: SpotifySDKPlayer | null = null
let _initializing = false

function loadSDK(): Promise<void> {
  return new Promise((resolve) => {
    if (window.Spotify) { resolve(); return }
    window.onSpotifyWebPlaybackSDKReady = resolve
    const s = document.createElement('script')
    s.src = 'https://sdk.scdn.co/spotify-player.js'
    document.body.appendChild(s)
  })
}

// ── Store ──────────────────────────────────────────────────────────────────────
export interface SpotifyStore {
  connected: boolean
  track: SpotifyTrack | null
  ready: boolean

  initFromStorage: () => void
  setConnected: (v: boolean) => void
  initPlayer: () => Promise<void>
  destroyPlayer: () => void
  toggle: () => void
  next: () => void
  prev: () => void
}

export const useSpotifyStore = create<SpotifyStore>((set, get) => ({
  connected: false,
  track: null,
  ready: false,

  initFromStorage: () => {
    const wasConnected = get().connected
    const isNowConnected = isSpotifyConnected()
    set({ connected: isNowConnected })
    // If the token was cleared externally while the tab was hidden (expired/
    // revoked), tear down the stale SDK player so it stops trying to play
    // with a dead token.
    if (wasConnected && !isNowConnected && _player) {
      _player.disconnect()
      _player = null
      _initializing = false
      set({ ready: false, track: null })
    }
  },

  setConnected: (v) => set({ connected: v }),

  initPlayer: async () => {
    if (_player || _initializing) return
    if (typeof window === 'undefined') return
    _initializing = true

    try {
      await loadSDK()

      // Check we're still connected after the async SDK load
      if (!get().connected) return

      const player = new window.Spotify.Player({
        name: 'Drivn',
        getOAuthToken: async (cb) => {
          const token = await getSpotifyToken()
          if (token) {
            cb(token)
          } else {
            // Refresh failed mid-session — destroy the player cleanly so the
            // widget shows the reconnect UI instead of hanging silently.
            get().destroyPlayer()
          }
        },
        volume: 0.5,
      })

      player.addListener('ready', async ({ device_id }) => {
        set({ ready: true })
        await transferPlayback(device_id, false)
      })

      player.addListener('not_ready', () => {
        set({ ready: false })
      })

      player.addListener('player_state_changed', (state) => {
        if (!state) { set({ track: null }); return }
        const item = state.track_window.current_track
        set({
          track: {
            name: item.name,
            artists: item.artists.map((a) => a.name).join(', '),
            albumArt: item.album.images[0]?.url ?? '',
            isPlaying: !state.paused,
            progressMs: state.position,
            durationMs: item.duration_ms,
          },
        })
      })

      // Auth errors mean the token is no longer valid — fully disconnect so
      // the reconnect UI appears. Account/init errors aren't auth problems so
      // we just mark the player not ready without clearing the connection.
      player.addListener('authentication_error', () => get().destroyPlayer())
      player.addListener('account_error', () => set({ ready: false }))
      player.addListener('initialization_error', () => set({ ready: false }))

      await player.connect()
      _player = player
    } finally {
      _initializing = false
    }
  },

  destroyPlayer: () => {
    _player?.disconnect()
    _player = null
    _initializing = false
    set({ ready: false, track: null, connected: false })
  },

  toggle: () => _player?.togglePlay(),
  next: () => _player?.nextTrack(),
  prev: () => _player?.previousTrack(),
}))
