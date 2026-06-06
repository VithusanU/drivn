import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH — accept or decline a request
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = await req.json()
  if (!['accepted', 'declined'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify the current user is the addressee
  const { data: friendship } = await admin
    .from('friendships')
    .select('id, addressee_id')
    .eq('id', params.id)
    .single()

  if (!friendship || friendship.addressee_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { error } = await admin
    .from('friendships')
    .update({ status })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove a friend or cancel a request
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify the current user is a party to this friendship
  const { data: friendship } = await admin
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('id', params.id)
    .single()

  if (!friendship || (friendship.requester_id !== user.id && friendship.addressee_id !== user.id)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { error } = await admin.from('friendships').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
