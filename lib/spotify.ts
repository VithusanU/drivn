const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? ''
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
].join(' ')

export const LIKED_SONGS_ID = 'liked-songs'

function getRedirectUri() {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/spotify/callback`
  }
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/spotify/callback`
}

// ── PKCE helpers ────────────────────────────────────────────────────────────

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

function base64url(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64url(digest)
}

// ── Auth flow ────────────────────────────────────────────────────────────────

export async function startSpotifyAuth() {
  // Open popup immediately (before any await) so browsers don't block it
  const popup = window.open('about:blank', 'spotify-auth', 'width=500,height=700,left=400,top=100')

  const verifier = base64url(randomBytes(32))
  const challenge = await generateChallenge(verifier)
  localStorage.setItem('spotify_verifier', verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  })

  const url = `https://accounts.spotify.com/authorize?${params}`

  if (popup) {
    popup.location.href = url
  } else {
    // Popup was blocked — fall back to full-page redirect
    sessionStorage.setItem('spotify_return', window.location.pathname)
    window.location.href = url
    return new Promise<boolean>(() => {})
  }

  return new Promise<boolean>((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'spotify-auth-success') {
        window.removeEventListener('message', onMessage)
        popup.close()
        resolve(true)
      } else if (event.data?.type === 'spotify-auth-error') {
        window.removeEventListener('message', onMessage)
        popup.close()
        resolve(false)
      }
    }
    window.addEventListener('message', onMessage)

    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer)
        window.removeEventListener('message', onMessage)
        resolve(false)
      }
    }, 500)
  })
}

export async function exchangeSpotifyCode(code: string): Promise<boolean> {
  const verifier = localStorage.getItem('spotify_verifier')
  if (!verifier) return false

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
    }),
  })

  if (!res.ok) return false
  const data = await res.json()

  localStorage.setItem('spotify_access_token', data.access_token)
  localStorage.setItem('spotify_refresh_token', data.refresh_token)
  localStorage.setItem('spotify_expires_at', String(Date.now() + data.expires_in * 1000))
  localStorage.removeItem('spotify_verifier')
  return true
}

export async function refreshSpotifyToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('spotify_refresh_token')
  if (!refreshToken) return null

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) { disconnectSpotify(); return null }
  const data = await res.json()

  localStorage.setItem('spotify_access_token', data.access_token)
  localStorage.setItem('spotify_expires_at', String(Date.now() + data.expires_in * 1000))
  if (data.refresh_token) localStorage.setItem('spotify_refresh_token', data.refresh_token)
  return data.access_token
}

export async function getSpotifyToken(): Promise<string | null> {
  const token = localStorage.getItem('spotify_access_token')
  const expiresAt = Number(localStorage.getItem('spotify_expires_at') ?? 0)
  if (!token) return null
  if (Date.now() > expiresAt - 60_000) return refreshSpotifyToken()
  return token
}

export function isSpotifyConnected(): boolean {
  return !!localStorage.getItem('spotify_access_token')
}

export function disconnectSpotify() {
  localStorage.removeItem('spotify_access_token')
  localStorage.removeItem('spotify_refresh_token')
  localStorage.removeItem('spotify_expires_at')
}

// ── API helpers ──────────────────────────────────────────────────────────────

async function spotifyFetch(path: string, options?: RequestInit) {
  let token: string | null
  try {
    token = await getSpotifyToken()
  } catch {
    return null
  }
  if (!token) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000) // 15-second hard timeout
  try {
    return await fetch(`https://api.spotify.com/v1${path}`, {
      ...options,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...options?.headers },
    })
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ── Playback ─────────────────────────────────────────────────────────────────

export interface SpotifyTrack {
  name: string
  artists: string
  albumArt: string
  isPlaying: boolean
  progressMs: number
  durationMs: number
}

export async function getCurrentTrack(): Promise<SpotifyTrack | null> {
  const res = await spotifyFetch('/me/player/currently-playing')
  if (!res || res.status === 204) return null
  if (!res.ok) return null
  const data = await res.json()
  if (!data?.item) return null
  return {
    name: data.item.name,
    artists: data.item.artists.map((a: { name: string }) => a.name).join(', '),
    albumArt: data.item.album.images[0]?.url ?? '',
    isPlaying: data.is_playing,
    progressMs: data.progress_ms,
    durationMs: data.item.duration_ms,
  }
}

