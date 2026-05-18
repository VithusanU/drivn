'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Analytics } from '@/lib/analytics'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

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
