import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || "development",
  beforeSend(event, hint) {
    if (process.env.NODE_ENV === "development" && event.level !== "error") {
      return null;
    }
    return event;
  },
  ignoreErrors: [
    "top.GLOBALS",
    "originalCreateNotification",
    "canvas.contentDocument",
    "MyApp_RemoveAllHighlights",
    "NetworkError",
    "Network request failed",
  ],
});
