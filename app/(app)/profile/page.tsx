'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { LogOut, Bell, Clock, Heart, Sun, Moon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUserStore } from '@/stores/userStore'
import { cn } from '@/lib/utils'

export default function ProfilePage() {
  const profile = useUserStore((s) => s.profile)
  const streak = useUserStore((s) => s.streak)
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
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
          <div
            key={label}
            className="bg-card/50 border border-border/50 rounded-2xl p-3.5 text-center"
          >
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
        {[
          { icon: Bell, label: 'Notifications', action: () => {} },
          { icon: Clock, label: 'Daily reminder', action: () => {} },
          { icon: Heart, label: 'Manage habits', action: () => router.push('/habits') },
          {
            icon: mounted && resolvedTheme === 'dark' ? Moon : Sun,
            label: 'Theme',
            value: mounted ? (resolvedTheme === 'dark' ? 'Dark' : 'Light') : '—',
            action: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
          },
        ].map(({ icon: Icon, label, value, action }, i, arr) => (
          <button
            key={label}
            onClick={action}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3.5',
              'text-sm text-foreground/65 hover:bg-secondary/50 transition-colors',
              i < arr.length - 1 && 'border-b border-border/50'
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span>{label}</span>
            </div>
            <span className="text-muted-foreground/50 text-xs">{value ?? '›'}</span>
          </button>
        ))}
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
    </div>
  )
}
