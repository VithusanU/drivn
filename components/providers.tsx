'use client'

import { ThemeProvider } from 'next-themes'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

function PostHogInit({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init('phc_rzhxp3otekYQD8XHs4Sb5jvDFSNMMV6DfGNL3T7UsCKy', {
      api_host: 'https://us.i.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      person_profiles: 'identified_only',
    })
  }, [])

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PostHogInit>
        {children}
      </PostHogInit>
    </ThemeProvider>
  )
}
