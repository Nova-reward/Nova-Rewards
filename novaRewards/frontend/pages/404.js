import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import * as Sentry from '@sentry/nextjs';

export default function Custom404() {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureMessage(`404 - Page not found: ${router.asPath}`, 'warning');
  }, [router.asPath]);

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4"
      aria-labelledby="error-heading"
    >
      <div className="max-w-md w-full text-center">
        {/* Illustration */}
        <div className="mb-8 flex justify-center" aria-hidden="true">
          <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="80" cy="80" r="72" fill="#ede9fe" />
            <circle cx="80" cy="80" r="52" fill="#ddd6fe" />
            <text x="80" y="96" textAnchor="middle" fontSize="48" fontWeight="700" fill="#7c3aed">404</text>
            <circle cx="56" cy="68" r="5" fill="#7c3aed" />
            <circle cx="104" cy="68" r="5" fill="#7c3aed" />
            <path d="M62 96 Q80 88 98 96" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" fill="none" />
          </svg>
        </div>

        <h1 id="error-heading" className="text-3xl font-bold text-neutral-900 dark:text-neutral-50 mb-3">
          Page not found
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <Link
            href="/dashboard"
            className="px-6 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            Go to Dashboard
          </Link>
          <button
            onClick={() => router.back()}
            className="px-6 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-medium text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            Go Back
          </button>
        </div>

        <nav aria-label="Helpful links" className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-sm">
          <Link href="/rewards" className="text-primary-600 dark:text-primary-400 hover:underline">Rewards</Link>
          <Link href="/campaigns" className="text-primary-600 dark:text-primary-400 hover:underline">Campaigns</Link>
          <Link href="/help" className="text-primary-600 dark:text-primary-400 hover:underline">Help Center</Link>
        </nav>
      </div>
    </main>
  );
}
