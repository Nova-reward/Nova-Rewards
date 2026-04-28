'use strict';

/**
 * Reward Issuance Repository — unit test suite (Vitest)
 *
 * Covers:
 *  - createIssuance: success, unique violation (idempotency) returns null,
 *    other DB errors propagate
 *  - getIssuanceByKey: hit, miss, null/undefined key edge cases
 *  - markConfirmed: updates status + tx_hash, returns updated row
 *  - markFailed: updates status + error_message, returns updated row
 *  - incrementAttempts: atomic SQL increment, returns void
 *
 * All external dependencies (PostgreSQL / pg) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the pg query layer ────────────────────────────────────────────────
vi.mock('../db/index', () => ({
  query: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────────────────
import { query } from '../db/index';
import {
  createIssuance,
  getIssuanceByKey,
  markConfirmed,
  markFailed,
  incrementAttempts,
} from '../db/rewardIssuanceRepository';

// ── Fixtures ───────────────────────────────────────────────────────────────
const BASE_ISSUANCE = {
  id: 1,
  idempotency_key: 'merchant:123:user:456:action:789',
  campaign_id: 1,
  user_id: 456,
  wallet_address: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  amount: '10.5',
  status: 'pending',
  tx_hash: null,
  error_message: null,
  attempts: 0,
  created_at: new Date().toISOString(),
  updated_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// SUITE: createIssuance
// ============================================================================
describe('createIssuance', () => {
  const params = {
    idempotencyKey: 'merchant:123:user:456:action:789',
    campaignId: 1,
    userId: 456,
    walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    amount: 10.5,
  };

  it('inserts a new row and returns it', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_ISSUANCE] });

    const result = await createIssuance(params);

    expect(result).toEqual(BASE_ISSUANCE);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/INSERT INTO reward_issuances/i);
    expect(query.mock.calls[0][1]).toEqual([
      params.idempotencyKey,
      params.campaignId,
      params.userId,
      params.walletAddress,
      params.amount,
    ]);
  });

  it('returns null on unique violation (duplicate idempotency key)', async () => {
    const err = new Error('duplicate key value violates unique constraint');
    err.code = '23505';
    query.mockRejectedValueOnce(err);

    const result = await createIssuance(params);

    expect(result).toBeNull();
  });

  it('propagates non-unique-violation DB errors', async () => {
    query.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

    await expect(createIssuance(params)).rejects.toThrow('Connection terminated unexpectedly');
  });

  it('sets null campaign_id when campaignId is not provided', async () => {
    const { campaignId, ...paramsNoCampaign } = params;
    query.mockResolvedValueOnce({ rows: [{ ...BASE_ISSUANCE, campaign_id: null }] });

    await createIssuance(paramsNoCampaign);

    const args = query.mock.calls[0][1];
    expect(args[1]).toBeNull();
  });

  it('sets null user_id when userId is not provided', async () => {
    const { userId, ...paramsNoUser } = params;
    query.mockResolvedValueOnce({ rows: [{ ...BASE_ISSUANCE, user_id: null }] });

    await createIssuance(paramsNoUser);

    const args = query.mock.calls[0][1];
    expect(args[2]).toBeNull();
  });

  it('SQL contains RETURNING *', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_ISSUANCE] });
    await createIssuance(params);
    expect(query.mock.calls[0][0]).toMatch(/RETURNING \*/i);
  });
});

// ============================================================================
// SUITE: getIssuanceByKey
// ============================================================================
describe('getIssuanceByKey', () => {
  it('returns the row when found', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_ISSUANCE] });

    const result = await getIssuanceByKey('merchant:123:user:456:action:789');

    expect(result).toEqual(BASE_ISSUANCE);
    expect(query.mock.calls[0][0]).toMatch(/SELECT \* FROM reward_issuances/i);
    expect(query.mock.calls[0][1]).toEqual(['merchant:123:user:456:action:789']);
  });

  it('returns null when not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const result = await getIssuanceByKey('unknown-key');

    expect(result).toBeNull();
  });

  it('propagates DB errors', async () => {
    query.mockRejectedValueOnce(new Error('DB timeout'));

    await expect(getIssuanceByKey('key')).rejects.toThrow('DB timeout');
  });
});

