'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Bell, BellOff, Clock, Heart, Sun, Moon, Check, ChevronDown, Smartphone, Repeat, Star, PlayCircle, Plus, Sparkles, Zap, Key, X, Camera, Link2, Loader2, Info, CalendarDays, Copy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUserStore } from '@/stores/userStore'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'
import ChangelogSheet from '@/components/ui/ChangelogSheet'
import {
  subscribeToPush, unsubscribeFromPush, isSubscribed,
  saveReminderTime, getReminderTime,
} from '@/lib/notifications'
import { getSavedAccounts, removeAccount } from '@/lib/savedAccounts'
import type { SavedAccount } from '@/lib/savedAccounts'

export default function ProfilePage() {
  const profile = useUserStore((s) => s.profile)
  const streak = useUserStore((s) => s.streak)
  const betaModeEnabled = useUserStore((s) => s.betaModeEnabled)
  const toggleBetaMode = useUserStore((s) => s.toggleBetaMode)
  const requestBetaAccess = useUserStore((s) => s.requestBetaAccess)
  const saveApiKey = useUserStore((s) => s.saveApiKey)
  const removeApiKey = useUserStore((s) => s.removeApiKey)
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifError, setNotifError] = useState<string | null>(null)
  const [notifBusy, setNotifBusy] = useState(false)
  const [reminderTime, setReminderTime] = useState('')
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [savingTime, setSavingTime] = useState(false)
  const [openGuide, setOpenGuide] = useState<string | null>(null)
  const [showChangelog, setShowChangelog] = useState(false)
  const [calUrl, setCalUrl] = useState<string | null>(null)
  const [calLoading, setCalLoading] = useState(false)
  const [calCopied, setCalCopied] = useState(false)
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([])

  // Beta access state
  const [betaRequest, setBetaRequest] = useState<{ status: string } | null | undefined>(undefined)
  const [betaRequesting, setBetaRequesting] = useState(false)
  const [betaRequestMsg, setBetaRequestMsg] = useState<string | null>(null)

  const hasBetaAccess = profile?.beta_access === true
  const hasOwnKey = !!profile?.anthropic_key_masked
  const AI_TRIAL_DAYS = 7
  const trialDaysLeft = profile?.created_at
    ? Math.max(0, AI_TRIAL_DAYS - Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000))
    : 0
  const isInTrial = trialDaysLeft > 0
  const canUseAI = hasBetaAccess || hasOwnKey || isInTrial

  // BYOK state
  const [keyInput, setKeyInput] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [keyMsg, setKeyMsg] = useState<string | null>(null)
  const [removingKey, setRemovingKey] = useState(false)

  // Inline account switcher state
  type SwitchStep = 'idle' | 'sending' | 'code' | 'verifying'
  const [switchSheet, setSwitchSheet] = useState<SavedAccount | 'new' | null>(null)
  const [switchStep, setSwitchStep] = useState<SwitchStep>('idle')
  const [switchEmail, setSwitchEmail] = useState('')
  const [switchCode, setSwitchCode] = useState('')
  const [switchError, setSwitchError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    isSubscribed().then(setNotifEnabled)
    getReminderTime().then((t) => { if (t) setReminderTime(t.slice(0, 5)) })
    setSavedAccounts(getSavedAccounts())
    fetchBetaRequest()
  }, [])

  const fetchBetaRequest = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('beta_requests')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle()
    setBetaRequest(data ?? null)
  }

  const handleRequestBeta = async () => {
    setBetaRequesting(true)
    setBetaRequestMsg(null)
    const result = await requestBetaAccess()
    if (result === 'ok') {
      setBetaRequest({ status: 'pending' })
      setBetaRequestMsg('Request sent! You\'ll be notified once approved.')
    } else if (result === 'already_requested') {
      setBetaRequest({ status: 'pending' })
      setBetaRequestMsg('You\'ve already submitted a request.')
    } else {
      setBetaRequestMsg('Something went wrong. Please try again.')
    }
    setBetaRequesting(false)
  }

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return
    setSavingKey(true)
    setKeyMsg(null)
    const result = await saveApiKey(keyInput.trim())
    if (result === 'ok') {
      setKeyInput('')
      setShowKeyInput(false)
      setKeyMsg(null)
    } else if (result === 'invalid') {
      setKeyMsg('Key must be an OpenRouter API key (starts with sk-or-)')
    } else {
      setKeyMsg('Failed to save. Try again.')
    }
    setSavingKey(false)
  }

  const handleRemoveKey = async () => {
    setRemovingKey(true)
    await removeApiKey()
    setRemovingKey(false)
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const openSwitchSheet = (account: SavedAccount) => {
    setSwitchSheet(account)
    setSwitchEmail(account.email)
    setSwitchStep('idle')
    setSwitchCode('')
    setSwitchError(null)
  }

  const openAddSheet = () => {
    setSwitchSheet('new')
    setSwitchEmail('')
    setSwitchStep('idle')
    setSwitchCode('')
    setSwitchError(null)
  }

  const closeSwitchSheet = () => {
    setSwitchSheet(null)
    setSwitchStep('idle')
    setSwitchCode('')
    setSwitchError(null)
  }

  const handleSendCode = async () => {
    const email = switchEmail.trim()
    if (!email) return
    setSwitchStep('sending')
    setSwitchError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (error) {
      setSwitchError(error.message)
      setSwitchStep('idle')
    } else {
      setSwitchStep('code')
    }
  }

  const handleVerifyCode = async () => {
    const email = switchEmail.trim()
    const token = switchCode.trim()
    if (!email || token.length < 6) return
    setSwitchStep('verifying')
    setSwitchError(null)
    const supabase = createClient()
    // Sign out current session first
    await supabase.auth.signOut()
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error) {
      setSwitchError('Invalid or expired code. Try sending a new one.')
      setSwitchStep('code')
    } else {
      window.location.href = '/'
    }
  }

  const handleRemoveAccount = (email: string) => {
    removeAccount(email)
    setSavedAccounts(getSavedAccounts())
  }

  const handleToggleNotifications = async () => {
    if (notifBusy) return
    setNotifBusy(true)
    setNotifError(null)
    try {
      if (notifEnabled) {
        await unsubscribeFromPush()
        setNotifEnabled(false)
      } else {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied') {
          setNotifError(
            'Notifications are blocked for this browser/app. Enable them in your device/browser settings, then try again.'
          )
          setNotifEnabled(false)
          return
        }
        const ok = await subscribeToPush()
        setNotifEnabled(ok)
        if (!ok) {
          setNotifError(
            "Couldn't turn on notifications. Make sure you opened Drivn from the home-screen icon (iPhone) and allowed the permission prompt, then try again."
          )
        }
      }
    } finally {
      setNotifBusy(false)
    }
  }

  const handleSaveReminder = async () => {
    if (!reminderTime) return
    setSavingTime(true)
    await saveReminderTime(reminderTime)
    setSavingTime(false)
    setShowTimePicker(false)
  }

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  const memberSince = profile?.created_at
    ? format(new Date(profile.created_at), 'MMMM yyyy')
    : ''

  return (
    <div className="px-4 pt-6 pb-6">
      {/* Header */}
      <h1 className="text-[22px] font-medium text-foreground mb-6">Profile</h1>

      {/* Avatar */}
      <div className="flex flex-col items-start mb-6">
        <div className={cn(
          'w-16 h-16 rounded-full mb-3',
          'bg-primary/15 border-2 border-primary/30',
          'flex items-center justify-center',
          'text-primary text-xl font-medium'
        )}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : initials}
        </div>
        <p className="text-xl font-medium text-foreground">
          {profile?.full_name ?? profile?.email ?? 'User'}
        </p>
        {memberSince && (
          <p className="text-[12px] text-muted-foreground mt-0.5">Member since {memberSince}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5 mb-8">
        {[
          { value: streak?.current_streak ?? 0, label: 'Day streak' },
          { value: streak?.total_tasks_completed ?? 0, label: 'Tasks done' },
          { value: streak?.longest_streak ?? 0, label: 'Best streak' },
        ].map(({ value, label }) => (
          <div key={label} className="bg-card/50 border border-border/50 rounded-2xl p-3.5 text-center">
            <p className="text-[22px] font-medium text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Settings */}
      <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3">
        Settings
      </p>
      <div className="rounded-2xl border border-border overflow-hidden">

        {/* Notifications toggle */}
        <button
          onClick={handleToggleNotifications}
          disabled={notifBusy}
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-foreground/65 hover:bg-secondary/50 transition-colors border-b border-border/50 disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            {notifEnabled
              ? <Bell className="w-4 h-4 text-primary" />
              : <BellOff className="w-4 h-4 text-muted-foreground" />
            }
            <span>Notifications</span>
          </div>
          <span className={cn('text-xs', notifEnabled ? 'text-primary' : 'text-muted-foreground/50')}>
            {notifBusy ? '…' : notifEnabled ? 'On' : 'Off'}
          </span>
        </button>
        {notifError && (
          <p className="px-4 py-2.5 text-[12px] text-destructive/80 bg-destructive/5 border-b border-border/50">
            {notifError}
          </p>
        )}

        {/* Daily reminder */}
        <div className="border-b border-border/50">
          <button
            onClick={() => notifEnabled && setShowTimePicker((v) => !v)}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3.5',
              'text-sm text-foreground/65 hover:bg-secondary/50 transition-colors',
              !notifEnabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>Daily reminder</span>
            </div>
            <span className="text-muted-foreground/50 text-xs">
              {reminderTime || '—'}
            </span>
          </button>

          {showTimePicker && (
            <div className="px-4 pb-4 flex items-center gap-2">
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className={cn(
                  'flex-1 px-3 py-2 rounded-xl border border-border/50 text-[13px]',
                  'bg-background text-foreground/70 outline-none focus:border-primary/40',
                  '[color-scheme:dark]'
                )}
              />
              <button
                onClick={handleSaveReminder}
                disabled={savingTime || !reminderTime}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-[13px] disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {savingTime ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Manage habits */}
        <button
          onClick={() => router.push('/habits')}
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-foreground/65 hover:bg-secondary/50 transition-colors border-b border-border/50"
        >
          <div className="flex items-center gap-3">
            <Heart className="w-4 h-4 text-muted-foreground" />
            <span>Manage habits</span>
          </div>
          <span className="text-muted-foreground/50 text-xs">›</span>
        </button>

        {/* Replay onboarding */}
        <button
          onClick={() => router.push('/onboarding?replay=true')}
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-foreground/65 hover:bg-secondary/50 transition-colors border-b border-border/50"
        >
          <div className="flex items-center gap-3">
            <PlayCircle className="w-4 h-4 text-muted-foreground" />
            <span>Replay onboarding</span>
          </div>
          <span className="text-muted-foreground/50 text-xs">›</span>
        </button>

        {/* Theme */}
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-foreground/65 hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {mounted && resolvedTheme === 'dark'
              ? <Moon className="w-4 h-4 text-muted-foreground" />
              : <Sun className="w-4 h-4 text-muted-foreground" />
            }
            <span>Theme</span>
          </div>
          <span className="text-muted-foreground/50 text-xs">
            {mounted ? (resolvedTheme === 'dark' ? 'Dark' : 'Light') : '—'}
          </span>
        </button>
      </div>

      {/* Beta */}
      <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3 mt-8">
        Beta
      </p>
      <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border/50">

        {/* ── AI mode toggle / access row ── */}
        {canUseAI ? (
          <button
            onClick={toggleBetaMode}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Sparkles className={cn('w-4 h-4', betaModeEnabled ? 'text-primary' : 'text-muted-foreground')} />
              <div className="text-left">
                <p className="text-sm text-foreground/80">AI mode</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                  {hasOwnKey ? 'Using your own API key'
                    : hasBetaAccess ? 'AI-powered recommendations'
                    : isInTrial ? `Free trial · ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left`
                    : 'AI-powered recommendations'}
                </p>
              </div>
            </div>
            <span className={cn('text-xs font-medium', betaModeEnabled ? 'text-primary' : 'text-muted-foreground/50')}>
              {betaModeEnabled ? 'On' : 'Off'}
            </span>
          </button>
        ) : betaRequest === undefined ? (
          <div className="px-4 py-3.5">
            <div className="h-4 w-1/2 rounded bg-white/5 animate-pulse" />
          </div>
        ) : betaRequest?.status === 'pending' ? (
          <div className="px-4 py-3.5 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-foreground/80">AI mode</p>
              <p className="text-[11px] text-amber-400/70 mt-0.5">Access requested · pending review</p>
            </div>
          </div>
        ) : betaRequest?.status === 'denied' ? (
          <div className="px-4 py-3.5 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-foreground/80">AI mode</p>
              <p className="text-[11px] text-destructive/60 mt-0.5">Request not approved</p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3.5">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground/80">AI mode</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5 mb-3">
                  Get AI-powered recommendations. Request free access or use your own key below.
                </p>
                <button
                  onClick={handleRequestBeta}
                  disabled={betaRequesting}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium',
                    'bg-primary/10 border border-primary/30 text-primary',
                    'hover:bg-primary/15 transition-colors disabled:opacity-50'
                  )}
                >
                  <Zap className="w-3 h-3" />
                  {betaRequesting ? 'Sending…' : 'Request access'}
                </button>
                {betaRequestMsg && (
                  <p className="text-[11px] text-muted-foreground/60 mt-2">{betaRequestMsg}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Your API key (BYOK) ── */}
        <div className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <Key className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground/80">Your API key</p>
              {hasOwnKey ? (
                /* Key is saved — show masked + remove */
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[12px] font-mono text-muted-foreground/60 flex-1 truncate">
                    {profile?.anthropic_key_masked}
                  </span>
                  <button
                    onClick={handleRemoveKey}
                    disabled={removingKey}
                    className="text-[11px] text-muted-foreground/40 hover:text-destructive/70 transition-colors disabled:opacity-50"
                  >
                    {removingKey ? '…' : 'Remove'}
                  </button>
                </div>
              ) : showKeyInput ? (
                /* Input form */
                <div className="mt-2 space-y-2">
                  <input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="sk-or-..."
                    autoComplete="off"
                    className={cn(
                      'w-full px-3 py-2 rounded-xl border text-[12px] font-mono',
                      'bg-background text-foreground/70 outline-none transition-all',
                      'border-border/50 focus:border-primary/40',
                      'placeholder:text-muted-foreground/30'
                    )}
                  />
                  {keyMsg && <p className="text-[11px] text-destructive/70">{keyMsg}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveKey}
                      disabled={savingKey || !keyInput.trim()}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium',
                        'bg-primary text-primary-foreground',
                        'hover:bg-primary/90 transition-colors disabled:opacity-50'
                      )}
                    >
                      <Check className="w-3 h-3" />
                      {savingKey ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setShowKeyInput(false); setKeyInput(''); setKeyMsg(null) }}
                      className="px-3 py-1.5 rounded-xl text-[12px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Prompt to add */
                <div className="mt-1">
                  <p className="text-[11px] text-muted-foreground/50 mb-2">
                    Use your own OpenRouter API key — unlocks AI for you instantly, no approval needed.
                  </p>
                  <button
                    onClick={() => setShowKeyInput(true)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium',
                      'bg-secondary border border-border/50 text-muted-foreground/70',
                      'hover:border-primary/30 hover:text-primary/70 transition-colors'
                    )}
                  >
                    <Key className="w-3 h-3" />
                    Add key
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3.5 mt-3',
          'rounded-2xl border border-border/50',
          'text-sm text-destructive/70 hover:bg-destructive/5 transition-colors'
        )}
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>

      {!notifEnabled && (
        <p className="text-[11px] text-muted-foreground/40 text-center mt-4">
          Enable notifications to set a daily reminder
        </p>
      )}

      {/* Accounts */}
      <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3 mt-8">
        Accounts
      </p>
      <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border/50">
        {savedAccounts.map((account) => {
          const isCurrent = account.email === profile?.email
          const acctInitials = account.name
            ?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
            ?? account.email[0].toUpperCase()
          return (
            <div key={account.email} className="flex items-center gap-3 px-4 py-3.5">
              <div className={cn(
                'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center',
                'bg-primary/15 text-primary text-xs font-medium'
              )}>
                {account.avatar_url
                  ? <img src={account.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  : acctInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{account.name ?? account.email}</p>
                <p className="text-[11px] text-muted-foreground/60 truncate">{account.email}</p>
              </div>
              {isCurrent ? (
                <span className="text-xs text-drivn-green font-medium shrink-0">Active</span>
              ) : (
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => openSwitchSheet(account)}
                    className="text-xs text-primary font-medium hover:text-primary/80 transition-colors"
                  >
                    Switch
                  </button>
                  <button
                    onClick={() => handleRemoveAccount(account.email)}
                    className="text-xs text-muted-foreground/40 hover:text-destructive/60 transition-colors"
                    aria-label="Remove account"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )
        })}
        <button
          onClick={openAddSheet}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-foreground/65 hover:bg-secondary/50 transition-colors"
        >
          <div className={cn(
            'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center',
            'border border-dashed border-border/60'
          )}>
            <Plus className="w-3.5 h-3.5 text-muted-foreground/50" />
          </div>
          <span>Add account</span>
        </button>
      </div>

      {/* Help & Setup Guide */}
      <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3 mt-8">
        Setup guide
      </p>
      <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border/50">
        {GUIDE_ITEMS.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => setOpenGuide(openGuide === item.id ? null : item.id)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground/75">{item.title}</span>
              </div>
              <ChevronDown className={cn(
                'w-4 h-4 text-muted-foreground/40 transition-transform flex-shrink-0',
                openGuide === item.id && 'rotate-180'
              )} />
            </button>
            {openGuide === item.id && (
              <div className="px-4 pb-4 space-y-2">
                {item.steps.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-[11px] font-medium text-primary/60 w-4 flex-shrink-0 mt-0.5">
                      {i + 1}.
                    </span>
                    <p className="text-[12px] text-muted-foreground/70 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Calendar sync */}
      <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3 mt-8">
        Calendar
      </p>
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <CalendarDays className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground/80">Sync to your calendar</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5 mb-3">
                Subscribe to a live feed — your events appear in iOS Calendar, Google Calendar, or Outlook and stay in sync automatically.
              </p>

              {calUrl ? (
                <div className="space-y-2">
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50',
                    'bg-secondary/50'
                  )}>
                    <p className="text-[11px] font-mono text-muted-foreground/70 flex-1 min-w-0 truncate">{calUrl}</p>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(calUrl)
                        setCalCopied(true)
                        setTimeout(() => setCalCopied(false), 2000)
                      }}
                      className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 text-[11px] text-primary/80 hover:text-primary transition-colors"
                    >
                      {calCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {calCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="space-y-2 text-[11px] text-muted-foreground/50">
                    <div className="flex gap-2">
                      <span className="flex-shrink-0">📱</span>
                      <p className="break-words"><strong>iPhone:</strong> Calendar app → Accounts → Add Account → Other → Add Subscribed Calendar → paste URL</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="flex-shrink-0">🗓</span>
                      <p className="break-words"><strong>Google:</strong> calendar.google.com → Other calendars → From URL → paste URL</p>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    setCalLoading(true)
                    try {
                      const res = await fetch('/api/calendar/token')
                      const data = await res.json()
                      if (data.url) setCalUrl(data.url)
                    } finally {
                      setCalLoading(false)
                    }
                  }}
                  disabled={calLoading}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium',
                    'bg-primary/10 border border-primary/30 text-primary',
                    'hover:bg-primary/15 transition-colors disabled:opacity-50'
                  )}
                >
                  <CalendarDays className="w-3 h-3" />
                  {calLoading ? 'Generating…' : 'Get subscription link'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Version */}
      <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3 mt-8">
        App
      </p>
      <div className="rounded-2xl border border-border overflow-hidden">
        <button
          onClick={() => setShowChangelog(true)}
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-foreground/65 hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-muted-foreground" />
            <span>What&apos;s new</span>
          </div>
          <span className="text-muted-foreground/50 text-xs">v{APP_VERSION}</span>
        </button>
      </div>

      <ChangelogSheet open={showChangelog} onClose={() => setShowChangelog(false)} />

      {/* ── Inline account switcher sheet ── */}
      <AnimatePresence>
        {switchSheet !== null && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={closeSwitchSheet}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                'fixed bottom-0 left-0 right-0 z-50',
                'bg-card rounded-t-3xl border-t border-border',
                'shadow-[0_-8px_40px_rgba(0,0,0,0.3)]',
                // Base 2rem bottom padding (unchanged) plus the home-indicator
                // safe-area inset on top, so the Sign-in/Cancel buttons clear
                // the gesture bar on notched iPhones without losing the
                // breathing room this sheet already had on other devices.
                'px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4'
              )}
            >
              {/* Handle */}
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              {/* Account info */}
              {switchSheet !== 'new' && (
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-medium flex-shrink-0">
                    {switchSheet.avatar_url
                      ? <img src={switchSheet.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      : (switchSheet.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? switchSheet.email[0].toUpperCase())
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-foreground truncate">
                      {switchSheet.name ?? switchSheet.email}
                    </p>
                    <p className="text-[12px] text-muted-foreground/60 truncate">{switchSheet.email}</p>
                  </div>
                </div>
              )}

              {switchSheet === 'new' && (
                <div className="mb-4">
                  <p className="text-[15px] font-medium text-foreground mb-1">Add account</p>
                  <p className="text-[12px] text-muted-foreground/60">Enter the email address to sign in with</p>
                </div>
              )}

              {/* Email input — only for "add new" */}
              {switchSheet === 'new' && switchStep !== 'code' && (
                <input
                  type="email"
                  value={switchEmail}
                  onChange={(e) => setSwitchEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                  placeholder="you@example.com"
                  autoFocus
                  className={cn(
                    'w-full px-4 py-3.5 rounded-2xl border text-[15px] mb-3',
                    'bg-background text-foreground outline-none transition-all',
                    'border-border/50 focus:border-primary/50',
                    'placeholder:text-muted-foreground/30'
                  )}
                />
              )}

              {/* Code entry step */}
              {switchStep === 'code' || switchStep === 'verifying' ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[13px] text-muted-foreground/70 mb-1">
                      Enter the 6-digit code sent to
                    </p>
                    <p className="text-[13px] font-medium text-foreground">{switchEmail}</p>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={switchCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setSwitchCode(val)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && switchCode.length === 6 && handleVerifyCode()}
                    placeholder="000000"
                    autoFocus
                    className={cn(
                      'w-full px-4 py-4 rounded-2xl border text-center text-[24px] font-mono tracking-[0.4em] mb-1',
                      'bg-background text-foreground outline-none transition-all',
                      'border-border/50 focus:border-primary/50',
                      'placeholder:text-muted-foreground/20 placeholder:tracking-widest'
                    )}
                  />
                  {switchError && (
                    <p className="text-[12px] text-destructive/70">{switchError}</p>
                  )}
                  <button
                    onClick={handleVerifyCode}
                    disabled={switchCode.length < 6 || switchStep === 'verifying'}
                    className={cn(
                      'w-full py-4 rounded-2xl text-[15px] font-medium',
                      'bg-primary text-primary-foreground',
                      'transition-all active:scale-[0.98] disabled:opacity-50'
                    )}
                  >
                    {switchStep === 'verifying'
                      ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</span>
                      : 'Sign in'
                    }
                  </button>
                  <button
                    onClick={() => { setSwitchStep('idle'); setSwitchCode(''); setSwitchError(null) }}
                    className="w-full py-2.5 text-[13px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  >
                    Resend code
                  </button>
                </div>
              ) : (
                /* Send code step */
                <div className="space-y-3">
                  {switchError && (
                    <p className="text-[12px] text-destructive/70 mb-1">{switchError}</p>
                  )}
                  {switchSheet !== 'new' && (
                    <p className="text-[13px] text-muted-foreground/60">
                      We&apos;ll send a 6-digit sign-in code to this email. No password needed.
                    </p>
                  )}
                  <button
                    onClick={handleSendCode}
                    disabled={switchStep === 'sending' || !switchEmail.trim()}
                    className={cn(
                      'w-full py-4 rounded-2xl text-[15px] font-medium',
                      'bg-primary text-primary-foreground',
                      'transition-all active:scale-[0.98] disabled:opacity-50'
                    )}
                  >
                    {switchStep === 'sending'
                      ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Sending…</span>
                      : 'Send code'
                    }
                  </button>
                  <button
                    onClick={closeSwitchSheet}
                    className="w-full py-2.5 text-[13px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

const GUIDE_ITEMS = [
  {
    id: 'install',
    title: 'Install as an app on your phone',
    icon: Smartphone,
    steps: [
      'iPhone (Safari): tap the Share button at the bottom, then "Add to Home Screen", then "Add".',
      'Android (Chrome): tap the three-dot menu, then "Add to Home Screen" or "Install app".',
      'Open Drivn from the home screen icon — notifications only work when launched this way.',
      'Desktop (Chrome/Edge): look for the install icon in the address bar and click it.',
    ],
  },
  {
    id: 'habits',
    title: 'Set up your habits correctly',
    icon: Repeat,
    steps: [
      'Go to the Habits tab and tap the + button to add a new habit.',
      'Mark habits as Essential (⭐) if you must do them every day — these appear first on your home screen.',
      'Use "Nice to have" for habits that are good to do but optional.',
      'Choose a tracking type: Simple (just mark it done), Muscle groups (log which areas you trained), or Amount (track water, servings, etc.).',
      'In edit mode (pencil icon), tap the ⭐ on any card to toggle its priority anytime.',
    ],
  },
  {
    id: 'reminders',
    title: 'Enable daily reminders',
    icon: Bell,
    steps: [
      'First install the app to your home screen (see above) — notifications require this on iPhone.',
      'Come back to this Profile page and tap "Notifications" to turn them on.',
      'Allow the permission prompt that appears.',
      'Tap "Daily reminder" to set the time you want to be nudged each day.',
      'The reminder will ask: "What\'s the one thing you need to get done today?"',
    ],
  },
  {
    id: 'priority',
    title: 'Use priorities and focus sessions',
    icon: Star,
    steps: [
      'Every task has a priority: High (do today), Medium, or Low.',
      'The home screen automatically surfaces your most important task as "Next Best Action".',
      'Quick wins (tasks under 30 min) appear as a horizontal strip — knock these out between bigger tasks.',
      'Tap a task to open it, then start a focus session to work on it distraction-free.',
      'Completing tasks builds your streak — try to complete at least one task every day.',
      'Use the Summary tab to see your activity calendar and spot patterns over time.',
    ],
  },
  {
    id: 'dependencies',
    title: 'Link tasks with dependencies',
    icon: Link2,
    steps: [
      'When creating or editing a task, expand the options panel and look for "Depends on".',
      'Select another task that must be completed first — the dependent task will be hidden from recommendations until the blocker is done.',
      'Blocked tasks show a lock icon in your task list so you know they\'re waiting on something.',
      'This is useful for things like "write the report" depending on "gather the data" — drivn won\'t nag you about the report until the data is ready.',
      'Remove the dependency at any time by editing the task and tapping the X next to the linked task.',
    ],
  },
  {
    id: 'scanner',
    title: 'Scan a sticky note into tasks',
    icon: Camera,
    steps: [
      'Tap the camera icon in the quick-capture bar at the bottom of the home screen.',
      'Take a photo of any sticky note, whiteboard, or handwritten list.',
      'AI reads the image and extracts each task — including dates, times, and estimated effort if you wrote them.',
      'Write hints directly on your note for better results: "Call dentist tomorrow 3pm", "Finish slides Friday - 2h", "Buy milk !".',
      'A review screen appears where you can edit each task, set priorities, and remove any misreads before adding them all at once.',
    ],
  },
  {
    id: 'ai-mode',
    title: 'Enable AI mode',
    icon: Sparkles,
    steps: [
      'AI mode upgrades your Next Best Action and Quick Wins from rule-based to semantically aware — Claude reads your task titles and reasons about what actually matters most right now.',
      'To unlock it: scroll to the Beta section on this page and tap "Request access" — you\'ll be approved manually.',
      'Alternatively, add your own OpenRouter API key in the "Your API key" section — this unlocks AI mode instantly with no approval needed.',
      'Get a free OpenRouter API key at openrouter.ai — sign up and go to Keys. Free tier is more than enough for personal use.',
      'Once you have access, toggle AI mode On in the Beta section. You can switch it off anytime to go back to the algorithmic ranking.',
    ],
  },
]