export async function spotifyPlay() {
  await spotifyFetch('/me/player/play', { method: 'PUT' })
}

export async function spotifyPause() {
  await spotifyFetch('/me/player/pause', { method: 'PUT' })
}

export async function spotifyNext() {
  await spotifyFetch('/me/player/next', { method: 'POST' })
}

export async function spotifyPrev() {
  await spotifyFetch('/me/player/previous', { method: 'POST' })
}

export async function transferPlayback(deviceId: string, play = false) {
  await spotifyFetch('/me/player', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play }),
  })
}

export async function playContext(contextUri: string, offsetUri?: string) {
  await spotifyFetch('/me/player/play', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      offsetUri
        ? { context_uri: contextUri, offset: { uri: offsetUri } }
        : { context_uri: contextUri }
    ),
  })
}

// ── Playlists ─────────────────────────────────────────────────────────────────

export interface SpotifyPlaylist {
  id: string
  name: string
  imageUrl: string
  trackCount: number
  uri: string
}

export interface SpotifyPlaylistTrack {
  id: string
  name: string
  artists: string
  albumArt: string
  uri: string
  durationMs: number
}

export async function getUserPlaylists(): Promise<SpotifyPlaylist[]> {
  const res = await spotifyFetch('/me/playlists?limit=50')
  if (!res) throw new Error('network')
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`spotify_${res.status}`)
  const data = await res.json()

  const playlists: SpotifyPlaylist[] = (data.items ?? [])
    .filter(Boolean)
    .map((p: {
      id: string; name: string; uri: string;
      images: { url: string }[] | null;
      tracks: { total: number } | null;
    }) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.images?.[0]?.url ?? '',
      trackCount: p.tracks?.total ?? 0,
      uri: p.uri,
    }))

  // Prepend Liked Songs (requires user-library-read scope)
  const likedSongs: SpotifyPlaylist = {
    id: LIKED_SONGS_ID,
    name: 'Liked Songs',
    imageUrl: '',
    trackCount: -1, // fetched separately
    uri: LIKED_SONGS_ID,
  }

  return [likedSongs, ...playlists]
}

export async function getPlaylistTracks(playlistId: string): Promise<SpotifyPlaylistTrack[]> {
  const res = await spotifyFetch(`/playlists/${playlistId}/tracks?limit=50&market=from_token`)
  if (!res) throw new Error('network')
  if (res.status === 401) throw new Error('unauthorized')
  if (res.status === 403) throw new Error('forbidden')
  if (!res.ok) throw new Error(`spotify_${res.status}`)
  const data = await res.json()
  return (data.items ?? [])
    .filter((i: { track: { id: string } | null }) => i?.track?.id)
    .map((i: {
      track: {
        id: string; name: string; uri: string; duration_ms: number;
        artists: { name: string }[] | null;
        album: { images: { url: string }[] } | null;
        type?: string;
      }
    }) => ({
      id: i.track.id,
      name: i.track.name ?? 'Unknown',
      artists: i.track.artists?.map((a) => a.name).join(', ') ?? '',
      albumArt: i.track.album?.images?.[0]?.url ?? '',
      uri: i.track.uri,
      durationMs: i.track.duration_ms ?? 0,
    }))
}

export async function getLikedTracks(): Promise<SpotifyPlaylistTrack[]> {
  const res = await spotifyFetch('/me/tracks?limit=50&market=from_token')
  if (!res) throw new Error('network')
  if (res.status === 401) throw new Error('unauthorized')
  if (res.status === 403) throw new Error('no_scope')
  if (!res.ok) throw new Error(`spotify_${res.status}`)
  const data = await res.json()
  return (data.items ?? [])
    .filter((i: { track: { id: string } | null }) => i?.track?.id)
    .map((i: {
      track: {
        id: string; name: string; uri: string; duration_ms: number;
        artists: { name: string }[] | null;
        album: { images: { url: string }[] } | null;
      }
    }) => ({
      id: i.track.id,
      name: i.track.name ?? 'Unknown',
      artists: i.track.artists?.map((a) => a.name).join(', ') ?? '',
      albumArt: i.track.album?.images?.[0]?.url ?? '',
      uri: i.track.uri,
      durationMs: i.track.duration_ms ?? 0,
    }))
}

export async function playTracks(uris: string[], offsetIndex = 0) {
  await spotifyFetch('/me/player/play', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris, offset: { position: offsetIndex } }),
  })
}
