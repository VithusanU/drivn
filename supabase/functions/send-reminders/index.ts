import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

// Returns "HH:MM" UTC for `date` offset by `deltaMinutes`
function utcHHMM(base: Date, deltaMinutes = 0): string {
  const d = new Date(base.getTime() + deltaMinutes * 60_000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const now = new Date()
  const today = now.toISOString().slice(0, 10) // "YYYY-MM-DD" UTC

  // ±7 minute window around now (function is scheduled every 10 min,
  // so this guarantees every reminder_time is hit exactly once)
  const windowStart = utcHHMM(now, -7)
  const windowEnd   = utcHHMM(now, +7)

  const crossesMidnight = windowStart > windowEnd
  let query = supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth, last_reminded_at')
    .not('reminder_time', 'is', null)
    .not('endpoint', 'is', null)

  if (crossesMidnight) {
    query = query.or(`reminder_time.gte.${windowStart},reminder_time.lte.${windowEnd}`)
  } else {
    query = query.gte('reminder_time', windowStart).lte('reminder_time', windowEnd)
  }

  const { data: subs, error } = await query

  if (error || !subs?.length) {
    return new Response(JSON.stringify({ sent: 0, window: `${windowStart}–${windowEnd}` }), { status: 200 })
  }

  // Dedup: skip users already reminded today
  const eligible = subs.filter((s: any) => s.last_reminded_at?.slice(0, 10) !== today)

  if (!eligible.length) {
    return new Response(JSON.stringify({ sent: 0, note: 'all already reminded today' }), { status: 200 })
  }

  const results = await Promise.allSettled(
    eligible.map((sub: any) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: '⚡ Time to get locked in',
          body: "Your daily reminder — open Drivn and knock out today's tasks.",
          icon: '/logo.png',
          url: '/',
        }),
      )
    )
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length

  // Mark reminded
  const userIds = eligible.map((s: any) => s.user_id)
  await supabase
    .from('push_subscriptions')
    .update({ last_reminded_at: now.toISOString() })
    .in('user_id', userIds)

  return new Response(JSON.stringify({ sent, window: `${windowStart}–${windowEnd}` }), { status: 200 })
})
