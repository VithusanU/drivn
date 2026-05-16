self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Drivn', {
      body: data.body ?? "Time to focus on what matters.",
      icon: '/logo.png',
      badge: '/logo.png',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(event.notification.data?.url ?? '/')
          return
        }
      }
      clients.openWindow(event.notification.data?.url ?? '/')
    })
  )
})
