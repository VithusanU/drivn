import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friendId } = await req.json()
  if (!friendId) return NextResponse.json({ error: 'Missing friendId' }, { status: 400 })

  const admin = createAdminClient()

  // Verify they are actually friends
  const { data: friendship } = await admin
    .from('friendships')
    .select('id')
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),` +
      `and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`
    )
    .eq('status', 'accepted')
    .maybeSingle()

  if (!friendship) return NextResponse.json({ error: 'Not friends' }, { status: 403 })

  // Get sender name
  const { data: senderProfile } = await admin
    .from('user_profiles')
    .select('full_name, username')
    .eq('id', user.id)
    .single()

  const senderName = senderProfile?.full_name || senderProfile?.username || 'A friend'

  // Get friend's push subscriptions
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', friendId)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, note: 'No push subscription for friend' })
  }

  const payload = JSON.stringify({
    title: `🎉 ${senderName} is cheering you on!`,
    body: 'Keep going — you\'ve got this! 💪',
    icon: '/logo.png',
  })

  await Promise.allSettled(
    subs.map((sub: any) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  )

  return NextResponse.json({ ok: true })
}
