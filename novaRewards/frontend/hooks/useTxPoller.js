import { useState, useCallback, useRef } from 'react';
import { pollTransactionStatus, TransactionTimeout, TransactionExpired } from '../lib/txPoller';

/**
 * React hook that wraps pollTransactionStatus and exposes real-time status.
 *
 * Usage:
 *   const { status, error, start } = useTxPoller();
 *   await start(hash);
 *
 * status: null | 'pending' | 'confirming' | 'confirmed' | 'failed' | 'expired' | 'timeout'
 *
 * Issue #662
 */
export function useTxPoller() {
  const [status, setStatus] = useState(null);
  const [error, setError]   = useState(null);
  const abortRef = useRef(false);

  const start = useCallback(async (hash, { onConfirmed, onFailed } = {}) => {
    abortRef.current = false;
    setError(null);
    setStatus('pending');

    try {
      const tx = await pollTransactionStatus(hash, (s) => {
        if (!abortRef.current) setStatus(s);
      });

      if (tx.successful) {
        onConfirmed?.(tx);
      } else {
        onFailed?.(tx);
      }
      return tx;
    } catch (err) {
      if (abortRef.current) return;
      if (err instanceof TransactionTimeout) {
        setStatus('timeout');
      } else if (err instanceof TransactionExpired) {
        setStatus('expired');
      } else {
        setStatus('failed');
      }
      setError(err.message);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    setStatus(null);
    setError(null);
  }, []);

  return { status, error, start, reset };
}
