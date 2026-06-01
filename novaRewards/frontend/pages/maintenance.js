import Head from 'next/head';

/**
 * Maintenance page — shown during planned downtime.
 * Set NEXT_PUBLIC_MAINTENANCE_RETURN_TIME env var to display estimated return time.
 */
export default function Maintenance() {
  const returnTime = process.env.NEXT_PUBLIC_MAINTENANCE_RETURN_TIME || null;

  return (
    <>
      <Head>
        <title>Maintenance — Nova Rewards</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main
        className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4"
        aria-labelledby="maintenance-heading"
      >
        <div className="max-w-md w-full text-center">
          {/* Illustration */}
          <div className="mb-8 flex justify-center" aria-hidden="true">
            <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="80" cy="80" r="72" fill="#ede9fe" />
              <circle cx="80" cy="80" r="52" fill="#ddd6fe" />
              {/* wrench icon */}
              <path d="M95 55a15 15 0 00-20 20l-20 20a5 5 0 007 7l20-20a15 15 0 0020-20l-7 7-7-7 7-7z" fill="#7c3aed" />
            </svg>
          </div>

          <h1 id="maintenance-heading" className="text-3xl font-bold text-neutral-900 dark:text-neutral-50 mb-3">
            Under Maintenance
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mb-4">
            Nova Rewards is temporarily offline for scheduled maintenance. We&apos;ll be back shortly.
          </p>

          {returnTime && (
            <p className="text-sm font-medium text-primary-600 dark:text-primary-400 mb-8">
              Estimated return:{' '}
              <time dateTime={returnTime}>
                {new Date(returnTime).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
            </p>
          )}

          <p className="text-sm text-neutral-400 dark:text-neutral-500">
            Follow{' '}
            <a
              href="https://status.novarewards.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 dark:text-primary-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              status.novarewards.io
            </a>{' '}
            for live updates.
          </p>
        </div>
      </main>
    </>
  );
}
