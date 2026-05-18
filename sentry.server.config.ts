import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: 'https://a2d81b1b8ecd992544eba73cc2ba2225@o4511413155594240.ingest.us.sentry.io/4511413161164800',
  tracesSampleRate: 0.2,
})
