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

// Sends a single push notification, swallowing per-subscription failures
async function pushTo(sub: { endpoint: string; p256dh: string; auth: string }, payload: Record<string, unknown>) {
  return webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
  )
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const now = new Date()
  const today = now.toISOString().slice(0, 10) // "YYYY-MM-DD" UTC

  // ±7 minute window around now (function is scheduled every 10 min,
  // so this guarantees every reminder_time / alarm_time is hit exactly once)
  const windowStart = utcHHMM(now, -7)
  const windowEnd   = utcHHMM(now, +7)
  const crossesMidnight = windowStart > windowEnd

  // ── Part 1: per-task alarms ("Gym at 6pm", "Jog at 7am", etc.) ──────────────
  // These are independent of the user's daily reminder_time — a task with
  // alarm_enabled fires its own push at its own alarm_at instant.
  // alarm_at is a single precomputed UTC timestamp (client combines the user's local
  // due_date + due_time into one absolute instant), so this is a plain range check —
  // no string/date-splitting, no timezone-skew edge cases.
  const alarmWindowStart = new Date(now.getTime() - 7 * 60_000).toISOString()
  const alarmWindowEnd   = new Date(now.getTime() + 7 * 60_000).toISOString()

  const { data: alarmTasks } = await supabase
    .from('tasks')
    .select('id, user_id, title, alarm_at, last_alarm_at')
    .eq('status', 'active')
    .eq('alarm_enabled', true)
    .not('alarm_at', 'is', null)
    .gte('alarm_at', alarmWindowStart)
    .lte('alarm_at', alarmWindowEnd)

  const dueAlarms = (alarmTasks ?? []).filter(
    (t: any) => t.last_alarm_at?.slice(0, 10) !== today
  )

  let alarmsSent = 0
  if (dueAlarms.length) {
    const alarmUserIds = [...new Set(dueAlarms.map((t: any) => t.user_id))]
    const { data: alarmSubs } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', alarmUserIds)
      .not('endpoint', 'is', null)

    const subByUser: Record<string, any> = {}
    for (const s of (alarmSubs ?? []) as any[]) subByUser[s.user_id] = s

    const alarmResults = await Promise.allSettled(
      dueAlarms.map((t: any) => {
        const sub = subByUser[t.user_id]
        if (!sub) return Promise.reject(new Error('no subscription'))
        return pushTo(sub, {
          title: `⏰ ${t.title}`,
          body: "It's time — let's go.",
          icon: '/logo.png',
          url: '/',
        })
      })
    )

    alarmsSent = alarmResults.filter((r) => r.status === 'fulfilled').length

    await supabase
      .from('tasks')
      .update({ last_alarm_at: now.toISOString() })
      .in('id', dueAlarms.map((t: any) => t.id))
  }

  // ── Part 2: daily reminder (single time set in Profile) ─────────────────────
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
    return new Response(JSON.stringify({ sent: 0, alarmsSent, window: `${windowStart}–${windowEnd}` }), { status: 200 })
  }

  // Dedup: skip users already reminded today
  const eligible = subs.filter((s: any) => s.last_reminded_at?.slice(0, 10) !== today)

  if (!eligible.length) {
    return new Response(JSON.stringify({ sent: 0, alarmsSent, note: 'all already reminded today' }), { status: 200 })
  }

  // Fetch each user's most urgent active task for personalised notifications
  const eligibleUserIds = eligible.map((s: any) => s.user_id)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('user_id, title, urgency, due_date')
    .in('user_id', eligibleUserIds)
    .eq('status', 'active')
    .order('due_date', { ascending: true, nullsFirst: false })

  // Build user_id → top task title map (first result per user = soonest due)
  const taskMap: Record<string, string> = {}
  for (const t of (tasks ?? []) as any[]) {
    if (!taskMap[t.user_id]) taskMap[t.user_id] = t.title
  }

  const results = await Promise.allSettled(
    eligible.map((sub: any) => {
      const taskTitle = taskMap[sub.user_id]
      return pushTo(sub, {
        title: '⚡ Time to get locked in',
        body: taskTitle
          ? `Start with: "${taskTitle}" — you've got this.`
          : "Your daily reminder — open Drivn and knock out today's tasks.",
        icon: '/logo.png',
        url: '/',
      })
    })
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length

  // Mark reminded
  const userIds = eligible.map((s: any) => s.user_id)
  await supabase
    .from('push_subscriptions')
    .update({ last_reminded_at: now.toISOString() })
    .in('user_id', userIds)

  return new Response(JSON.stringify({ sent, alarmsSent, window: `${windowStart}–${windowEnd}` }), { status: 200 })
})
