import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush, type PushSub } from '@/lib/webpush'

// Vercel injects Authorization: Bearer <CRON_SECRET> on cron requests.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // no secret — allow (local dev)
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// Returns HH:MM string in UTC for a date offset by `deltaMinutes`
function utcHHMM(base: Date, deltaMinutes = 0): string {
  const d = new Date(base.getTime() + deltaMinutes * 60_000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const today = now.toISOString().slice(0, 10) // "YYYY-MM-DD" UTC

  // We check a ±30-minute window around the current UTC time.
  // The cron runs hourly so this window ensures every reminder_time is hit.
  const windowStart = utcHHMM(now, -30)
  const windowEnd   = utcHHMM(now, +30)

  // Build the query — handles both normal and midnight-crossing windows
  let query = admin
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth, last_reminded_at')
    .not('reminder_time', 'is', null)
    .not('endpoint', 'is', null)

  const crossesMidnight = windowStart > windowEnd // e.g. "23:45" > "00:15"
  if (crossesMidnight) {
    // reminder_time >= "23:45" OR reminder_time <= "00:15"
    query = query.or(`reminder_time.gte.${windowStart},reminder_time.lte.${windowEnd}`)
  } else {
    query = query.gte('reminder_time', windowStart).lte('reminder_time', windowEnd)
  }

  const { data: subs, error } = await query

  if (error) {
    console.error('[cron/reminders] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, window: `${windowStart}–${windowEnd}` })
  }

  // Skip users already reminded today (UTC date)
  const eligible = subs.filter((s: any) => {
    const lastDate = s.last_reminded_at?.slice(0, 10)
    return lastDate !== today
  })

  if (eligible.length === 0) {
    return NextResponse.json({ sent: 0, note: 'All users already reminded today' })
  }

  // Send push notifications
  const pushSubs: PushSub[] = eligible.map((s: any) => ({
    endpoint: s.endpoint,
    p256dh: s.p256dh,
    auth: s.auth,
  }))

  await sendPush(pushSubs, {
    title: '⚡ Time to get locked in',
    body: "Your daily reminder — open Drivn and knock out today's tasks.",
    url: '/',
  })

  // Mark all sent users as reminded today
  const userIds = eligible.map((s: any) => s.user_id)
  await admin
    .from('push_subscriptions')
    .update({ last_reminded_at: now.toISOString() })
    .in('user_id', userIds)

  return NextResponse.json({
    sent: eligible.length,
    window: `${windowStart}–${windowEnd}`,
  })
}
