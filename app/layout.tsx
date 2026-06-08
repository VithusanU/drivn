import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import Providers from '@/components/providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Drivn',
  description: 'Turn plans into progress. Make it a habit.',
  manifest: '/manifest.json',
  icons: { icon: '/logo.png', apple: '/logo.png' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Drivn',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Lets the page draw under the iOS notch/home-indicator and Android gesture
  // bar (instead of leaving a hard system-bar gap). This is the PREREQUISITE
  // for env(safe-area-inset-*) to resolve to non-zero values — without it,
  // `.pb-safe` / `.pt-safe` (app/globals.css) always compute to 0 and
  // fixed-bottom UI (sheet footers, bottom nav) can sit under the home
  // indicator on notched phones.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
