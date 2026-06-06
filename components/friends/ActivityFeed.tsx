'use client'

import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FeedItem {
  id: string
  userId: string
  type: string
  taskTitle: string | null
  streakCount: number | null
  createdAt: string
  profile: {
    id: string
    full_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

// Avatar colour — same hash as FriendCard
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-rose-500',
]
function avatarColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
function initials(name: string | null | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface Props {
  items: FeedItem[]
}

export default function ActivityFeed({ items }: Props) {
  if (items.length === 0) return null

  return (
    <div>
      <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3">
        Recent activity
      </p>
      <div className="space-y-2">
        {items.map((item) => {
          const name = item.profile?.full_name || item.profile?.username || 'Someone'
          const timeAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })

          return (
            <div
              key={item.id}
              className="flex items-start gap-3 px-3.5 py-3 rounded-xl border border-border bg-card"
            >
              {/* Avatar */}
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 mt-0.5',
                avatarColor(item.userId)
              )}>
                {item.profile?.avatar_url ? (
                  <img src={item.profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : initials(name)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground leading-snug">
                  <span className="font-medium">{name}</span>
                  {' '}
                  {item.type === 'task_completed' && (
                    <>completed <span className="text-foreground/70">&ldquo;{item.taskTitle}&rdquo;</span></>
                  )}
                  {item.type === 'streak_milestone' && (
                    <>hit a <span className="text-amber-400 font-medium">{item.streakCount}-day streak</span> 🔥</>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">{timeAgo}</p>
              </div>

              {/* Icon */}
              {item.type === 'task_completed' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-drivn-green/60 flex-shrink-0 mt-0.5" />
              )}
              {item.type === 'streak_milestone' && (
                <Flame className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0 mt-0.5" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
