import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function todayRange() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return { start: `${d}T00:00:00`, end: `${d}T23:59:59` }
}

function focusDuration(startedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { start, end } = todayRange()

  // Get accepted friendships
  const { data: friendships } = await admin
    .from('friendships')
    .select('id, requester_id, addressee_id')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq('status', 'accepted')

  const friendEntries = (friendships ?? []).map((f: any) => ({
    friendshipId: f.id,
    friendId: f.requester_id === user.id ? f.addressee_id : f.requester_id,
  }))
  const friendIds = friendEntries.map((e: any) => e.friendId)

  if (friendIds.length === 0) return NextResponse.json({ friends: [] })

  // Batch fetch profiles, streaks, presence
  const [{ data: profiles }, { data: streaks }, { data: presences }] = await Promise.all([
    admin.from('user_profiles').select('id, full_name, username, avatar_url').in('id', friendIds),
    admin.from('user_streaks').select('user_id, current_streak').in('user_id', friendIds),
    admin.from('user_presence').select('*').in('user_id', friendIds),
  ])

  const profileMap: Record<string, any> = {}
  for (const p of profiles ?? []) profileMap[p.id] = p
  const streakMap: Record<string, number> = {}
  for (const s of streaks ?? []) streakMap[s.user_id] = s.current_streak ?? 0
  const presenceMap: Record<string, any> = {}
  for (const p of presences ?? []) presenceMap[p.user_id] = p

  // Build friendshipId lookup
  const friendshipIdMap: Record<string, string> = {}
  for (const e of friendEntries) friendshipIdMap[e.friendId] = e.friendshipId

  // Per-friend activity (parallel)
  const friends = await Promise.all(
    friendIds.map(async (fId: string) => {
      const [{ count: doneCnt }, { count: activeCnt }, { data: focusRows }] = await Promise.all([
        admin
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', fId)
          .eq('status', 'completed')
          .gte('completed_at', start)
          .lte('completed_at', end),
        admin
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', fId)
          .eq('status', 'active'),
        admin
          .from('focus_sessions')
          .select('minutes_logged')
          .eq('user_id', fId)
          .gte('started_at', start)
          .lte('started_at', end),
      ])

      const focusMinutes = (focusRows ?? []).reduce(
        (s: number, f: any) => s + (f.minutes_logged ?? 0), 0
      )
      const presence = presenceMap[fId]
      const isFocusing = presence?.is_focusing ?? false

      return {
        friendId: fId,
        friendshipId: friendshipIdMap[fId] ?? '',
        profile: profileMap[fId] ?? null,
        streak: streakMap[fId] ?? 0,
        tasksDoneToday: doneCnt ?? 0,
        tasksActive: activeCnt ?? 0,
        focusMinutesToday: focusMinutes,
        isFocusing,
        focusStartedAt: isFocusing ? presence?.focus_started_at : null,
        focusDuration: isFocusing && presence?.focus_started_at
          ? focusDuration(presence.focus_started_at)
          : null,
      }
    })
  )

  // Sort: focusing first, then by streak desc
  friends.sort((a, b) => {
    if (a.isFocusing !== b.isFocusing) return a.isFocusing ? -1 : 1
    return b.streak - a.streak
  })

  return NextResponse.json({ friends })
}
