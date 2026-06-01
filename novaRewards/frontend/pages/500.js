import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

export default function Custom500({ err }) {
  useEffect(() => {
    if (err) Sentry.captureException(err);
  }, [err]);

  function handleReport() {
    Sentry.showReportDialog();
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4"
      aria-labelledby="error-heading"
    >
      <div className="max-w-md w-full text-center">
        {/* Illustration */}
        <div className="mb-8 flex justify-center" aria-hidden="true">
          <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="80" cy="80" r="72" fill="#fef2f2" />
            <circle cx="80" cy="80" r="52" fill="#fee2e2" />
            <text x="80" y="96" textAnchor="middle" fontSize="48" fontWeight="700" fill="#dc2626">500</text>
            <path d="M72 60 L88 76 M88 60 L72 76" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        <h1 id="error-heading" className="text-3xl font-bold text-neutral-900 dark:text-neutral-50 mb-3">
          Something went wrong
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mb-8">
          An unexpected error occurred on our end. Our team has been notified and is working on a fix.
        </p>

        {process.env.NODE_ENV === 'development' && err && (
          <pre className="mb-6 p-4 rounded-lg bg-error-50 dark:bg-error-950 text-left text-xs text-error-700 dark:text-error-300 overflow-auto">
            {err.toString()}
          </pre>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            Try Again
          </button>
          <button
            onClick={handleReport}
            className="px-6 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-medium text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            Report Issue
          </button>
        </div>

        <Link href="/dashboard" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    </main>
  );
}

Custom500.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 500;
  return { statusCode, err };
};
