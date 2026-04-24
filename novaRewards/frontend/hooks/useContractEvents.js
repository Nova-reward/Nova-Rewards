import { useState, useEffect, useCallback, useRef } from 'react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Fetches paginated contract event history with optional filters.
 *
 * @param {object} filters
 * @param {string}  [filters.contract]    - contract name (e.g. 'nova-rewards')
 * @param {string}  [filters.event_type]  - e.g. 'nova_rwd:staked'
 * @param {string}  [filters.account]     - Stellar public key
 * @param {number}  [filters.ledger_from]
 * @param {number}  [filters.ledger_to]
 * @param {string}  [filters.date_from]   - ISO date string
 * @param {string}  [filters.date_to]     - ISO date string
 * @param {string}  [filters.tx_hash]
 * @param {number}  [filters.limit=50]
 * @param {number}  [filters.offset=0]
 *
 * @returns {{
 *   events: Array,
 *   pagination: object|null,
 *   loading: boolean,
 *   error: string|null,
 *   refetch: () => void
 * }}
 */
export function useContractEvents(filters = {}) {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.set(k, v);
      });

      const res = await fetch(`${BASE_URL}/api/contract-events?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      setEvents(json.data ?? []);
      setPagination(json.pagination ?? null);
    } catch (err) {
      setError(err?.message || 'Failed to load contract events');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  useEffect(() => { load(); }, [load]);

  return { events, pagination, loading, error, refetch: load };
}

/**
 * Returns the list of known event types from the registry endpoint.
 *
 * @returns {{ types: object|null, loading: boolean, error: string|null }}
 */
export function useEventTypes() {
  const [types, setTypes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${BASE_URL}/api/contract-events/types`)
      .then(r => r.json())
      .then(json => setTypes(json.data ?? null))
      .catch(err => setError(err?.message || 'Failed to load event types'))
      .finally(() => setLoading(false));
  }, []);

  return { types, loading, error };
}

/**
 * Opens a Server-Sent Events stream for real-time contract event monitoring.
 * Automatically reconnects on disconnect.
 *
 * @param {object}   options
 * @param {string}   [options.contract]   - filter by contract name
 * @param {string}   [options.event_type] - filter by event type
 * @param {boolean}  [options.enabled=true]
 * @param {number}   [options.maxEvents=100] - max events to keep in memory
 *
 * @returns {{
 *   liveEvents: Array,
 *   connected: boolean,
 *   error: string|null,
 *   clear: () => void
 * }}
 */
export function useContractEventMonitor({
  contract,
  event_type,
  enabled = true,
  maxEvents = 100,
} = {}) {
  const [liveEvents, setLiveEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const esRef = useRef(null);

  const clear = useCallback(() => setLiveEvents([]), []);

  useEffect(() => {
    if (!enabled) return;

    const params = new URLSearchParams();
    if (contract) params.set('contract', contract);
    if (event_type) params.set('event_type', event_type);

    const url = `${BASE_URL}/api/contract-events/monitor?${params}`;

    function connect() {
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener('connected', () => setConnected(true));

      es.addEventListener('contract_event', e => {
        try {
          const event = JSON.parse(e.data);
          setLiveEvents(prev => [event, ...prev].slice(0, maxEvents));
        } catch {
          // malformed event — ignore
        }
      });

      es.addEventListener('error', () => {
        setConnected(false);
        setError('Stream disconnected — reconnecting…');
        es.close();
        // Reconnect after 5 s
        setTimeout(connect, 5000);
      });
    }

    connect();

    return () => {
      esRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, contract, event_type, maxEvents]);

  return { liveEvents, connected, error, clear };
}
