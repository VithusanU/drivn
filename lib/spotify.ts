const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? ''
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
].join(' ')

function getRedirectUri() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/auth/spotify/callback`
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

export async function startSpotifyAuth(returnPath: string) {
  const verifier = base64url(randomBytes(32))
  const challenge = await generateChallenge(verifier)

  sessionStorage.setItem('spotify_verifier', verifier)
  sessionStorage.setItem('spotify_return', returnPath)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  })

  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function exchangeSpotifyCode(code: string): Promise<boolean> {
  const verifier = sessionStorage.getItem('spotify_verifier')
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
  sessionStorage.removeItem('spotify_verifier')
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

// ── API calls ────────────────────────────────────────────────────────────────

async function spotifyFetch(path: string, options?: RequestInit) {
  const token = await getSpotifyToken()
  if (!token) return null
  return fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options?.headers },
  })
}

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
