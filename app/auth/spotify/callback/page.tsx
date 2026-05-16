'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { exchangeSpotifyCode } from '@/lib/spotify'

function SpotifyCallback() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const returnPath = sessionStorage.getItem('spotify_return') ?? '/'

    if (error || !code) {
      window.location.replace(returnPath)
      return
    }

    exchangeSpotifyCode(code).then(() => {
      window.location.replace(returnPath)
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground animate-pulse">Connecting Spotify…</p>
    </div>
  )
}

export default function SpotifyCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground animate-pulse">Connecting Spotify…</p>
      </div>
    }>
      <SpotifyCallback />
    </Suspense>
  )
}
