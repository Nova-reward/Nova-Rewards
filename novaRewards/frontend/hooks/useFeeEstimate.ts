/**
 * useFeeEstimate
 *
 * React hook that fetches a Soroban contract invocation fee estimate
 * from the backend before the user confirms a transaction.
 *
 * Usage:
 *   const { estimate, loading, error, refresh } = useFeeEstimate({
 *     contractId: 'C...',
 *     functionName: 'issue_reward',
 *     args: [recipientAddress, amount, campaignId],
 *   });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchFeeEstimate, FeeEstimate, FeeEstimateRequest } from '@/lib/feeEstimateApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseFeeEstimateResult {
  estimate: FeeEstimate | null;
  loading: boolean;
  error: string | null;
  /** Manually re-trigger the estimate (e.g. after args change) */
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @param params - Contract ID, function name, and optional args/inclusionFee.
 *                 Pass `null` to skip fetching (e.g. when args are not ready).
 */
export function useFeeEstimate(
  params: FeeEstimateRequest | null,
): UseFeeEstimateResult {
  const [estimate, setEstimate] = useState<FeeEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest request to discard stale responses
  const requestIdRef = useRef(0);

  const run = useCallback(async (req: FeeEstimateRequest) => {
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFeeEstimate(req);
      // Only apply if this is still the latest request
      if (id === requestIdRef.current) {
        setEstimate(result);
      }
    } catch (err: unknown) {
      if (id === requestIdRef.current) {
        const message =
          err instanceof Error ? err.message : 'Failed to estimate fee';
        setError(message);
        setEstimate(null);
      }
    } finally {
      if (id === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Re-fetch whenever params change (deep-compare via JSON)
  const paramsKey = params ? JSON.stringify(params) : null;

  useEffect(() => {
    if (!params) {
      setEstimate(null);
      setError(null);
      setLoading(false);
      return;
    }
    run(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  const refresh = useCallback(() => {
    if (params) run(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, run]);

  return { estimate, loading, error, refresh };
}
