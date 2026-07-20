import { useEffect, useRef, useCallback, useState } from 'react';

export interface PollingOptions<T> {
  fetchFn: () => Promise<T>;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  interval?: number;
  enabled?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export interface PollingState {
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  lastUpdated: Date | null;
}

export function usePolling<T>({
  fetchFn,
  onSuccess,
  onError,
  interval = 15000, // 15 seconds default
  enabled = true,
  maxRetries = 3,
  retryDelay = 1000, // 1 second initial backoff
}: PollingOptions<T>): PollingState {
  const [state, setState] = useState<PollingState>({
    isLoading: true,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const isTabVisibleRef = useRef(true);

  const executeFetch = useCallback(async (isInitial = false) => {
    if (!isMountedRef.current) return;

    setState(prev => ({
      ...prev,
      isLoading: isInitial,
      isRefreshing: !isInitial && isTabVisibleRef.current,
      error: null,
    }));

    try {
      const data = await fetchFn();
      
      if (isMountedRef.current) {
        onSuccess?.(data);
        setState(prev => ({
          ...prev,
          isLoading: false,
          isRefreshing: false,
          error: null,
          lastUpdated: new Date(),
        }));
        retryCountRef.current = 0; // Reset retry count on success
      }
    } catch (error) {
      console.error('Polling fetch failed:', error);
      
      if (isMountedRef.current) {
        const shouldRetry = retryCountRef.current < maxRetries;
        
        if (shouldRetry) {
          retryCountRef.current++;
          const backoffDelay = retryDelay * Math.pow(2, retryCountRef.current - 1);
          
          timeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              executeFetch(false);
            }
          }, backoffDelay);
        } else {
          onError?.(error as Error);
          setState(prev => ({
            ...prev,
            isLoading: false,
            isRefreshing: false,
            error: error as Error,
          }));
        }
      }
    }
  }, [fetchFn, onSuccess, onError, maxRetries, retryDelay]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = document.visibilityState === 'visible';
      
      if (isTabVisibleRef.current && enabled) {
        // Resume polling - fetch immediately
        executeFetch(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, executeFetch]);

  // Main polling effect
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!enabled) return;

    // Initial fetch
    executeFetch(true);

    // Set up interval
    const intervalId = setInterval(() => {
      if (isTabVisibleRef.current && isMountedRef.current) {
        executeFetch(false);
      }
    }, interval);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, interval, executeFetch]);

  return state;
}
