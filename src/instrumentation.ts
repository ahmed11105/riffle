import * as Sentry from "@sentry/nextjs";

// Sentry's wizard-generated configs (sentry.server.config.ts,
// sentry.edge.config.ts) handle the actual init. We just route to the
// right one based on runtime, and forward server errors to Sentry.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
