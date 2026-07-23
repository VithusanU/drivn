'use client'

import { useState, useEffect } from 'react'
import { Smartphone, X } from 'lucide-react'
import { Analytics } from '@/lib/analytics'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'drivn_install_banner_dismissed'

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed or already installed
    if (localStorage.getItem(DISMISSED_KEY)) return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
      Analytics.pwaInstallPrompted()
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') Analytics.pwaInstalled()
    dismiss()
  }

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-[72px] left-0 right-0 z-50 px-4 pb-2 md:bottom-4">
      <div className="max-w-sm mx-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border shadow-lg">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-foreground">Add Drivn to home screen</p>
          <p className="text-[11px] text-muted-foreground/60">Open in one tap, like a native app</p>
        </div>
        <button
          onClick={handleInstall}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium"
        >
          Install
        </button>
        <button
          onClick={dismiss}
          className="flex-shrink-0 p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
