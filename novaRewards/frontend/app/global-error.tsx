"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
          <h2 className="text-2xl font-semibold text-error-600">
            Something went wrong
          </h2>
          <p className="text-neutral-500">
            Our team has been notified. Please try again.
          </p>
          <button
            onClick={() => reset()}
            className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
