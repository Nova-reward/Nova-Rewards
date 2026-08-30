'use client';

import React, { useMemo } from 'react';
import * as Sentry from '@sentry/nextjs';
import { StructuredError } from '@/lib/errorService';
import ErrorIcon from './icons/ErrorIcon';
import ErrorTypeDisplay from './ErrorTypeDisplay';

interface ErrorDisplayProps {
  error: StructuredError;
  errorInfo?: React.ErrorInfo | null;
  eventId?: string | null;
  onRetry?: () => void;
  onReload?: () => void;
  isDevelopment?: boolean;
}

/**
 * Component to display structured errors with helpful UI
 */
export default function ErrorDisplay({
  error,
  errorInfo,
  eventId,
  onRetry,
  onReload,
  isDevelopment = false,
}: ErrorDisplayProps) {
  const showDetailedError = isDevelopment && error.originalError;

  const handleReportFeedback = () => {
    if (eventId) {
      Sentry.showReportDialog({ eventId });
    }
  };

  const errorColor = useMemo(() => {
    switch (error.severity) {
      case 'critical':
        return 'red';
      case 'error':
        return 'orange';
      case 'warning':
        return 'yellow';
      default:
        return 'blue';
    }
  }, [error.severity]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Main Error Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
          {/* Header with error type */}
          <div
            className={`px-6 py-8 bg-gradient-to-r from-${errorColor}-50 to-${errorColor}-100 dark:from-${errorColor}-950 dark:to-${errorColor}-900`}
          >
            <div className="flex items-start gap-4">
              <ErrorIcon type={error.type} className="w-8 h-8 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  <ErrorTypeDisplay type={error.type} />
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                  {error.userMessage}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-8">
            {/* Suggestions based on error type */}
            <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                What you can try:
              </h3>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                {getErrorSuggestions(error.type).map((suggestion, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-500 dark:text-blue-400 font-bold mt-0.5">
                      •
                    </span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Development error details */}
            {showDetailedError && (
              <details className="mb-8 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                <summary className="cursor-pointer font-semibold text-red-900 dark:text-red-200 hover:text-red-700 dark:hover:text-red-100">
                  🔧 Development Error Details
                </summary>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-mono text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 p-3 rounded overflow-auto max-h-32">
                      {error.message}
                    </p>
                  </div>
                  {errorInfo?.componentStack && (
                    <div>
                      <p className="text-xs text-red-600 dark:text-red-400 mb-2 font-semibold">
                        Component Stack:
                      </p>
                      <pre className="text-xs font-mono text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 p-3 rounded overflow-auto max-h-32 whitespace-pre-wrap break-words">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Error ID */}
            {eventId && (
              <div className="mb-8 p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Error ID:{' '}
                  <code className="font-mono text-gray-700 dark:text-gray-300 break-all">
                    {eventId}
                  </code>
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="px-6 py-6 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {/* Retry button - shown if error is retryable */}
              {error.retryable && onRetry && (
                <button
                  onClick={onRetry}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors touch-target"
                >
                  Try Again
                </button>
              )}

              {/* Reload button */}
              {onReload && (
                <button
                  onClick={onReload}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors touch-target"
                >
                  Reload Page
                </button>
              )}

              {/* Home link */}
              <a
                href="/"
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors touch-target text-center"
              >
                Go Home
              </a>

              {/* Report feedback button - shown if eventId exists */}
              {eventId && (
                <button
                  onClick={handleReportFeedback}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors touch-target"
                >
                  Report Issue
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Support Footer */}
        <div className="mt-8 text-center text-gray-600 dark:text-gray-400 text-sm">
          <p>Still having issues?</p>
          <a
            href="/support"
            className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
          >
            Contact our support team
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Get actionable suggestions for each error type
 */
function getErrorSuggestions(errorType: string): string[] {
  const suggestions: Record<string, string[]> = {
    not_found: [
      'Check the URL to ensure it is correct',
      'The resource may have been moved or deleted',
      'Go back to the previous page and try again',
      'Contact support if you believe this is an error',
    ],
    unauthorized: [
      'Log in with your account',
      'Make sure you have the correct credentials',
      'Check if your session has expired and log in again',
      'Contact support if you continue to have issues',
    ],
    forbidden: [
      'Verify you have permission to access this resource',
      'Contact your administrator if you need additional permissions',
      'Try with a different account if available',
      'Contact support for assistance',
    ],
    validation: [
      'Review the form fields for any errors',
      'Ensure all required fields are filled correctly',
      'Check that your input matches the expected format',
      'Try again with corrected information',
    ],
    network: [
      'Check your internet connection',
      'Try again in a moment',
      'If you are behind a firewall, check your settings',
      'Contact support if the problem persists',
    ],
    timeout: [
      'The operation took longer than expected',
      'Check your internet connection',
      'Try the operation again',
      'Contact support if timeouts continue to occur',
    ],
    server: [
      'Our team has been notified and is investigating',
      'Try again in a few moments',
      'Check our status page for updates',
      'Contact support if the issue persists',
    ],
    blockchain: [
      'Check your wallet connection',
      'Verify you have sufficient funds',
      'Ensure your wallet is on the correct network',
      'Try again or contact support',
    ],
    wallet: [
      'Reconnect your wallet',
      'Check your wallet extension/app',
      'Make sure it is unlocked and on the correct network',
      'Try a different wallet if available',
    ],
    unknown: [
      'Try refreshing the page',
      'Clear your browser cache if the problem persists',
      'Try again in a few moments',
      'Contact support if the issue continues',
    ],
  };

  return suggestions[errorType] || suggestions.unknown;
}
