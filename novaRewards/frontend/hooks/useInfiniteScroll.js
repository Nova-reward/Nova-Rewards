import { useEffect, useRef, useCallback, useReducer } from 'react';

/**
 * Attaches an IntersectionObserver to the returned ref.
 * Fires `onIntersect` when the element enters the viewport.
 * Observer is disconnected on unmount (no memory leaks).
 *
 * @param {() => void} onIntersect
 * @param {{ enabled?: boolean, rootMargin?: string }} [opts]
 * @returns {React.RefObject<HTMLElement>}
 */
export function useSentinel(onIntersect, { enabled = true, rootMargin = '200px' } = {}) {
  const ref = useRef(null);
  const cb = useRef(onIntersect);
  cb.current = onIntersect;

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) cb.current(); },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return ref;
}

// ── State machine ─────────────────────────────────────────────────────────────

/** @typedef {{ items: any[], page: number, loading: boolean, error: string|null, hasMore: boolean }} ScrollState */

const INIT = { items: [], page: 1, loading: true, error: null, hasMore: true };

function reducer(state, action) {
  switch (action.type) {
    case 'LOADING':
      return { ...state, loading: true, error: null };
    case 'SUCCESS': {
      const { items, hasMore, page } = action.payload;
      return {
        ...state,
        loading: false,
        page,
        hasMore,
        items: page === 1 ? items : [...state.items, ...items],
      };
    }
    case 'ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'RESET':
      return { ...INIT };
    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Paginated infinite-scroll data fetcher.
 *
 * @param {(page: number) => Promise<{ items: any[], hasMore: boolean }>} fetchPage
 * @param {{ pageLimit?: number }} [opts]
 */
export function useInfiniteScroll(fetchPage, { pageLimit = 10 } = {}) {
  const [state, dispatch] = useReducer(reducer, INIT);
  const inFlight = useRef(false);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const load = useCallback(async (page) => {
    if (inFlight.current) return;
    inFlight.current = true;
    dispatch({ type: 'LOADING' });
    try {
      const result = await fetchPageRef.current(page);
      const hasMore = result.hasMore && page < pageLimit;
      dispatch({ type: 'SUCCESS', payload: { items: result.items, hasMore, page } });
    } catch (err) {
      dispatch({ type: 'ERROR', payload: err?.message || 'Failed to load' });
    } finally {
      inFlight.current = false;
    }
  }, [pageLimit]);

  // Initial fetch
  useEffect(() => { load(1); }, [load]);

  const loadMore = useCallback(() => {
    if (!state.hasMore || state.loading || state.error) return;
    load(state.page + 1);
  }, [state.hasMore, state.loading, state.error, state.page, load]);

  const retry = useCallback(() => load(state.page), [state.page, load]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    // load(1) will be triggered by the useEffect watching `load`
    // but load is stable, so we call it directly:
    load(1);
  }, [load]);

  return { ...state, loadMore, retry, reset };
}
