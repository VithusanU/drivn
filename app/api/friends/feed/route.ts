import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get accepted friend IDs
  const { data: friendships } = await admin
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq('status', 'accepted')

  const friendIds = (friendships ?? []).map((f: any) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  )

  if (friendIds.length === 0) return NextResponse.json({ feed: [] })

  // Fetch last 14 days of friend activities
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: activities } = await admin
    .from('friend_activities')
    .select('id, user_id, type, task_title, streak_count, created_at')
    .in('user_id', friendIds)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(40)

  if (!activities || activities.length === 0) return NextResponse.json({ feed: [] })

  // Fetch profiles for the unique users in feed
  const userIds = [...new Set(activities.map((a: any) => a.user_id))]
  const { data: profiles } = await admin
    .from('user_profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', userIds)

  const profileMap: Record<string, any> = {}
  for (const p of profiles ?? []) profileMap[p.id] = p

  const feed = activities.map((a: any) => ({
    id: a.id,
    userId: a.user_id,
    type: a.type,
    taskTitle: a.task_title,
    streakCount: a.streak_count,
    createdAt: a.created_at,
    profile: profileMap[a.user_id] ?? null,
  }))

  return NextResponse.json({ feed })
}
