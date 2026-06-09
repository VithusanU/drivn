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

  // A user can have multiple devices subscribed simultaneously (migration
  // 020_multi_device_push) — send the test push to ALL of them, not just one.
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user.id)

  if (!subs?.length) return Response.json({ error: 'No subscription' }, { status: 404 })

  const payload = JSON.stringify({ title, body, icon: '/logo.png', badge: '/logo.png' })

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  )

  // Clean up only the SPECIFIC expired subscriptions (matched by endpoint) —
  // never delete by user_id alone, which would also remove other devices'
  // still-working subscriptions.
  const expiredEndpoints = results
    .map((r, i) => ({ r, endpoint: subs[i].endpoint }))
    .filter(({ r }) => r.status === 'rejected' && (r.reason as { statusCode?: number })?.statusCode === 410)
    .map(({ endpoint }) => endpoint)

  if (expiredEndpoints.length) {
    await supabase.from('push_subscriptions').delete().eq('user_id', user.id).in('endpoint', expiredEndpoints)
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length
  if (sent > 0) return Response.json({ ok: true, sent, total: subs.length })

  const firstError = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
  const msg = firstError?.reason instanceof Error ? firstError.reason.message : 'Push failed'
  return Response.json({ error: msg }, { status: 500 })
}
