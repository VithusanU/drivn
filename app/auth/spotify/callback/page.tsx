'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { exchangeSpotifyCode } from '@/lib/spotify'

export default function SpotifyCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const returnPath = sessionStorage.getItem('spotify_return') ?? '/'

    if (error || !code) {
      router.replace(returnPath)
      return
    }

    exchangeSpotifyCode(code).then(() => {
      router.replace(returnPath)
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground animate-pulse">Connecting Spotify…</p>
    </div>
  )
}
