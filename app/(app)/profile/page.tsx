'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { LogOut, Bell, BellOff, Clock, Heart, Sun, Moon, Check, ChevronDown, Smartphone, Repeat, Star, PlayCircle, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUserStore } from '@/stores/userStore'
import { cn } from '@/lib/utils'
import {
  subscribeToPush, unsubscribeFromPush, isSubscribed,
  saveReminderTime, getReminderTime,
} from '@/lib/notifications'
import { getSavedAccounts, removeAccount } from '@/lib/savedAccounts'
import type { SavedAccount } from '@/lib/savedAccounts'

export default function ProfilePage() {
  const profile = useUserStore((s) => s.profile)
  const streak = useUserStore((s) => s.streak)
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [reminderTime, setReminderTime] = useState('')
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [savingTime, setSavingTime] = useState(false)
  const [openGuide, setOpenGuide] = useState<string | null>(null)
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([])

  useEffect(() => {
    setMounted(true)
    isSubscribed().then(setNotifEnabled)
    getReminderTime().then((t) => { if (t) setReminderTime(t.slice(0, 5)) })
    setSavedAccounts(getSavedAccounts())
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSwitchAccount = async (account: SavedAccount) => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/login?email=${encodeURIComponent(account.email)}`)
  }

  const handleAddAccount = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleRemoveAccount = (email: string) => {
    removeAccount(email)
    setSavedAccounts(getSavedAccounts())
  }

  const handleToggleNotifications = async () => {
    if (notifEnabled) {
      await unsubscribeFromPush()
      setNotifEnabled(false)
    } else {
      const ok = await subscribeToPush()
      setNotifEnabled(ok)
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
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-foreground/65 hover:bg-secondary/50 transition-colors border-b border-border/50"
        >
          <div className="flex items-center gap-3">
            {notifEnabled
              ? <Bell className="w-4 h-4 text-primary" />
              : <BellOff className="w-4 h-4 text-muted-foreground" />
            }
            <span>Notifications</span>
          </div>
          <span className={cn('text-xs', notifEnabled ? 'text-primary' : 'text-muted-foreground/50')}>
            {notifEnabled ? 'On' : 'Off'}
          </span>
        </button>

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
                    onClick={() => handleSwitchAccount(account)}
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
          onClick={handleAddAccount}
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
      'Tap a task to open it, then start a focus session to work on it distraction-free.',
      'Completing tasks builds your streak — try to complete at least one task every day.',
      'Use the Summary tab to see your activity calendar and spot patterns over time.',
    ],
  },
]
