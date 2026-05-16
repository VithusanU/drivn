import { createClient } from '@/lib/supabase/client'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(Array.from(rawData).map((c) => c.charCodeAt(0)))
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
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

    await supabase.from('push_subscriptions').upsert(
      { user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'user_id' }
    )

    return true
  } catch {
    return false
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration('/sw.js')
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await sub.unsubscribe()

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  }
}

export async function isSubscribed(): Promise<boolean> {
  const reg = await navigator.serviceWorker?.getRegistration('/sw.js')
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}

export async function saveReminderTime(time: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('push_subscriptions')
    .update({ reminder_time: time })
    .eq('user_id', user.id)
}

export async function getReminderTime(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('push_subscriptions')
    .select('reminder_time')
    .eq('user_id', user.id)
    .single()
  return data?.reminder_time ?? null
}
