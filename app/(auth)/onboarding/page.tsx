'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    headline: 'Stop organizing.\nStart executing.',
    subtext: 'Drivn reduces the friction between planning and action.',
    emoji: '⚡',
  },
  {
    headline: 'Always know\nwhat to do next.',
    subtext: 'Your Next Best Action is always front and center.',
    emoji: '🎯',
  },
  {
    headline: 'Build momentum\ndaily.',
    subtext: 'Track consistency without overwhelming systems.',
    emoji: '🔥',
  },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const isLast = step === STEPS.length - 1

  const handleNext = async () => {
    if (!isLast) {
      setStep((s) => s + 1)
      return
    }
    // Seed default habits and enter app
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.rpc('seed_default_habits', { p_user_id: user.id })
    }
    router.push('/')
  }

  const current = STEPS[step]

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-background px-6 py-16">
      {/* Progress dots */}
      <div className="flex gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 rounded-full transition-all duration-300',
              i === step ? 'w-6 bg-primary' : 'w-2 bg-muted'
            )}
          />
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="text-center flex flex-col items-center"
        >
          <span className="text-5xl mb-8">{current.emoji}</span>
          <h1 className="text-[28px] font-medium text-foreground leading-snug mb-4 whitespace-pre-line">
            {current.headline}
          </h1>
          <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
            {current.subtext}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* CTA */}
      <button
        onClick={handleNext}
        disabled={loading}
        className={cn(
          'w-full py-4 rounded-2xl text-[16px] font-medium',
          'bg-primary text-primary-foreground',
          'transition-all active:scale-[0.98] hover:bg-primary/90',
          'disabled:opacity-50'
        )}
      >
        {isLast ? (loading ? 'Setting up…' : 'Enter Drivn') : 'Next'}
      </button>
    </div>
  )
}
