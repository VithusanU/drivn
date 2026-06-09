import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush, type PushSub } from '@/lib/webpush'

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

/** Monday 00:00:00 UTC for the current week */
function weekStartUTC(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun…6=Sat
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff))
  return mon.toISOString()
}

function formatFocus(minutes: number): string {
  if (minutes === 0) return '0m'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const wStart = weekStartUTC()

  // Get all push subscriptions (users who have notifications enabled)
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .not('endpoint', 'is', null)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, note: 'No subscribers' })
  }

  const userIds = subs.map((s: any) => s.user_id)

  // Batch fetch this week's stats for all users
  const [
    { data: taskRows },
    { data: focusRows },
    { data: streakRows },
  ] = await Promise.all([
    admin.from('tasks').select('user_id').eq('status', 'completed').gte('completed_at', wStart).in('user_id', userIds),
    admin.from('focus_sessions').select('user_id, minutes_logged').gte('started_at', wStart).in('user_id', userIds),
    admin.from('user_streaks').select('user_id, current_streak').in('user_id', userIds),
  ])

  // Build per-user stats maps
  const taskMap: Record<string, number> = {}
  for (const row of taskRows ?? []) {
    taskMap[row.user_id] = (taskMap[row.user_id] ?? 0) + 1
  }
  const focusMap: Record<string, number> = {}
  for (const row of focusRows ?? []) {
    focusMap[row.user_id] = (focusMap[row.user_id] ?? 0) + (row.minutes_logged ?? 0)
  }
  const streakMap: Record<string, number> = {}
  for (const row of streakRows ?? []) {
    streakMap[row.user_id] = row.current_streak ?? 0
  }

  // Send personalized digest per user
  let sent = 0
  await Promise.allSettled(
    subs.map(async (sub: any) => {
      const tasks = taskMap[sub.user_id] ?? 0
      const focusMin = focusMap[sub.user_id] ?? 0
      const streak = streakMap[sub.user_id] ?? 0

      // Skip users with zero activity
      if (tasks === 0 && focusMin === 0) return

      const parts: string[] = []
      if (tasks > 0) parts.push(`${tasks} task${tasks !== 1 ? 's' : ''} ✅`)
      if (focusMin > 0) parts.push(`${formatFocus(focusMin)} focused 🧠`)
      if (streak > 0) parts.push(`${streak}-day streak 🔥`)

      const body = parts.length > 0 ? parts.join(' · ') : 'Another week in the books.'

      const pushSub: PushSub = { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }
      await sendPush([pushSub], {
        title: '📊 Your weekly recap',
        body,
        url: '/summary',
      })
      sent++
    })
  )

  return NextResponse.json({ sent })
}
