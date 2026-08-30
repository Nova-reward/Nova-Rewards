import { useCallback } from 'react';
import {
  createStructuredError,
  reportStructuredError,
  wrapApiError,
  wrapBlockchainError,
  StructuredError,
} from '@/lib/errorService';
import { useErrorHandler } from '@/context/ErrorContext';

/**
 * Hook for handling async operations with automatic error handling
 * Provides retry functionality and error tracking
 */
export function useAsyncError() {
  const { handleError, setRetryCallback } = useErrorHandler();

  /**
   * Execute an async function with error handling
   */
  const executeAsync = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      options?: {
        onError?: (error: StructuredError) => void;
        context?: Record<string, unknown>;
      }
    ): Promise<T | null> => {
      try {
        return await fn();
      } catch (error) {
        const structuredError = createStructuredError(error, options?.context as any);
        reportStructuredError(structuredError, options?.context);

        if (options?.onError) {
          options.onError(structuredError);
        }

        handleError(structuredError, () => fn());
        return null;
      }
    },
    [handleError]
  );

  /**
   * Execute an API call with error handling
   */
  const executeApi = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      options?: {
        onError?: (error: StructuredError) => void;
        endpoint?: string;
        method?: string;
      }
    ): Promise<T | null> => {
      try {
        return await fn();
      } catch (error) {
        const structuredError = wrapApiError(error);
        reportStructuredError(structuredError, {
          endpoint: options?.endpoint,
          method: options?.method,
        });

        if (options?.onError) {
          options.onError(structuredError);
        }

        handleError(structuredError, () => fn());
        return null;
      }
    },
    [handleError]
  );

  /**
   * Execute a blockchain operation with error handling
   */
  const executeBlockchain = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      options?: {
        onError?: (error: StructuredError) => void;
        context?: string;
      }
    ): Promise<T | null> => {
      try {
        return await fn();
      } catch (error) {
        const structuredError = wrapBlockchainError(
          error,
          options?.context || 'blockchain_operation'
        );
        reportStructuredError(structuredError);

        if (options?.onError) {
          options.onError(structuredError);
        }

        handleError(structuredError, () => fn());
        return null;
      }
    },
    [handleError]
  );

  return {
    executeAsync,
    executeApi,
    executeBlockchain,
  };
}

/**
 * Hook for managing retry logic
 */
export function useRetry() {
  const { retry, isRetrying } = useErrorHandler() as any;

  const retryWithDelay = useCallback(
    async (delayMs: number = 1000) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return retry();
    },
    [retry]
  );

  return {
    retry,
    retryWithDelay,
    isRetrying,
  };
}
