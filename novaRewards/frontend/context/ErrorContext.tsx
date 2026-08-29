'use client';

import React, { createContext, useCallback, useState } from 'react';
import { StructuredError } from '@/lib/errorService';

/**
 * Error context for managing application-level errors
 */
export interface ErrorContextType {
  error: StructuredError | null;
  setError: (error: StructuredError | null) => void;
  clearError: () => void;
  hasError: boolean;
  isRetrying: boolean;
  retry: () => Promise<void>;
  setRetryCallback: (callback: () => Promise<void>) => void;
}

export const ErrorContext = createContext<ErrorContextType | undefined>(
  undefined
);

/**
 * Error context provider
 */
export function ErrorProvider({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<StructuredError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCallback, setRetryCallback] = useState<
    (() => Promise<void>) | null
  >(null);

  const clearError = useCallback(() => {
    setError(null);
    setRetryCallback(null);
  }, []);

  const retry = useCallback(async () => {
    if (!retryCallback) {
      console.warn('No retry callback registered');
      return;
    }

    setIsRetrying(true);
    try {
      await retryCallback();
      clearError();
    } catch (err) {
      // Error will be caught by error boundary or other error handlers
      console.error('Retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  }, [retryCallback, clearError]);

  const value: ErrorContextType = {
    error,
    setError,
    clearError,
    hasError: error !== null,
    isRetrying,
    retry,
    setRetryCallback,
  };

  return (
    <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>
  );
}

/**
 * Hook to use error context
 */
export function useError(): ErrorContextType {
  const context = React.useContext(ErrorContext);

  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }

  return context;
}

/**
 * Hook for setting an error and optionally retrying
 */
export function useErrorHandler() {
  const { setError, clearError, setRetryCallback } = useError();

  const handleError = useCallback(
    (
      error: StructuredError,
      retryFn?: () => Promise<void>
    ) => {
      setError(error);
      if (retryFn) {
        setRetryCallback(retryFn);
      }
    },
    [setError, setRetryCallback]
  );

  return {
    handleError,
    clearError,
    setRetryCallback,
  };
}
