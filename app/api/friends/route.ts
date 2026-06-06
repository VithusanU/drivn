import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — list accepted friends + pending incoming requests
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: friendships } = await admin
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

  const accepted = (friendships ?? []).filter((f: any) => f.status === 'accepted')
  const pendingIncoming = (friendships ?? []).filter(
    (f: any) => f.status === 'pending' && f.addressee_id === user.id
  )
  const pendingOutgoing = (friendships ?? []).filter(
    (f: any) => f.status === 'pending' && f.requester_id === user.id
  )

  // Collect all relevant user IDs
  const allIds = [
    ...accepted.map((f: any) => f.requester_id === user.id ? f.addressee_id : f.requester_id),
    ...pendingIncoming.map((f: any) => f.requester_id),
    ...pendingOutgoing.map((f: any) => f.addressee_id),
  ].filter(Boolean)

  const profileMap: Record<string, any> = {}
  if (allIds.length > 0) {
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', allIds)
    for (const p of profiles ?? []) profileMap[p.id] = p
  }

  return NextResponse.json({
    accepted: accepted.map((f: any) => ({
      friendshipId: f.id,
      friendId: f.requester_id === user.id ? f.addressee_id : f.requester_id,
      profile: profileMap[f.requester_id === user.id ? f.addressee_id : f.requester_id] ?? null,
    })),
    pendingIncoming: pendingIncoming.map((f: any) => ({
      friendshipId: f.id,
      requesterId: f.requester_id,
      profile: profileMap[f.requester_id] ?? null,
    })),
    pendingOutgoing: pendingOutgoing.map((f: any) => ({
      friendshipId: f.id,
      addresseeId: f.addressee_id,
      profile: profileMap[f.addressee_id] ?? null,
    })),
  })
}

// POST — send a friend request
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { addresseeId } = await req.json()
  if (!addresseeId) return NextResponse.json({ error: 'Missing addresseeId' }, { status: 400 })
  if (addresseeId === user.id) return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })

  const admin = createAdminClient()

  // Check if friendship already exists (either direction)
  const { data: existing } = await admin
    .from('friendships')
    .select('id, status')
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),` +
      `and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`
    )
    .maybeSingle()

  if (existing) {
    if (existing.status === 'accepted') return NextResponse.json({ error: 'Already friends' }, { status: 409 })
    if (existing.status === 'pending') return NextResponse.json({ error: 'Request already pending' }, { status: 409 })
  }

  const { data, error } = await admin
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ friendship: data })
}
