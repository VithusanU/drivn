'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SkipBack, SkipForward, Play, Pause, Music, Unlink, ExternalLink } from 'lucide-react'
import { isSpotifyConnected, startSpotifyAuth, disconnectSpotify } from '@/lib/spotify'
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer'
import { cn } from '@/lib/utils'

interface MusicWidgetProps {
  returnPath: string
}

export default function MusicWidget({ returnPath }: MusicWidgetProps) {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const { track, ready, toggle, next, prev } = useSpotifyPlayer(connected)

  useEffect(() => {
    setConnected(isSpotifyConnected())
  }, [])

  const handleConnect = async () => {
    setLoading(true)
    await startSpotifyAuth(returnPath)
  }

  const handleDisconnect = () => {
    disconnectSpotify()
    setConnected(false)
  }

  const handlePlayPause = () => toggle()
  const handleNext = () => next()
  const handlePrev = () => prev()

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
            <div className={cn(
              'rounded-2xl border border-border bg-card p-4',
              'flex flex-col gap-3'
            )}>
              {!connected ? (
                /* ── Not connected ── */
                <div className="space-y-2">
                  <p className="text-[12px] text-muted-foreground/60 text-center mb-1">Connect music</p>

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
                    {loading ? 'Redirecting…' : 'Connect Spotify'}
                  </button>

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
                </div>
              ) : (
                /* ── Connected ── */
                <>
                  {!ready && !track ? (
                    <p className="text-[12px] text-muted-foreground/50 text-center">Connecting player…</p>
                  ) : track ? (
                    <div className="flex items-center gap-3">
                      {track.albumArt && (
                        <img
                          src={track.albumArt}
                          alt=""
                          className="w-10 h-10 rounded-lg flex-shrink-0 object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{track.name}</p>
                        <p className="text-[11px] text-muted-foreground/60 truncate">{track.artists}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-muted-foreground/50 text-center">Nothing playing</p>
                  )}

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-4">
                    <button onClick={handlePrev} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handlePlayPause}
                      className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center',
                        'bg-[#1DB954] text-white hover:bg-[#1DB954]/90 transition-colors'
                      )}
                    >
                      {track?.isPlaying
                        ? <Pause className="w-4 h-4 fill-white" />
                        : <Play className="w-4 h-4 fill-white ml-0.5" />
                      }
                    </button>
                    <button onClick={handleNext} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Track progress bar */}
                  {track && track.durationMs > 0 && (
                    <div className="h-0.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full bg-[#1DB954] rounded-full"
                        style={{ width: `${(track.progressMs / track.durationMs) * 100}%` }}
                      />
                    </div>
                  )}

                  <button
                    onClick={handleDisconnect}
                    className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                  >
                    <Unlink className="w-3 h-3" />
                    Disconnect
                  </button>
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
