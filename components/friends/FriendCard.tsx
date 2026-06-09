'use client'

import { useState } from 'react'
import { Flame, Target, Clock, Zap, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Generate a deterministic avatar color from a user id
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-rose-500',
]
function avatarColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatFocus(minutes: number): string {
  if (minutes === 0) return '0m'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export interface FriendActivity {
  friendId: string
  friendshipId: string
  profile: { id: string; full_name: string | null; username: string | null; avatar_url: string | null } | null
  streak: number
  tasksDoneToday: number
  tasksDoneWeek: number
  tasksActive: number
  focusMinutesToday: number
  focusMinutesWeek: number
  isFocusing: boolean
  focusDuration: string | null
}

interface Props {
  friend: FriendActivity
  onRemove: (friendshipId: string) => void
}

export default function FriendCard({ friend, onRemove }: Props) {
  const [cheering, setCheering] = useState(false)
  const [cheerSent, setCheerSent] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [view, setView] = useState<'today' | 'week'>('today')

  const { profile, streak, tasksDoneToday, tasksDoneWeek, tasksActive, focusMinutesToday, focusMinutesWeek, isFocusing, focusDuration } = friend
  const tasksDone = view === 'today' ? tasksDoneToday : tasksDoneWeek
  const focusMinutes = view === 'today' ? focusMinutesToday : focusMinutesWeek
  const name = profile?.full_name || profile?.username || 'Unknown'
  // Don't show emails as @handles — only show proper @username values
  const rawUsername = profile?.username ?? ''
  const handle = rawUsername && !rawUsername.includes('@') ? `@${rawUsername}` : null

  const handleCheer = async () => {
    if (cheering || cheerSent) return
    setCheering(true)
    try {
      await fetch('/api/friends/cheer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId: friend.friendId }),
      })
      setCheerSent(true)
      setTimeout(() => setCheerSent(false), 4000)
    } finally {
      setCheering(false)
    }
  }

  const handleRemove = async () => {
    if (removing) return
    if (!confirm(`Remove ${name} as a friend?`)) return
    setRemoving(true)
    try {
      await fetch(`/api/friends/${friend.friendshipId}`, { method: 'DELETE' })
      onRemove(friend.friendshipId)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className={cn(
      'rounded-2xl border border-border bg-card p-4 space-y-3 transition-all',
      isFocusing && 'border-drivn-green/30 bg-drivn-green/[0.03]'
    )}>
      {/* Header row */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold',
            avatarColor(friend.friendId)
          )}>
            {initials(name)}
          </div>
          {/* Presence dot */}
          {isFocusing && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-drivn-green border-2 border-background">
              <span className="absolute inset-0 rounded-full bg-drivn-green animate-ping opacity-75" />
            </span>
          )}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-foreground truncate">{name}</p>
          {handle && (
            <p className="text-[11px] text-muted-foreground/50">{handle}</p>
          )}
        </div>

        {/* Locked in badge */}
        {isFocusing && focusDuration && (
          <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-drivn-green/10 border border-drivn-green/25 text-drivn-green flex-shrink-0">
            <Zap className="w-3 h-3" />
            {focusDuration}
          </span>
        )}

        {/* Remove button */}
        <button
          onClick={handleRemove}
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground/30 hover:text-destructive/60 transition-colors"
          aria-label="Remove friend"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats toggle + row */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex rounded-lg border border-border bg-secondary p-0.5 gap-0.5">
            {(['today', 'week'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-2.5 py-0.5 rounded-md text-[10px] font-medium transition-all',
                  view === v
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground/60 hover:text-muted-foreground'
                )}
              >
                {v === 'today' ? 'Today' : 'Week'}
              </button>
            ))}
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400/70 flex-shrink-0" />
              <span className="text-[12px] font-medium text-foreground">{streak}d</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Target className="w-3 h-3 text-primary/50 flex-shrink-0" />
            <span className="text-[12px] text-foreground font-medium">{tasksDone}</span>
            <span className="text-[12px] text-muted-foreground/50">
              {view === 'today' ? `/ ${tasksDoneToday + tasksActive} tasks` : 'tasks'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-primary/50 flex-shrink-0" />
            <span className="text-[12px] text-foreground font-medium">{formatFocus(focusMinutes)}</span>
            <span className="text-[12px] text-muted-foreground/50">focus</span>
          </div>
        </div>
      </div>

      {/* Cheer button */}
      <button
        onClick={handleCheer}
        disabled={cheering}
        className={cn(
          'w-full py-2 rounded-xl text-[13px] font-medium transition-all border',
          cheerSent
            ? 'bg-drivn-green/10 border-drivn-green/30 text-drivn-green'
            : 'border-border/60 text-muted-foreground/60 hover:border-primary/30 hover:text-primary/70'
        )}
      >
        {cheerSent ? '🎉 Cheer sent!' : '🎉 Cheer'}
      </button>
    </div>
  )
}
