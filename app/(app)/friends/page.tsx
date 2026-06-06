'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { UserPlus, Users, RefreshCw, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import FriendCard, { type FriendActivity } from '@/components/friends/FriendCard'
import AddFriendSheet from '@/components/friends/AddFriendSheet'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/stores/userStore'
import { createClient } from '@/lib/supabase/client'

interface PendingRequest {
  friendshipId: string
  requesterId: string
  profile: { full_name: string | null; username: string | null } | null
}

function FriendsPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const profile = useUserStore((s) => s.profile)

  const [friends, setFriends] = useState<FriendActivity[]>([])
  const [pending, setPending] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [joinStatus, setJoinStatus] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Handle ?join=TOKEN invite links
  const joinToken = searchParams.get('join')
  useEffect(() => {
    if (!joinToken) return
    setJoinStatus('Accepting invite…')
    fetch('/api/friends/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: joinToken }),
    }).then(async (res) => {
      const json = await res.json()
      if (res.ok) {
        setJoinStatus('✓ Friend added!')
        router.replace('/friends')
        loadAll()
      } else {
        setJoinStatus(json.error ?? 'Invalid invite link')
        setTimeout(() => { setJoinStatus(null); router.replace('/friends') }, 3000)
      }
    })
  }, [joinToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadActivity = useCallback(async () => {
    const res = await fetch('/api/friends/activity')
    if (res.ok) {
      const json = await res.json()
      setFriends(json.friends ?? [])
    }
  }, [])

  const loadFriendships = useCallback(async () => {
    const res = await fetch('/api/friends')
    if (res.ok) {
      const json = await res.json()
      setPending(json.pendingIncoming ?? [])
    }
  }, [])

  const loadAll = useCallback(async () => {
    await Promise.all([loadActivity(), loadFriendships()])
    setLoading(false)
  }, [loadActivity, loadFriendships])

  useEffect(() => {
    loadAll()
    // Refresh activity every 60s
    pollingRef.current = setInterval(() => loadActivity(), 60_000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [loadAll, loadActivity])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }

  const handleAccept = async (friendshipId: string) => {
    await fetch(`/api/friends/${friendshipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted' }),
    })
    setPending((p) => p.filter((r) => r.friendshipId !== friendshipId))
    await loadActivity()
  }

  const handleDecline = async (friendshipId: string) => {
    await fetch(`/api/friends/${friendshipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'declined' }),
    })
    setPending((p) => p.filter((r) => r.friendshipId !== friendshipId))
  }

  const handleRemoveFriend = (friendshipId: string) => {
    setFriends((f) => f.filter((fr) => fr.friendshipId !== friendshipId))
  }

  const handleSaveUsername = async () => {
    const handle = username.trim().replace(/^@/, '').replace(/\s+/g, '').toLowerCase()
    if (handle.length < 2) return
    setSavingUsername(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_profiles').update({ username: handle }).eq('id', user.id)
    }
    setSavingUsername(false)
    setUsername('')
    // Re-fetch profile
    useUserStore.getState().fetchProfile()
  }

  const hasUsername = !!profile?.username

  return (
    <div className="px-4 pt-6 pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-medium text-foreground">Friends</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">See who's locked in</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Join status banner */}
      <AnimatePresence>
        {joinStatus && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-[13px] text-primary"
          >
            {joinStatus}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Username setup prompt */}
      {!hasUsername && !loading && (
        <div className="px-4 py-3.5 rounded-2xl border border-amber-400/25 bg-amber-400/5 space-y-3">
          <p className="text-[13px] text-amber-400/80 font-medium">Set your @username</p>
          <p className="text-[12px] text-muted-foreground/60">
            Friends can find you by username. Pick one so others can add you.
          </p>
          <div className="flex gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveUsername()}
              placeholder="@yourhandle"
              className="flex-1 px-3 py-2 rounded-xl border border-amber-400/25 bg-background text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none"
            />
            <button
              onClick={handleSaveUsername}
              disabled={savingUsername || username.trim().length < 2}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium disabled:opacity-50"
            >
              {savingUsername ? '…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Pending incoming requests */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
            Friend requests ({pending.length})
          </p>
          {pending.map((req) => {
            const name = req.profile?.full_name || req.profile?.username || 'Someone'
            return (
              <div
                key={req.friendshipId}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{name}</p>
                  {req.profile?.username && (
                    <p className="text-[11px] text-muted-foreground/50">@{req.profile.username}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDecline(req.friendshipId)}
                  className="w-8 h-8 rounded-full flex items-center justify-center border border-border text-muted-foreground/50 hover:text-destructive hover:border-destructive/40 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleAccept(req.friendshipId)}
                  className="w-8 h-8 rounded-full flex items-center justify-center border border-drivn-green/30 bg-drivn-green/10 text-drivn-green hover:bg-drivn-green/20 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Friends list */}
      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <p className="text-[13px] text-muted-foreground animate-pulse">Loading…</p>
        </div>
      ) : friends.length === 0 ? (
        <button
          onClick={() => setAddOpen(true)}
          className={cn(
            'w-full flex flex-col items-center gap-3 px-4 py-8 rounded-2xl border border-dashed',
            'border-border/40 text-muted-foreground/40 hover:border-primary/30 hover:text-primary/50',
            'transition-colors'
          )}
        >
          <Users className="w-8 h-8" />
          <div className="text-center">
            <p className="text-[14px] font-medium">No friends yet</p>
            <p className="text-[12px] mt-0.5">Add friends to see their activity</p>
          </div>
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
            {friends.length} friend{friends.length !== 1 ? 's' : ''}
          </p>
          <AnimatePresence initial={false}>
            {friends.map((friend) => (
              <motion.div
                key={friend.friendId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
              >
                <FriendCard
                  friend={friend}
                  onRemove={handleRemoveFriend}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AddFriendSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onRequestSent={loadFriendships}
      />
    </div>
  )
}

export default function FriendsPage() {
  return (
    <Suspense fallback={
      <div className="h-40 flex items-center justify-center">
        <p className="text-[13px] text-muted-foreground animate-pulse">Loading…</p>
      </div>
    }>
      <FriendsPageInner />
    </Suspense>
  )
}
