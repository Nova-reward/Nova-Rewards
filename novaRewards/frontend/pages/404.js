import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import * as Sentry from '@sentry/nextjs';

export default function Custom404() {
  const router = useRouter();

  useEffect(() => {
    // Log 404 errors to Sentry for monitoring
    Sentry.captureMessage(`404 - Page not found: ${router.asPath}`, 'warning');
  }, [router.asPath]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-lg w-full text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-blue-600 dark:text-blue-400 mb-4">
            404
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
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Page Not Found
        </h2>
        
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl"
          >
            Go Home
          </Link>
          
          <button
            onClick={() => router.back()}
            className="px-8 py-3 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors shadow-md border border-gray-200 dark:border-gray-700"
          >
            Go Back
          </button>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            Looking for something specific?
          </p>
          <div className="flex flex-wrap gap-3 justify-center text-sm">
            <Link href="/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline">
              Dashboard
            </Link>
            <span className="text-gray-300 dark:text-gray-700">•</span>
            <Link href="/rewards" className="text-blue-600 dark:text-blue-400 hover:underline">
              Rewards
            </Link>
            <span className="text-gray-300 dark:text-gray-700">•</span>
            <Link href="/help" className="text-blue-600 dark:text-blue-400 hover:underline">
              Help Center
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
