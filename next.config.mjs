import { withSentryConfig } from '@sentry/nextjs'
import withPWAInit from '@ducanh2912/next-pwa'

// IMPORTANT: next-pwa is fully disabled. With no `swSrc` configured, it runs
// Workbox in `GenerateSW` mode, which writes its own auto-generated caching
// service worker to `dest` ("public/sw.js") at BUILD TIME — silently
// overwriting our hand-written `public/sw.js` that contains the `push` and
// `notificationclick` handlers push notifications depend on. The generated
// worker has no knowledge of push events at all, so every push that reached
// the device was accepted by the OS but had no handler to call
// `showNotification` — explaining why pushes were confirmed "delivered" by
// FCM/APNs (HTTP 201) yet nothing ever appeared on screen.
//
// Re-enabling this requires switching to Workbox's `InjectManifest` mode
// (workboxOptions.swSrc pointing at a custom source file OUTSIDE `public/`,
// containing the push handlers + the `self.__WB_MANIFEST` injection point)
// so the build merges precaching into our worker instead of replacing it.
// Until that's done, leave this disabled — our hand-written sw.js is served
// as-is and push notifications work; we just lose Workbox's asset caching.
const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: true,
  workboxOptions: {
    disableDevLogs: true,
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default withSentryConfig(withPWA(nextConfig), {
  org: 'drivn',
  project: 'drivn',
  silent: true,
  telemetry: false,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
