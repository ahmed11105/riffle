import * as Sentry from "@sentry/nextjs";

const IGNORED_ERROR_PATTERNS = [
  // Supabase auth-js web-lock contention on iOS Safari bfcache / tab focus.
  // Benign: the library re-acquires the lock and auth continues.
  /Lock .* was released because another request stole it/i,
  /Lock broken by another request with the 'steal' option/i,
  // Next.js Turbopack HMR fires a router action before init in dev only.
  /Router action dispatched before initialization/i,
];

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
    ignoreErrors: IGNORED_ERROR_PATTERNS,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: true,
      }),
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
