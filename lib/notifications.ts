import { createClient } from '@/lib/supabase/client'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(Array.from(rawData).map((c) => c.charCodeAt(0))).buffer as ArrayBuffer
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'default') {
    return Notification.requestPermission()
  }
  return Notification.permission
}

export async function subscribeToPush(): Promise<boolean> {
  const permission = await getNotificationPermission()
  if (permission !== 'granted') return false

  const reg = await registerServiceWorker()
  if (!reg) return false

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
    return false
  }

  try {
    // Browsers (notably Safari/iOS) THROW from `subscribe()` if a subscription
    // already exists with a different `applicationServerKey` (e.g. left over
    // from a previous VAPID key rotation) — "InvalidStateError: ... key does
    // not match". Always clear any existing subscription first so re-toggling
    // notifications can recover from a stale/mismatched-key subscription.
    try {
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
    } catch (err) {
      console.error('[push] failed to clear stale subscription before resubscribe', err)
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    const { endpoint, keys } = subscription.toJSON() as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    // Keyed on (user_id, endpoint) — NOT user_id alone — so each device/browser
    // gets its own row and subscribing on a new device doesn't evict another
    // device's subscription. Re-subscribing the same device updates its row
    // (the endpoint stays stable across re-subscribes on a given browser).
    await supabase.from('push_subscriptions').upsert(
      { user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'user_id,endpoint' }
    )

    return true
  } catch (err) {
    console.error('[push] subscribe failed', err)
    return false
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  // Browser-side unsubscribe and the DB row cleanup are independent — a failure
  // in one (e.g. iOS Safari throwing from `sub.unsubscribe()`) must not prevent
  // the other, otherwise toggling off leaves a stale row that blocks resubscribe.
  //
  // Capture THIS device's endpoint before unsubscribing, so we delete only its
  // row — not every device this user has subscribed from.
  let endpoint: string | null = null
  try {
    const reg = await navigator.serviceWorker?.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      endpoint = sub.endpoint
      await sub.unsubscribe()
    }
  } catch (err) {
    console.error('[push] browser-side unsubscribe failed', err)
  }

  // CRITICAL: only ever delete by (user_id, endpoint) together. A user can now
  // have multiple devices subscribed simultaneously (migration 020) — if we
  // can't identify THIS device's endpoint, falling back to `eq('user_id', ...)`
  // alone would silently wipe out every OTHER device's subscription too,
  // re-introducing the exact "last device wins" bug the migration fixed.
  // A stale leftover row is far less harmful than nuking a working device.
  if (!endpoint) {
    console.warn('[push] no local subscription/endpoint found — skipping DB delete to avoid removing other devices\' subscriptions')
    return
  }

  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint)
    }
  } catch (err) {
    console.error('[push] failed to delete subscription row', err)
  }
}

export async function isSubscribed(): Promise<boolean> {
  const reg = await navigator.serviceWorker?.getRegistration('/sw.js')
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}

// Convert local HH:MM to UTC HH:MM for storage — exported so other features
// (e.g. per-task alarms) can mirror local times into UTC for scheduler matching.
export function localToUTC(localHHMM: string): string {
  const [h, m] = localHHMM.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

// Convert stored UTC HH:MM back to local HH:MM for display
function utcToLocal(utcHHMM: string): string {
  const [h, m] = utcHHMM.split(':').map(Number)
  const d = new Date()
  d.setUTCHours(h, m, 0, 0)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Daily reminder time is a USER preference (lives on user_profiles), not a
// per-device one — otherwise a user with multiple subscribed devices could end
// up with conflicting times, or one reminder per device per day. See migration
// 020_multi_device_push.sql.
export async function saveReminderTime(time: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('user_profiles')
    .update({ reminder_time: localToUTC(time) })
    .eq('id', user.id)
}

export async function getReminderTime(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('user_profiles')
    .select('reminder_time')
    .eq('id', user.id)
    .single()
  if (!data?.reminder_time) return null
  return utcToLocal(data.reminder_time)
}
