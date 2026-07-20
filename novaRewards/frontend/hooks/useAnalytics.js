import { useState, useEffect, useCallback } from 'react';
import { fetchAnalytics } from '../lib/analyticsApi';

/**
 * Fetches all analytics data for the given date range.
 * Re-fetches automatically when `range` changes.
 *
 * @param {'7d'|'30d'|'90d'} range
 * @returns {{ data: object|null, loading: boolean, error: string|null, refetch: () => void }}
 */
export function useAnalytics(range) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAnalytics(range);
      setData(result);
    } catch (err) {
      setError(err?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refetch: load };
}
