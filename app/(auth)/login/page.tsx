'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Analytics } from '@/lib/analytics'

/** Returns true when running inside LinkedIn's (or any social) in-app WebView */
function detectInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return (
    /LinkedInApp/i.test(ua) ||           // LinkedIn iOS/Android native app
    /FBAN|FBAV/i.test(ua) ||             // Facebook
    /Instagram/i.test(ua) ||             // Instagram
    (/\bwv\b/.test(ua) && /LinkedIn/i.test(ua)) // Android WebView opened by LinkedIn
  )
}

/** Attempt to open the current URL in the device's real browser */
function openInExternalBrowser() {
  const url = window.location.href
  const ua = navigator.userAgent || ''
  // iOS: x-safari-https:// tells the OS to hand off to Safari
  if (/iPhone|iPad|iPod/i.test(ua)) {
    window.location.href = url.replace(/^https?:\/\//, 'x-safari-https://')
    return
  }
  // Android: intent:// scheme opens in Chrome
  if (/Android/i.test(ua)) {
    const intentUrl =
      'intent://' +
      url.replace(/^https?:\/\//, '') +
      '#Intent;scheme=https;package=com.android.chrome;end'
    window.location.href = intentUrl
    return
  }
  // Desktop fallback — just open a new tab
  window.open(url, '_blank')
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInApp, setIsInApp] = useState(false)
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setIsInApp(detectInAppBrowser())
    const params = new URLSearchParams(window.location.search)
    const prefill = params.get('email')
    if (prefill) setEmail(prefill)
  }, [])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    Analytics.signupStarted('google')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    Analytics.signupStarted('email')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
    else { setSent(true); setLoading(false) }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API not available — silent fail
    }
  }

  // ── In-app browser wall ──────────────────────────────────────────────────
  if (isInApp) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10 text-center"
        >
          <Image src="/logo.png" alt="Drivn" width={120} height={120} className="rounded-2xl dark:invert mx-auto" priority />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 text-center"
        >
          <div className="text-3xl mb-3">🔒</div>
          <h2 className="font-semibold text-foreground mb-2">Open in your browser</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Google sign-in doesn&apos;t work inside LinkedIn&apos;s browser.
            Tap below to open Drivn in Safari or Chrome.
          </p>

          {/* Primary CTA */}
          <button
            onClick={openInExternalBrowser}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl mb-3',
              'bg-primary text-primary-foreground text-sm font-medium',
              'transition-all hover:bg-primary/90 active:scale-[0.98]'
            )}
          >
            <ExternalLinkIcon />
            Open in Browser
          </button>

          {/* Copy link */}
          <button
            onClick={handleCopyLink}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl mb-5',
              'bg-secondary border border-border text-foreground text-sm font-medium',
              'transition-all hover:bg-secondary/80 active:scale-[0.98]'
            )}
          >
            {copied ? '✓ Link copied!' : 'Copy link to paste in browser'}
          </button>

          {/* LinkedIn tip */}
          <p className="text-xs text-muted-foreground mb-5">
            In the LinkedIn app, tap <span className="font-medium text-foreground">⋯</span> in the top right, then <span className="font-medium text-foreground">Open in browser</span>.
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground">or sign in with email instead</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email magic link — works in any browser/WebView */}
          {sent ? (
            <div className="py-3">
              <div className="text-2xl mb-2">📬</div>
              <p className="font-medium text-foreground text-sm">Check your email</p>
              <p className="text-xs text-muted-foreground mt-1">
                We sent a magic link to <span className="text-foreground">{email}</span>
              </p>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className={cn(
                  'w-full px-4 py-3 rounded-xl text-sm',
                  'bg-background border border-border text-foreground',
                  'placeholder:text-muted-foreground/50',
                  'outline-none focus:border-primary/50 transition-colors'
                )}
              />
              <button
                type="submit"
                disabled={loading || !email}
                className={cn(
                  'w-full py-3 rounded-xl text-sm font-medium',
                  'bg-primary text-primary-foreground',
                  'transition-all hover:bg-primary/90 active:scale-[0.98]',
                  'disabled:opacity-40'
                )}
              >
                {loading ? 'Sending…' : 'Continue with email'}
              </button>
              {error && <p className="text-xs text-destructive text-center">{error}</p>}
            </form>
          )}
        </motion.div>

        <p className="text-xs text-muted-foreground/40 mt-8 text-center max-w-xs">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    )
  }

  // ── Normal login page ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      {/* Logo / brand */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-12 text-center"
      >
        <div className="flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="Drivn"
            width={180}
            height={180}
            className="rounded-2xl dark:invert"
            priority
          />
        </div>
      </motion.div>

      {/* Auth card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className={cn(
          'w-full max-w-sm rounded-2xl',
          'bg-card border border-border p-6'
        )}
      >
        {sent ? (
          <div className="text-center py-4">
            <div className="text-2xl mb-3">📬</div>
            <p className="font-medium text-foreground">Check your email</p>
            <p className="text-sm text-muted-foreground mt-1">
              We sent a magic link to <span className="text-foreground">{email}</span>
            </p>
          </div>
        ) : (
          <>
            {/* Google */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className={cn(
                'w-full flex items-center justify-center gap-3 py-3 rounded-xl mb-4',
                'bg-secondary border border-border text-foreground text-sm font-medium',
                'transition-all hover:bg-secondary/80 active:scale-[0.98]',
                'disabled:opacity-50'
              )}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Email magic link */}
            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className={cn(
                  'w-full px-4 py-3 rounded-xl text-sm',
                  'bg-background border border-border text-foreground',
                  'placeholder:text-muted-foreground/50',
                  'outline-none focus:border-primary/50 transition-colors'
                )}
              />
              <button
                type="submit"
                disabled={loading || !email}
                className={cn(
                  'w-full py-3 rounded-xl text-sm font-medium',
                  'bg-primary text-primary-foreground',
                  'transition-all hover:bg-primary/90 active:scale-[0.98]',
                  'disabled:opacity-40'
                )}
              >
                {loading ? 'Sending…' : 'Continue with email'}
              </button>
            </form>

            {error && (
              <p className="text-xs text-destructive mt-3 text-center">{error}</p>
            )}
          </>
        )}
      </motion.div>

      <p className="text-xs text-muted-foreground/40 mt-8 text-center max-w-xs">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  )
}

function ExternalLinkIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
