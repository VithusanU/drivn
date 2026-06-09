import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomBytes } from 'crypto'

// GET — generate (or return existing) invite token for the current user
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Re-use an existing unused token if it exists
  const { data: existing } = await admin
    .from('friend_invite_tokens')
    .select('token')
    .eq('user_id', user.id)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/friends?join=${existing.token}`
    return NextResponse.json({ token: existing.token, url })
  }

  const token = randomBytes(16).toString('hex')
  const { error } = await admin
    .from('friend_invite_tokens')
    .insert({ token, user_id: user.id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/friends?join=${token}`
  return NextResponse.json({ token, url })
}

// POST — accept an invite token
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const admin = createAdminClient()

  // Find the token
  const { data: invite } = await admin
    .from('friend_invite_tokens')
    .select('user_id, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
  if (invite.used_at) return NextResponse.json({ error: 'Invite already used' }, { status: 410 })
  if (invite.user_id === user.id) return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })

  // Check if already friends
  const { data: existing } = await admin
    .from('friendships')
    .select('id, status')
    .or(
      `and(requester_id.eq.${invite.user_id},addressee_id.eq.${user.id}),` +
      `and(requester_id.eq.${user.id},addressee_id.eq.${invite.user_id})`
    )
    .maybeSingle()

  if (existing?.status === 'accepted') {
    return NextResponse.json({ error: 'Already friends' }, { status: 409 })
  }

  // Mark token as used
  await admin.from('friend_invite_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)

  // If the invite sender already sent a request to us, just accept it
  if (existing?.status === 'pending') {
    await admin.from('friendships').update({ status: 'accepted' }).eq('id', existing.id)
    return NextResponse.json({ ok: true, action: 'accepted_existing' })
  }

  // Create an instantly-accepted friendship (invite links skip pending)
  const { error } = await admin.from('friendships').insert({
    requester_id: invite.user_id,
    addressee_id: user.id,
    status: 'accepted',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, action: 'created' })
}
