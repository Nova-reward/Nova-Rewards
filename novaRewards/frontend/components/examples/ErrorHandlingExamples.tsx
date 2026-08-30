'use client';

import React, { useState } from 'react';
import axios from 'axios';
import {
  createStructuredError,
  reportStructuredError,
  wrapApiError,
  wrapBlockchainError,
} from '@/lib/errorService';
import { useErrorHandler } from '@/context/ErrorContext';
import ErrorBoundary, { withErrorBoundary } from '../ErrorBoundary';

/**
 * Example component showing various error handling patterns
 * This component demonstrates different error scenarios and how to handle them
 */
export function ErrorHandlingExamples() {
  const { handleError } = useErrorHandler();
  const [isLoading, setIsLoading] = useState(false);

  // Example 1: Basic error handling with retry
  const handleBasicError = async () => {
    setIsLoading(true);
    try {
      throw new Error('This is a basic error');
    } catch (error) {
      const structuredError = createStructuredError(error);
      handleError(structuredError, handleBasicError);
    } finally {
      setIsLoading(false);
    }
  };

  // Example 2: API error handling
  const handleApiError = async () => {
    setIsLoading(true);
    try {
      await axios.get('/api/nonexistent');
    } catch (error) {
      const structuredError = wrapApiError(error);
      reportStructuredError(structuredError, {
        component: 'ErrorHandlingExamples',
        action: 'api_call',
      });
      handleError(structuredError);
    } finally {
      setIsLoading(false);
    }
  };

  // Example 3: Network error simulation
  const handleNetworkError = async () => {
    setIsLoading(true);
    try {
      throw new Error('Network request failed');
    } catch (error) {
      const structuredError = createStructuredError(error, {
        type: 'network',
        userMessage: 'Unable to connect to the server. Please check your internet connection.',
      });
      handleError(structuredError, handleNetworkError);
    } finally {
      setIsLoading(false);
    }
  };

  // Example 4: Timeout error simulation
  const handleTimeoutError = async () => {
    setIsLoading(true);
    try {
      throw new Error('Request timeout');
    } catch (error) {
      const structuredError = createStructuredError(error, {
        type: 'timeout',
        retryAfter: 5000,
      });
      handleError(structuredError, handleTimeoutError);
    } finally {
      setIsLoading(false);
    }
  };

  // Example 5: Blockchain/Wallet error
  const handleBlockchainError = async () => {
    setIsLoading(true);
    try {
      throw new Error('Wallet connection failed: Invalid network');
    } catch (error) {
      const structuredError = wrapBlockchainError(
        error,
        'wallet_connection'
      );
      reportStructuredError(structuredError, {
        walletType: 'freighter',
        network: 'testnet',
      });
      handleError(structuredError);
    } finally {
      setIsLoading(false);
    }
  };

  // Example 6: Validation error
  const handleValidationError = async () => {
    setIsLoading(true);
    try {
      throw new Error(
        'Validation failed: Email must be a valid email address'
      );
    } catch (error) {
      const structuredError = createStructuredError(error, {
        type: 'validation',
        details: {
          field: 'email',
          validationRule: 'email_format',
        },
      });
      handleError(structuredError);
    } finally {
      setIsLoading(false);
    }
  };

  // Example 7: Authorization error
  const handleAuthError = async () => {
    setIsLoading(true);
    try {
      throw new Error('Unauthorized: Invalid credentials');
    } catch (error) {
      const structuredError = createStructuredError(error, {
        type: 'unauthorized',
        statusCode: 401,
      });
      handleError(structuredError);
    } finally {
      setIsLoading(false);
    }
  };

  // Example 8: Server error (500)
  const handleServerError = async () => {
    setIsLoading(true);
    try {
      throw new Error('Internal server error');
    } catch (error) {
      const structuredError = createStructuredError(error, {
        type: 'server',
        statusCode: 500,
        details: {
          endpoint: '/api/critical-operation',
        },
      });
      reportStructuredError(structuredError, {
        severity: 'critical',
      });
      handleError(structuredError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Error Handling Examples
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Click any button to trigger different error scenarios and see how
          the error handling system responds.
        </p>
      </div>

      {/* Error Examples Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Error */}
        <button
          onClick={handleBasicError}
          disabled={isLoading}
          className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
        >
          <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
            Basic Error
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300">
            Demonstrates simple error handling with retry
          </p>
        </button>

        {/* API Error */}
        <button
          onClick={handleApiError}
          disabled={isLoading}
          className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
        >
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
            API Error (404)
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Simulates an API request to a non-existent endpoint
          </p>
        </button>

        {/* Network Error */}
        <button
          onClick={handleNetworkError}
          disabled={isLoading}
          className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
        >
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
            Network Error
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Connection failure with retry capability
          </p>
        </button>

        {/* Timeout Error */}
        <button
          onClick={handleTimeoutError}
          disabled={isLoading}
          className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
        >
          <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-1">
            Timeout Error
          </h3>
          <p className="text-sm text-orange-700 dark:text-orange-300">
            Request exceeded time limit with retry delay
          </p>
        </button>

        {/* Blockchain Error */}
        <button
          onClick={handleBlockchainError}
          disabled={isLoading}
          className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
        >
          <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">
            Blockchain/Wallet Error
          </h3>
          <p className="text-sm text-purple-700 dark:text-purple-300">
            Wallet connection or blockchain operation failure
          </p>
        </button>

        {/* Validation Error */}
        <button
          onClick={handleValidationError}
          disabled={isLoading}
          className="p-4 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
        >
          <h3 className="font-semibold text-cyan-900 dark:text-cyan-200 mb-1">
            Validation Error
          </h3>
          <p className="text-sm text-cyan-700 dark:text-cyan-300">
            Invalid input data with field-level details
          </p>
        </button>

        {/* Auth Error */}
        <button
          onClick={handleAuthError}
          disabled={isLoading}
          className="p-4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
        >
          <h3 className="font-semibold text-pink-900 dark:text-pink-200 mb-1">
            Authorization Error (401)
          </h3>
          <p className="text-sm text-pink-700 dark:text-pink-300">
            Authentication failure requiring re-login
          </p>
        </button>

        {/* Server Error */}
        <button
          onClick={handleServerError}
          disabled={isLoading}
          className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
        >
          <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
            Server Error (500)
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300">
            Internal server error with critical severity
          </p>
        </button>
      </div>

      {/* Information Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
          ℹ️ How it works:
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
          <li>
            • Click any button to trigger an error of that type
          </li>
          <li>
            • The error will be caught and displayed in an error modal
          </li>
          <li>
            • For retryable errors, you can click "Try Again" to retry
          </li>
          <li>
            • Error details are logged to Sentry for monitoring
          </li>
          <li>
            • In development mode, additional debugging info is shown
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Example component showing how to use error boundary HOC
 */
function ErrorBoundaryExample() {
  const [count, setCount] = useState(0);

  if (count > 0) {
    throw new Error('This error is caught by the Error Boundary!');
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-semibold text-gray-900 dark:text-white">
        Error Boundary HOC Example
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Click the button below to trigger an error that will be caught by the
        error boundary.
      </p>
      <button
        onClick={() => setCount(count + 1)}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
      >
        Trigger Error
      </button>
    </div>
  );
}

const WrappedErrorBoundaryExample = withErrorBoundary(
  ErrorBoundaryExample,
  {
    onError: (error, errorInfo) => {
      console.log('Error Boundary caught error:', error);
    },
  }
);

/**
 * Example showing error boundary usage
 */
export function ErrorBoundaryUsageExample() {
  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Error Boundary Usage
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          The component below is wrapped with an error boundary using the HOC
          pattern.
        </p>
      </div>
      <ErrorBoundary>
        <WrappedErrorBoundaryExample />
      </ErrorBoundary>
    </div>
  );
}
