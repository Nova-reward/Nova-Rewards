'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-2xl font-semibold text-error-600">Something went wrong</h2>
      <p className="text-neutral-500">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
      >
        Try again
      </button>
    </div>
  );
}
