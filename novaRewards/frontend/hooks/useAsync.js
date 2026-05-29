import { useState, useCallback, useRef } from 'react';

/**
 * Wraps an async function with loading / error / data state.
 *
 * @template T
 * @param {(...args: any[]) => Promise<T>} asyncFn
 * @returns {{ execute: (...args: any[]) => Promise<T|undefined>, data: T|null, loading: boolean, error: string|null, reset: () => void }}
 */
export function useAsync(asyncFn) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { execute, data, loading, error, reset };
}
