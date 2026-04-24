import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

export default function Custom500({ statusCode, err }) {
  useEffect(() => {
    // Log 500 errors to Sentry
    if (err) {
      Sentry.captureException(err);
    }
  }, [err]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-lg w-full text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-red-600 dark:text-red-400 mb-4">
            500
          </h1>
          <div className="relative">
            <svg 
              className="mx-auto h-32 w-32 text-gray-400 dark:text-gray-600" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Server Error
        </h2>
        
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          Something went wrong on our end. Our team has been notified and is working on a fix.
        </p>

        {process.env.NODE_ENV === 'development' && err && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-left">
            <p className="text-sm font-mono text-red-800 dark:text-red-300 break-all">
              {err.toString()}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl"
          >
            Go Home
          </Link>
          
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors shadow-md border border-gray-200 dark:border-gray-700"
          >
            Try Again
          </button>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            Need immediate assistance?
          </p>
          <Link 
            href="/help" 
            className="text-red-600 dark:text-red-400 hover:underline font-medium"
          >
            Visit our Help Center
          </Link>
        </div>
      </div>
    </div>
  );
}

Custom500.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode, err };
};
