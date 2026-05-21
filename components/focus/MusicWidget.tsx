'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SkipBack, SkipForward, Play, Pause, Music, Unlink, ListMusic, ChevronLeft, Clock, CheckCircle, ExternalLink } from 'lucide-react'
import {
  isSpotifyConnected, startSpotifyAuth, disconnectSpotify,
  getUserPlaylists, getPlaylistTracks, playContext,
  type SpotifyPlaylist, type SpotifyPlaylistTrack,
} from '@/lib/spotify'
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type View = 'player' | 'playlists' | 'tracks'
type RequestStatus = 'none' | 'pending' | 'approved' | 'denied' | 'loading'

export default function MusicWidget() {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [view, setView] = useState<View>('player')
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [tracks, setTracks] = useState<SpotifyPlaylistTrack[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null)
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseError, setBrowseError] = useState('')

  // Access request state
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('loading')
  const [spotifyEmail, setSpotifyEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const { track, ready, toggle, next, prev } = useSpotifyPlayer(connected)

  useEffect(() => {
    setConnected(isSpotifyConnected())
    checkRequestStatus()
    const onFocus = () => setConnected(isSpotifyConnected())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const checkRequestStatus = async () => {
    try {
      const supabase = createClient()
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) { setRequestStatus('none'); return }

      const { data } = await supabase
        .from('spotify_requests')
        .select('status')
        .eq('user_id', authData.user.id)
        .maybeSingle()

      setRequestStatus((data?.status as RequestStatus) ?? 'none')
    } catch {
      setRequestStatus('none')
    }
  }

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!spotifyEmail.trim()) return
    setSubmitting(true)
    setSubmitError('')

    const supabase = createClient()
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user) { setSubmitting(false); return }
    const user = authData.user

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    const { error } = await supabase.from('spotify_requests').upsert({
      user_id: user.id,
      user_email: profile?.email ?? user.email ?? '',
      user_name: profile?.full_name ?? '',
      spotify_email: spotifyEmail.trim().toLowerCase(),
      status: 'pending',
    })

    if (error) {
      setSubmitError('Failed to submit. Try again.')
    } else {
      setRequestStatus('pending')
    }
    setSubmitting(false)
  }

  const handleConnect = async () => {
    setLoading(true)
    setAuthError(false)
    const ok = await startSpotifyAuth()
    setLoading(false)
    if (ok) {
      setConnected(true)
    } else {
      setAuthError(true)
    }
  }

  const handleDisconnect = () => {
    disconnectSpotify()
    setConnected(false)
    setView('player')
  }

  const handleBrowse = useCallback(async () => {
    setView('playlists')
    if (playlists.length > 0) return
    setBrowseLoading(true)
    setBrowseError('')
    try {
      const data = await getUserPlaylists()
      if (data.length === 0 && !isSpotifyConnected()) {
        setConnected(false)
        setView('player')
        return
      }
      setPlaylists(data)
    } catch {
      setBrowseError('Failed to load playlists. Tap to retry.')
    } finally {
      setBrowseLoading(false)
    }
  }, [playlists.length])

  const handleSelectPlaylist = async (playlist: SpotifyPlaylist) => {
    setSelectedPlaylist(playlist)
    setView('tracks')
    setBrowseLoading(true)
    setBrowseError('')
    try {
      const data = await getPlaylistTracks(playlist.id)
      setTracks(data)
    } catch {
      setBrowseError('Failed to load tracks. Tap to go back and retry.')
    } finally {
      setBrowseLoading(false)
    }
  }

  const handlePlayTrack = async (trackUri: string) => {
    if (!selectedPlaylist) return
    await playContext(selectedPlaylist.uri, trackUri)
    setView('player')
  }

  const handlePlayPlaylist = async (playlist: SpotifyPlaylist) => {
    await playContext(playlist.uri)
    setView('player')
  }

  return (
    <div className="w-full max-w-xs mx-auto">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors mb-2 mx-auto"
      >
        <Music className="w-3 h-3" />
        {connected && track ? `${track.name} · ${track.artists}` : 'Music'}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">

              {!connected ? (
                <>
                  {requestStatus === 'loading' ? (
                    <p className="text-[12px] text-muted-foreground/50 text-center">Loading…</p>

                  ) : requestStatus === 'none' ? (
                    /* ── Options: open in tab or request access ── */
                    <div className="space-y-3">
                      <p className="text-[12px] text-muted-foreground/60 text-center">Connect music</p>

                      {/* Open in new tab */}
                      <a
                        href="https://open.spotify.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'w-full flex items-center justify-center gap-2.5',
                          'py-2.5 rounded-xl border border-border',
                          'bg-[#1DB954]/10 border-[#1DB954]/30 text-[#1DB954]',
                          'text-[13px] font-medium transition-all hover:bg-[#1DB954]/15'
                        )}
                      >
                        <SpotifyIcon />
                        Open Spotify
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>
                      <a
                        href="https://music.apple.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'w-full flex items-center justify-center gap-2.5',
                          'py-2.5 rounded-xl border border-border',
                          'text-muted-foreground text-[13px] font-medium',
                          'transition-all hover:bg-secondary'
                        )}
                      >
                        <AppleMusicIcon />
                        Open Apple Music
                        <ExternalLink className="w-3 h-3 opacity-40" />
                      </a>

                      {/* Divider */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground/40">or connect in-app</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>

                      {/* Request access form */}
                      <form onSubmit={handleSubmitRequest} className="space-y-2">
                        <input
                          type="email"
                          value={spotifyEmail}
                          onChange={(e) => setSpotifyEmail(e.target.value)}
                          placeholder="your@spotify.com"
                          required
                          className={cn(
                            'w-full px-3 py-2.5 rounded-xl text-sm',
                            'bg-background border border-border text-foreground',
                            'placeholder:text-muted-foreground/40',
                            'outline-none focus:border-[#1DB954]/50 transition-colors'
                          )}
                        />
                        <button
                          type="submit"
                          disabled={submitting || !spotifyEmail}
                          className={cn(
                            'w-full flex items-center justify-center gap-2',
                            'py-2.5 rounded-xl border border-border',
                            'text-muted-foreground text-[13px] font-medium',
                            'transition-all hover:bg-secondary',
                            'disabled:opacity-50'
                          )}
                        >
                          {submitting ? 'Requesting…' : 'Request in-app access'}
                        </button>
                        {submitError && (
                          <p className="text-[11px] text-destructive text-center">{submitError}</p>
                        )}
                      </form>
                    </div>

                  ) : requestStatus === 'pending' ? (
                    /* ── Pending ── */
                    <div className="text-center space-y-2 py-1">
                      <Clock className="w-6 h-6 text-muted-foreground/40 mx-auto" />
                      <p className="text-[13px] font-medium text-foreground">Access requested</p>
                      <p className="text-[11px] text-muted-foreground/60">
                        You'll be able to connect once your request is approved.
                      </p>
                    </div>

                  ) : requestStatus === 'approved' ? (
                    /* ── Approved — show connect button ── */
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#1DB954] mb-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Access approved
                      </div>
                      <button
                        onClick={handleConnect}
                        disabled={loading}
                        className={cn(
                          'w-full flex items-center justify-center gap-2.5',
                          'py-2.5 rounded-xl border border-border',
                          'bg-[#1DB954]/10 border-[#1DB954]/30 text-[#1DB954]',
                          'text-[13px] font-medium transition-all hover:bg-[#1DB954]/15',
                          'disabled:opacity-50'
                        )}
                      >
                        <SpotifyIcon />
                        {loading ? 'Connecting…' : 'Connect Spotify'}
                      </button>
                      {authError && (
                        <p className="text-[11px] text-destructive text-center">
                          Connection failed. Try again.
                        </p>
                      )}
                    </div>

                  ) : requestStatus === 'denied' ? (
                    <div className="text-center py-1">
                      <p className="text-[12px] text-muted-foreground/60">
                        Your request was not approved. Contact support for help.
                      </p>
                    </div>
                  ) : null}
                </>

              ) : view === 'playlists' ? (
                /* ── Playlist browser ── */
                <>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setView('player')} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <p className="text-[12px] font-medium text-foreground">Your playlists</p>
                  </div>
                  {browseLoading ? (
                    <p className="text-[12px] text-muted-foreground/50 text-center py-2">Loading…</p>
                  ) : browseError ? (
                    <p className="text-[12px] text-destructive/70 text-center py-2">{browseError}</p>
                  ) : playlists.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground/50 text-center py-2">No playlists found</p>
                  ) : (
                    <div className="flex flex-col gap-1 max-h-56 overflow-y-auto no-scrollbar">
                      {playlists.map((pl) => (
                        <div key={pl.id} className="flex items-center gap-2.5 group">
                          {pl.imageUrl ? (
                            <img src={pl.imageUrl} alt="" className="w-8 h-8 rounded-md flex-shrink-0 object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-secondary flex-shrink-0 flex items-center justify-center">
                              <ListMusic className="w-3.5 h-3.5 text-muted-foreground/40" />
                            </div>
                          )}
                          <button onClick={() => handleSelectPlaylist(pl)} className="flex-1 text-left min-w-0">
                            <p className="text-[12px] font-medium text-foreground truncate group-hover:text-[#1DB954] transition-colors">{pl.name}</p>
                            <p className="text-[10px] text-muted-foreground/50">{pl.trackCount} tracks</p>
                          </button>
                          <button
                            onClick={() => handlePlayPlaylist(pl)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 w-6 h-6 rounded-full bg-[#1DB954] flex items-center justify-center"
                          >
                            <Play className="w-3 h-3 fill-white text-white ml-0.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>

              ) : view === 'tracks' ? (
                /* ── Track list ── */
                <>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setView('playlists')} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <p className="text-[12px] font-medium text-foreground truncate">{selectedPlaylist?.name}</p>
                  </div>
                  {browseLoading ? (
                    <p className="text-[12px] text-muted-foreground/50 text-center py-2">Loading…</p>
                  ) : browseError ? (
                    <p className="text-[12px] text-destructive/70 text-center py-2">{browseError}</p>
                  ) : (
                    <div className="flex flex-col gap-1 max-h-56 overflow-y-auto no-scrollbar">
                      {tracks.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handlePlayTrack(t.uri)}
                          className="flex items-center gap-2.5 group text-left hover:bg-secondary/50 rounded-lg px-1 py-1 transition-colors"
                        >
                          {t.albumArt ? (
                            <img src={t.albumArt} alt="" className="w-8 h-8 rounded-md flex-shrink-0 object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-secondary flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-foreground truncate group-hover:text-[#1DB954] transition-colors">{t.name}</p>
                            <p className="text-[10px] text-muted-foreground/50 truncate">{t.artists}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>

              ) : (
                /* ── Player ── */
                <>
                  {!ready && !track ? (
                    <p className="text-[12px] text-muted-foreground/50 text-center">Connecting player…</p>
                  ) : track ? (
                    <div className="flex items-center gap-3">
                      {track.albumArt && (
                        <img src={track.albumArt} alt="" className="w-10 h-10 rounded-lg flex-shrink-0 object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{track.name}</p>
                        <p className="text-[11px] text-muted-foreground/60 truncate">{track.artists}</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleBrowse}
                      className="text-[12px] text-muted-foreground/50 hover:text-[#1DB954] transition-colors text-center flex items-center justify-center gap-1.5"
                    >
                      <ListMusic className="w-3.5 h-3.5" />
                      Browse playlists
                    </button>
                  )}

                  <div className="flex items-center justify-center gap-4">
                    <button onClick={() => prev()} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggle()}
                      className="w-9 h-9 rounded-full flex items-center justify-center bg-[#1DB954] text-white hover:bg-[#1DB954]/90 transition-colors"
                    >
                      {track?.isPlaying
                        ? <Pause className="w-4 h-4 fill-white" />
                        : <Play className="w-4 h-4 fill-white ml-0.5" />
                      }
                    </button>
                    <button onClick={() => next()} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>

                  {track && track.durationMs > 0 && (
                    <div className="h-0.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full bg-[#1DB954] rounded-full"
                        style={{ width: `${(track.progressMs / track.durationMs) * 100}%` }}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleBrowse}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                    >
                      <ListMusic className="w-3 h-3" />
                      Browse
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                    >
                      <Unlink className="w-3 h-3" />
                      Disconnect
                    </button>
                  </div>
                </>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SpotifyIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  )
}

function AppleMusicIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.786.07 4.043.15 3.34.428 2.004.958 1.04 1.88.475 3.208A7.37 7.37 0 0 0 .05 5.08c-.013.5-.01 1-.01 1.5v10.85c0 .5-.003 1 .01 1.5a7.37 7.37 0 0 0 .425 1.87c.565 1.33 1.529 2.252 2.865 2.782.703.278 1.447.358 2.19.41.152.01.305.016.457.024h12.02c.152-.008.305-.014.458-.023.742-.052 1.486-.132 2.19-.41 1.335-.53 2.3-1.452 2.864-2.782.28-.7.357-1.44.41-2.19.013-.5.01-1 .01-1.5V6.624c0-.166.003-.333.003-.5zM9.337 17.03c0 1.004-.812 1.815-1.815 1.815S5.707 18.034 5.707 17.03V9.73c0-1.004.812-1.815 1.815-1.815s1.815.811 1.815 1.815v7.3zm9.253.043c0 1.003-.812 1.814-1.815 1.814s-1.815-.811-1.815-1.814v-3.65c0-1.003.812-1.814 1.815-1.814s1.815.811 1.815 1.814v3.65zm0-7.49c0 1.003-.812 1.814-1.815 1.814s-1.815-.811-1.815-1.814V6.934c0-1.004.812-1.815 1.815-1.815s1.815.811 1.815 1.815v2.65z"/>
    </svg>
  )
}