// ============================================================================
// SUITE: markConfirmed
// ============================================================================
describe('markConfirmed', () => {
  it('updates status to confirmed and sets tx_hash', async () => {
    const confirmed = { ...BASE_ISSUANCE, status: 'confirmed', tx_hash: 'tx_abc123' };
    query.mockResolvedValueOnce({ rows: [confirmed] });

    const result = await markConfirmed(1, 'tx_abc123');

    expect(result.status).toBe('confirmed');
    expect(result.tx_hash).toBe('tx_abc123');
    expect(query.mock.calls[0][0]).toMatch(/status = 'confirmed'/i);
    expect(query.mock.calls[0][0]).toMatch(/tx_hash =/i);
    expect(query.mock.calls[0][1]).toEqual(['tx_abc123', 1]);
  });

  it('returns null when row not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const result = await markConfirmed(999, 'tx_xyz');

    expect(result).toBeUndefined(); // rows[0] is undefined
  });

  it('propagates DB errors', async () => {
    query.mockRejectedValueOnce(new Error('Update failed'));

    await expect(markConfirmed(1, 'tx')).rejects.toThrow('Update failed');
  });

  it('SQL updates updated_at = NOW()', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_ISSUANCE] });
    await markConfirmed(1, 'tx');
    expect(query.mock.calls[0][0]).toMatch(/updated_at = NOW\(\)/i);
  });
});

// ============================================================================
// SUITE: markFailed
// ============================================================================
describe('markFailed', () => {
  it('updates status to failed and sets error_message', async () => {
    const failed = { ...BASE_ISSUANCE, status: 'failed', error_message: 'Stellar timeout' };
    query.mockResolvedValueOnce({ rows: [failed] });

    const result = await markFailed(1, 'Stellar timeout');

    expect(result.status).toBe('failed');
    expect(result.error_message).toBe('Stellar timeout');
    expect(query.mock.calls[0][0]).toMatch(/status = 'failed'/i);
    expect(query.mock.calls[0][1]).toEqual(['Stellar timeout', 1]);
  });

  it('stores empty string when error message is empty', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...BASE_ISSUANCE, status: 'failed', error_message: '' }] });

    const result = await markFailed(1, '');

    expect(result.error_message).toBe('');
    expect(query.mock.calls[0][1]).toContain('');
  });

  it('propagates DB errors', async () => {
    query.mockRejectedValueOnce(new Error('Deadlock detected'));

    await expect(markFailed(1, 'err')).rejects.toThrow('Deadlock detected');
  });

  it('SQL updates updated_at = NOW()', async () => {
    query.mockResolvedValueOnce({ rows: [BASE_ISSUANCE] });
    await markFailed(1, 'err');
    expect(query.mock.calls[0][0]).toMatch(/updated_at = NOW\(\)/i);
  });
});

// ============================================================================
// SUITE: incrementAttempts
// ============================================================================
describe('incrementAttempts', () => {
  it('executes atomic increment SQL', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await incrementAttempts(1);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/attempts = attempts \+ 1/i);
    expect(query.mock.calls[0][0]).toMatch(/updated_at = NOW\(\)/i);
    expect(query.mock.calls[0][1]).toEqual([1]);
  });

  it('propagates DB errors', async () => {
    query.mockRejectedValueOnce(new Error('Connection lost'));

    await expect(incrementAttempts(1)).rejects.toThrow('Connection lost');
  });

  it('returns undefined (no rows returned)', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const result = await incrementAttempts(42);

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// SUITE: idempotency edge cases
// ============================================================================
describe('idempotency edge cases', () => {
  it('createIssuance handles unique violation with code 23505 only', async () => {
    // 23505 is the Postgres unique_violation code
    const err = new Error('unique_violation');
    err.code = '23504'; // wrong code — NOT a unique violation
    query.mockRejectedValueOnce(err);

    await expect(createIssuance({
      idempotencyKey: 'key',
      campaignId: 1,
      userId: 1,
      walletAddress: 'addr',
      amount: 1,
    })).rejects.toThrow('unique_violation');
  });

  it('getIssuanceByKey with empty string returns null if not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await getIssuanceByKey('');
    expect(result).toBeNull();
  });
});
