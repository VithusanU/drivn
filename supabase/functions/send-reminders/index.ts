import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// `web-push` is loaded dynamically inside the request handler (not as a static
// top-level import). A static `import webpush from 'npm:web-push'` runs at
// module-evaluation time — if it throws (registry hiccup, VAPID env var
// missing, etc.) the whole worker fails to boot with an opaque WORKER_ERROR
// 500 that never reaches any try/catch in the handler. Loading it lazily lets
// us catch and report the real error instead.
let webpush: any = null
let webpushInitError: string | null = null

async function ensureWebpush() {
  if (webpush || webpushInitError) return
  try {
    const mod = await import('npm:web-push')
    webpush = mod.default ?? mod
    const pub = Deno.env.get('VAPID_PUBLIC_KEY')
    const priv = Deno.env.get('VAPID_PRIVATE_KEY')
    const subj = Deno.env.get('VAPID_SUBJECT')
    if (!pub || !priv || !subj) {
      throw new Error(`Missing VAPID env vars (public=${!!pub} private=${!!priv} subject=${!!subj})`)
    }
    webpush.setVapidDetails(subj, pub, priv)
  } catch (err) {
    webpushInitError = String(err)
  }
}

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
  try {
    await ensureWebpush()
    if (webpushInitError) {
      return new Response(JSON.stringify({ error: 'webpush init failed', detail: webpushInitError }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return await handle()
  } catch (err) {
    // Surface the real error in the response so we can diagnose the
    // WORKER_ERROR 500s without needing dashboard log access.
    return new Response(
      JSON.stringify({ error: String(err), stack: (err as Error)?.stack ?? null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

async function handle(): Promise<Response> {
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
  // Per-subscription send outcomes for the alarms we attempted this run — included
  // in the response so delivery failures (stale subscription, VAPID mismatch, etc.)
  // are visible without dashboard log access. `undefined` when no alarms were due.
  let alarmDebug: Array<{ taskId: string; userId: string; hasSub: boolean; status: string; reason?: string; statusCode?: number; endpoint?: string }> | undefined
  if (dueAlarms.length) {
    const alarmUserIds = [...new Set(dueAlarms.map((t: any) => t.user_id))]
    const { data: alarmSubs } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', alarmUserIds)
      .not('endpoint', 'is', null)

    // A user can now have multiple devices subscribed simultaneously
    // (migration 020_multi_device_push) — fan each alarm out to every
    // device they're subscribed on, not just one.
    const subsByUser: Record<string, any[]> = {}
    for (const s of (alarmSubs ?? []) as any[]) {
      (subsByUser[s.user_id] ??= []).push(s)
    }

    const sendList: Array<{ task: any; sub: any }> = []
    for (const t of dueAlarms as any[]) {
      for (const sub of subsByUser[t.user_id] ?? []) sendList.push({ task: t, sub })
    }

    const alarmResults = await Promise.allSettled(
      sendList.map(({ task, sub }) =>
        pushTo(sub, {
          title: `⏰ ${task.title}`,
          body: "It's time — let's go.",
          icon: '/logo.png',
          url: '/',
        })
      )
    )

    alarmsSent = alarmResults.filter((r) => r.status === 'fulfilled').length

    alarmDebug = alarmResults.map((r, i) => {
      const { task, sub } = sendList[i]
      return {
        taskId: task.id,
        userId: task.user_id,
        hasSub: true,
        status: r.status,
        // For 'fulfilled' results, `value` is the raw response object FROM THE PUSH
        // SERVICE (FCM/APNs/etc) — its statusCode tells us whether the message was
        // truly queued (201) vs merely accepted-then-dropped. For 'rejected', surface
        // whatever the push library attached to the error.
        reason: r.status === 'rejected'
          ? (r.reason?.body || r.reason?.message || String(r.reason))
          : (r.value?.body || undefined),
        statusCode: r.status === 'rejected' ? r.reason?.statusCode : r.value?.statusCode,
        endpoint: String(sub.endpoint).slice(0, 60),
      }
    })

    // Tasks whose owner has zero subscriptions still need to surface in the
    // debug output — otherwise "why didn't my alarm fire" is invisible.
    for (const t of dueAlarms as any[]) {
      if (!(subsByUser[t.user_id]?.length)) {
        alarmDebug.push({ taskId: t.id, userId: t.user_id, hasSub: false, status: 'rejected', reason: 'no subscription' })
      }
    }

    await supabase
      .from('tasks')
      .update({ last_alarm_at: now.toISOString() })
      .in('id', dueAlarms.map((t: any) => t.id))
  }

  // ── Part 2: per-event alarms ("Dentist at 3pm", "Oil change at 9am", etc.) ──
  // Mirrors Part 1 exactly — events are independent of tasks and the daily
  // reminder; an event with alarm_enabled fires its own push at its own
  // alarm_at instant. alarm_at is a precomputed UTC timestamp (the client
  // collapses the user's local event_date + event_time into one absolute
  // instant — see deriveEventAlarmAt in stores/eventStore.ts), so this is a
  // plain range check, same as task alarms (migration 021_event_alarms).
  const { data: alarmEvents } = await supabase
    .from('events')
    .select('id, user_id, title, alarm_at, last_alarm_at')
    .eq('alarm_enabled', true)
    .not('alarm_at', 'is', null)
    .gte('alarm_at', alarmWindowStart)
    .lte('alarm_at', alarmWindowEnd)

  const dueEventAlarms = (alarmEvents ?? []).filter(
    (e: any) => e.last_alarm_at?.slice(0, 10) !== today
  )

  let eventAlarmsSent = 0
  let eventAlarmDebug: Array<{ taskId: string; userId: string; hasSub: boolean; status: string; reason?: string; statusCode?: number; endpoint?: string }> | undefined
  if (dueEventAlarms.length) {
    const eventAlarmUserIds = [...new Set(dueEventAlarms.map((e: any) => e.user_id))]
    const { data: eventAlarmSubs } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', eventAlarmUserIds)
      .not('endpoint', 'is', null)

    // Multi-device aware (migration 020_multi_device_push) — fan each event
    // alarm out to every device the owner is subscribed on.
    const eventSubsByUser: Record<string, any[]> = {}
    for (const s of (eventAlarmSubs ?? []) as any[]) {
      (eventSubsByUser[s.user_id] ??= []).push(s)
    }

    const eventSendList: Array<{ event: any; sub: any }> = []
    for (const e of dueEventAlarms as any[]) {
      for (const sub of eventSubsByUser[e.user_id] ?? []) eventSendList.push({ event: e, sub })
    }

    const eventAlarmResults = await Promise.allSettled(
      eventSendList.map(({ event, sub }) =>
        pushTo(sub, {
          title: `📅 ${event.title}`,
          body: "It's time — let's go.",
          icon: '/logo.png',
          url: '/',
        })
      )
    )

    eventAlarmsSent = eventAlarmResults.filter((r) => r.status === 'fulfilled').length

    eventAlarmDebug = eventAlarmResults.map((r, i) => {
      const { event, sub } = eventSendList[i]
      return {
        taskId: event.id,
        userId: event.user_id,
        hasSub: true,
        status: r.status,
        reason: r.status === 'rejected'
          ? (r.reason?.body || r.reason?.message || String(r.reason))
          : (r.value?.body || undefined),
        statusCode: r.status === 'rejected' ? r.reason?.statusCode : r.value?.statusCode,
        endpoint: String(sub.endpoint).slice(0, 60),
      }
    })

    // Events whose owner has zero subscriptions still need to surface in the
    // debug output — otherwise "why didn't my event alarm fire" is invisible.
    for (const e of dueEventAlarms as any[]) {
      if (!(eventSubsByUser[e.user_id]?.length)) {
        eventAlarmDebug.push({ taskId: e.id, userId: e.user_id, hasSub: false, status: 'rejected', reason: 'no subscription' })
      }
    }

    await supabase
      .from('events')
      .update({ last_alarm_at: now.toISOString() })
      .in('id', dueEventAlarms.map((e: any) => e.id))
  }

  // ── Part 3: daily reminder (single time set in Profile, USER-level) ─────────
  // reminder_time / last_reminded_at now live on user_profiles (migration
  // 020_multi_device_push) — they're a per-user preference, not per-device,
  // since a user with N subscribed devices should still get exactly one
  // reminder per day, fanned out to all of their devices.
  let profileQuery = supabase
    .from('user_profiles')
    .select('id, reminder_time, last_reminded_at')
    .not('reminder_time', 'is', null)

  if (crossesMidnight) {
    profileQuery = profileQuery.or(`reminder_time.gte.${windowStart},reminder_time.lte.${windowEnd}`)
  } else {
    profileQuery = profileQuery.gte('reminder_time', windowStart).lte('reminder_time', windowEnd)
  }

  const { data: profiles, error } = await profileQuery

  if (error || !profiles?.length) {
    return new Response(JSON.stringify({ sent: 0, alarmsSent, alarmDebug, eventAlarmsSent, eventAlarmDebug, window: `${windowStart}–${windowEnd}` }), { status: 200 })
  }

  // Dedup: skip users already reminded today
  const eligibleProfiles = profiles.filter((p: any) => p.last_reminded_at?.slice(0, 10) !== today)

  if (!eligibleProfiles.length) {
    return new Response(JSON.stringify({ sent: 0, alarmsSent, alarmDebug, eventAlarmsSent, eventAlarmDebug, note: 'all already reminded today' }), { status: 200 })
  }

  const eligibleUserIds = eligibleProfiles.map((p: any) => p.id)

  // Fan out to every device each eligible user is subscribed on.
  const { data: reminderSubs } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', eligibleUserIds)
    .not('endpoint', 'is', null)

  // Fetch each user's most urgent active task for personalised notifications
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
    (reminderSubs ?? []).map((sub: any) => {
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

  // Mark reminded — at the USER level (user_profiles.id), not per-device,
  // so a user isn't re-reminded just because they have multiple subscriptions.
  await supabase
    .from('user_profiles')
    .update({ last_reminded_at: now.toISOString() })
    .in('id', eligibleUserIds)

  return new Response(JSON.stringify({ sent, alarmsSent, alarmDebug, eventAlarmsSent, eventAlarmDebug, window: `${windowStart}–${windowEnd}` }), { status: 200 })
}
