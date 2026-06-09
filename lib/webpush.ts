import webpush from 'web-push'

let configured = false

function ensureConfigured() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  configured = true
}

export interface PushSub {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  url?: string
}

/** Send a push notification to one or more subscriptions. Silently ignores failures. */
export async function sendPush(subs: PushSub[], payload: PushPayload): Promise<void> {
  ensureConfigured()
  const data = JSON.stringify({ icon: '/logo.png', ...payload })
  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        data
      )
    )
  )
}
