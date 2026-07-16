/**
 * Fee Estimate API Client
 *
 * Calls the backend POST /api/fee-estimate endpoint to get a Soroban
 * contract invocation fee breakdown before the user confirms a transaction.
 */

import api from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeeEstimateRequest {
  contractId: string;
  functionName: string;
  /** Native JS values or XDR ScVal base64 strings */
  args?: unknown[];
  /** Network inclusion fee in stroops (default: "100") */
  inclusionFee?: string;
}

export interface FeeEstimate {
  /** Soroban resource fee in stroops */
  resourceFee: string;
  /** Network inclusion fee in stroops */
  inclusionFee: string;
  /** Total fee in stroops (resource + inclusion) */
  totalFee: string;
  contractId: string;
  functionName: string;
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

/**
 * Fetches a fee estimate for a Soroban contract invocation.
 * No transaction is submitted — this is simulation only.
 *
 * @throws {Error} If the request fails or the simulation errors
 */
export async function fetchFeeEstimate(
  params: FeeEstimateRequest,
): Promise<FeeEstimate> {
  const response = await api.post<{ success: boolean; data: FeeEstimate }>(
    '/api/fee-estimate',
    params,
  );
  return response.data.data;
}
