import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@drivn.app'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

export async function POST(req: Request) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return Response.json({ error: 'Push not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, body } = (await req.json()) as { title: string; body: string }

  // Fetch subscription for this user
  const { data: sub } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user.id)
    .single()

  if (!sub) return Response.json({ error: 'No subscription' }, { status: 404 })

  const payload = JSON.stringify({ title, body, icon: '/logo.png', badge: '/logo.png' })

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    )
    return Response.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Push failed'
    // If subscription expired, clean it up
    if ((err as { statusCode?: number })?.statusCode === 410) {
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
    }
    return Response.json({ error: msg }, { status: 500 })
  }
}
