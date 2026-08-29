'use client';

import React from 'react';
import {
  ErrorHandlingExamples,
  ErrorBoundaryUsageExample,
} from '@/components/examples/ErrorHandlingExamples';

/**
 * Demo page showcasing all error handling features
 * This page is for testing and demonstration purposes only
 *
 * URL: /error-demo
 *
 * Features demonstrated:
 * - Different error types (404, 500, timeout, network, blockchain, etc.)
 * - Error boundary component
 * - Error context and hooks
 * - Retry functionality
 * - User-friendly error messages
 * - Error reporting to Sentry
 * - Development error details
 */
export default function ErrorDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 py-12">
      <div className="max-w-6xl mx-auto px-4 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            Error Handling Demo
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Explore all error handling features in Nova-Rewards. This page
            demonstrates different error scenarios, how they're displayed, and
            how to recover from them.
          </p>
          <div className="inline-block px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
            🚀 Demo Page Only - Not for Production Use
          </div>
        </div>

        {/* Error Examples Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <ErrorHandlingExamples />
        </section>

        {/* Error Boundary Usage Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <ErrorBoundaryUsageExample />
        </section>

        {/* Documentation Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Error Handling System Overview
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Error Types */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Supported Error Types
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-center gap-2">
                      <span className="text-yellow-500">•</span>
                      <span>
                        <strong>Not Found</strong> (404) - Resource missing
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-orange-500">•</span>
                      <span>
                        <strong>Unauthorized</strong> (401) - Auth required
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-orange-500">•</span>
                      <span>
                        <strong>Forbidden</strong> (403) - Permission denied
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-yellow-500">•</span>
                      <span>
                        <strong>Validation</strong> (400/422) - Invalid input
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-blue-500">•</span>
                      <span>
                        <strong>Network</strong> - Connection error
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-orange-500">•</span>
                      <span>
                        <strong>Timeout</strong> - Request timeout
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-red-500">•</span>
                      <span>
                        <strong>Server</strong> (5xx) - Server error
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-purple-500">•</span>
                      <span>
                        <strong>Blockchain</strong> - Contract/blockchain error
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-indigo-500">•</span>
                      <span>
                        <strong>Wallet</strong> - Wallet connection error
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Components */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Key Components
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li>
                      <span className="font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                        ErrorBoundary
                      </span>
                      - Catches React errors
                    </li>
                    <li>
                      <span className="font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                        ErrorService
                      </span>
                      - Error classification
                    </li>
                    <li>
                      <span className="font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                        ErrorContext
                      </span>
                      - State management
                    </li>
                    <li>
                      <span className="font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                        ErrorDisplay
                      </span>
                      - UI rendering
                    </li>
                    <li>
                      <span className="font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                        ErrorModal
                      </span>
                      - Modal display
                    </li>
                    <li>
                      <span className="font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                        Providers
                      </span>
                      - Root wrapper
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Features */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                ✨ Features
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    title: 'User-Friendly Errors',
                    desc: 'Clear, helpful messages for end users',
                  },
                  {
                    title: 'Automatic Retry',
                    desc: 'Built-in retry functionality for retryable errors',
                  },
                  {
                    title: 'Error Categorization',
                    desc: 'Smart classification of different error types',
                  },
                  {
                    title: 'Sentry Integration',
                    desc: 'Automatic error reporting and monitoring',
                  },
                  {
                    title: 'Development Debugging',
                    desc: 'Detailed error info in development mode',
                  },
                  {
                    title: 'Dark Mode Support',
                    desc: 'Full Tailwind dark mode compatibility',
                  },
                ].map((feature, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-700/50"
                  >
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      {feature.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {feature.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Usage Patterns */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                📚 Common Usage Patterns
              </h3>
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h4 className="font-mono text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                    useErrorHandler()
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Hook for handling errors in components. Best for displaying
                    errors in context.
                  </p>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                  <h4 className="font-mono text-sm font-semibold text-green-900 dark:text-green-200 mb-2">
                    wrapApiError()
                  </h4>
                  <p className="text-sm text-green-800 dark:text-green-300">
                    Wrap API errors to extract status codes and response data
                    automatically.
                  </p>
                </div>

                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                  <h4 className="font-mono text-sm font-semibold text-purple-900 dark:text-purple-200 mb-2">
                    withErrorBoundary()
                  </h4>
                  <p className="text-sm text-purple-800 dark:text-purple-300">
                    HOC for wrapping components with error boundary protection.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg shadow-lg p-8 border border-blue-200 dark:border-blue-700/50">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            🚀 Next Steps
          </h2>
          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="text-2xl">1️⃣</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Review the Error Handling Guide
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  See <code className="font-mono">ERROR_HANDLING_GUIDE.md</code>{' '}
                  for complete documentation
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl">2️⃣</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Integrate with Your Components
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Use <code className="font-mono">useErrorHandler()</code> hook
                  in your components
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl">3️⃣</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Configure Sentry
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Set up environment variables for error monitoring
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl">4️⃣</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Test in Development
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Use this demo page to test different error scenarios
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            For detailed information, see{' '}
            <a
              href="https://github.com/nova-rewards/ERROR_HANDLING_GUIDE.md"
              className="text-blue-600 dark:text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              ERROR_HANDLING_GUIDE.md
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
