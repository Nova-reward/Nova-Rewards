import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';

/**
 * Generic data-fetching hook backed by the project's axios instance.
 *
 * @param {string|null} url  Relative API path. Pass null to skip fetching.
 * @param {{ method?: string, body?: any }} [options]
 * @returns {{ data: any, loading: boolean, error: string|null, refetch: () => void }}
 */
export function useFetch(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  const execute = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const { method = 'get', body } = optsRef.current;
      const res = await api.request({ url, method, data: body });
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { execute(); }, [execute]);

  return { data, loading, error, refetch: execute };
}
