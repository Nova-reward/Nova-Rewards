import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      debug: false,
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT || "development",
      beforeSend(event) {
        if (process.env.NODE_ENV === "development" && event.level !== "error") {
          return null;
        }
        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      debug: false,
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT || "development",
    });
  }
}
