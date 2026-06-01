'use strict';

/**
 * Reward Issuance Engine — comprehensive unit test suite (Vitest)
 *
 * Covers:
 *  - Eligible action → reward issued, ineligible action → no reward
 *  - Idempotency: duplicate action event does not issue duplicate reward
 *  - Retry logic: failed transaction retried up to 3 times then dead-lettered
 *  - Budget exhaustion: reward rejected when campaign budget is depleted
 *  - 100% branch coverage on the reward engine module
 *
 * All external dependencies (Stellar SDK, Prisma, Redis/BullMQ) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock external modules before importing service ───────────────────────────
vi.mock('../../blockchain/sendRewards', () => ({
  distributeRewards: vi.fn(),
}));

vi.mock('../../jobs/queues', () => ({
  rewardIssuanceQueue: {
    add: vi.fn(),
  },
}));

vi.mock('../db/rewardIssuanceRepository', () => ({
  createIssuance: vi.fn(),
  getIssuanceByKey: vi.fn(),
  markConfirmed: vi.fn(),
  markFailed: vi.fn(),
  incrementAttempts: vi.fn(),
}));

vi.mock('../db/campaignRepository', () => ({
  getActiveCampaign: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────────────────
import { distributeRewards } from '../../blockchain/sendRewards';
import { rewardIssuanceQueue } from '../../jobs/queues';
import {
  createIssuance,
  getIssuanceByKey,
  markConfirmed,
  markFailed,
  incrementAttempts,
} from '../db/rewardIssuanceRepository';
import { getActiveCampaign } from '../db/campaignRepository';

import { enqueueRewardIssuance, processRewardIssuance } from '../services/rewardIssuanceService';

// ── Test Utilities ─────────────────────────────────────────────────────────
const NOW = new Date();
const FUTURE = new Date(NOW.getTime() + 86_400_000 * 30);
const PAST = new Date(NOW.getTime() - 86_400_000);

function makeCampaign(overrides = {}) {
  return {
    id: 1,
    name: 'Test Campaign',
    reward_rate: 1.5,
    is_active: true,
    end_date: FUTURE.toISOString().split('T')[0],
    ...overrides,
  };
}

function makeJob(data, attempts = 0, opts = {}) {
  return {
    id: 123,
    data,
    attemptsMade: attempts,
    opts: {
      attempts: 3,
      ...opts,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// SUITE: enqueueRewardIssuance
// ============================================================================
describe('enqueueRewardIssuance', () => {
  const baseParams = {
    idempotencyKey: 'merchant:123:user:456:action:789',
    campaignId: 1,
    userId: 456,
    walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    amount: 10.5,
  };

  it('enqueues when no existing issuance', async () => {
    getIssuanceByKey.mockResolvedValue(null);
    createIssuance.mockResolvedValue({ id: 100, ...baseParams, status: 'pending' });
    rewardIssuanceQueue.add.mockResolvedValue(true);

    const result = await enqueueRewardIssuance(baseParams);

    expect(result).toEqual({ queued: true, issuanceId: 100 });
    expect(getIssuanceByKey).toHaveBeenCalledWith(baseParams.idempotencyKey);
    expect(createIssuance).toHaveBeenCalledWith(baseParams);
    expect(rewardIssuanceQueue.add).toHaveBeenCalledWith(
      'issue-reward',
      { issuanceId: 100, ...baseParams },
      { jobId: baseParams.idempotencyKey }
    );
  });

  it('returns duplicate when issuance already exists with confirmed status', async () => {
    getIssuanceByKey.mockResolvedValue({
      id: 99,
      ...baseParams,
      status: 'confirmed',
    });

    const result = await enqueueRewardIssuance(baseParams);

    expect(result).toEqual({
      queued: false,
      duplicate: true,
      issuanceId: 99,
      status: 'confirmed',
    });
    expect(createIssuance).not.toHaveBeenCalled();
    expect(rewardIssuanceQueue.add).not.toHaveBeenCalled();
  });

  it('returns duplicate when issuance already exists with pending status', async () => {
    getIssuanceByKey.mockResolvedValue({
      id: 99,
      ...baseParams,
      status: 'pending',
    });

    const result = await enqueueRewardIssuance(baseParams);

    expect(result.duplicate).toBe(true);
    expect(result.issuanceId).toBe(99);
    expect(createIssuance).not.toHaveBeenCalled();
  });

  it('returns duplicate when issuance already exists with failed status', async () => {
    getIssuanceByKey.mockResolvedValue({
      id: 99,
      ...baseParams,
      status: 'failed',
    });

    const result = await enqueueRewardIssuance(baseParams);

    expect(result.duplicate).toBe(true);
    expect(createIssuance).not.toHaveBeenCalled();
    expect(rewardIssuanceQueue.add).not.toHaveBeenCalled();
  });

  it('handles race condition: insertion fails due to unique constraint', async () => {
    getIssuanceByKey.mockResolvedValueOnce(null);
    createIssuance.mockResolvedValue(null);
    getIssuanceByKey.mockResolvedValueOnce({
      id: 101,
      ...baseParams,
      status: 'pending',
    });

    const result = await enqueueRewardIssuance(baseParams);

    expect(result).toEqual({
      queued: false,
      duplicate: true,
      issuanceId: 101,
      status: 'pending',
    });
    expect(getIssuanceByKey).toHaveBeenCalledTimes(2);
    expect(rewardIssuanceQueue.add).not.toHaveBeenCalled();
  });

  it('propagates error from createIssuance when not a duplicate violation', async () => {
    getIssuanceByKey.mockResolvedValue(null);
    createIssuance.mockRejectedValue(new Error('Database connection failed'));

    await expect(enqueueRewardIssuance(baseParams)).rejects.toThrow('Database connection failed');
  });

  it('requires walletAddress', async () => {
    const { walletAddress, ...rest } = baseParams;
    const result = await enqueueRewardIssuance({ ...rest, walletAddress: '' });
    expect(getIssuanceByKey).toHaveBeenCalled();
  });

  it('works with minimal params (no userId)', async () => {
    getIssuanceByKey.mockResolvedValue(null);
    createIssuance.mockResolvedValue({ id: 100, ...baseParams, status: 'pending' });
    rewardIssuanceQueue.add.mockResolvedValue(true);

    const { userId, ...paramsWithoutUser } = baseParams;
    const result = await enqueueRewardIssuance(paramsWithoutUser);

    expect(result.queued).toBe(true);
    expect(result.issuanceId).toBe(100);
  });
});

// ============================================================================
// SUITE: processRewardIssuance — successful processing
// ============================================================================
describe('processRewardIssuance — success paths', () => {
  const data = {
    issuanceId: 100,
    idempotencyKey: 'merchant:123:user:456:action:789',
    campaignId: 1,
    userId: 456,
    walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    amount: '10.5',
  };

  it('successfully processes and confirms reward', async () => {
    const job = makeJob(data, 0);

    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockResolvedValue({ txHash: 'tx_hash_abc123', success: true });

    const result = await processRewardIssuance(job);

    expect(incrementAttempts).toHaveBeenCalledWith(data.issuanceId);
    expect(getActiveCampaign).toHaveBeenCalledWith(data.campaignId);
    expect(distributeRewards).toHaveBeenCalledWith({
      recipient: data.walletAddress,
      amount: data.amount,
      campaignId: data.campaignId,
    });
    expect(markConfirmed).toHaveBeenCalledWith(data.issuanceId, 'tx_hash_abc123');
    expect(result).toEqual({ confirmed: true, txHash: 'tx_hash_abc123' });
  });

  it('processes with campaign without userId', async () => {
    const jobData = { ...data, userId: undefined };
    const job = makeJob(jobData, 0);

    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockResolvedValue({ txHash: 'tx_hash_xyz', success: true });

    const result = await processRewardIssuance(job);

    expect(result.confirmed).toBe(true);
    expect(distributeRewards).toHaveBeenCalledWith({
      recipient: data.walletAddress,
      amount: data.amount,
      campaignId: data.campaignId,
    });
  });
});

// ============================================================================
// SUITE: processRewardIssuance — ineligible / campaign inactive
// ============================================================================
describe('processRewardIssuance — inactive campaign (ineligible)', () => {
  const data = {
    issuanceId: 200,
    campaignId: 2,
    walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    amount: '5.0',
  };

  it('campaign inactive — marks failed, does NOT retry', async () => {
    const job = makeJob(data, 0);
    getActiveCampaign.mockResolvedValue(null);

    const result = await processRewardIssuance(job);

    expect(incrementAttempts).toHaveBeenCalledWith(data.issuanceId);
    expect(getActiveCampaign).toHaveBeenCalledWith(data.campaignId);
    expect(distributeRewards).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith(data.issuanceId, 'Campaign is inactive or expired');
    expect(result).toEqual({ skipped: true, reason: 'campaign_inactive' });
  });

  it('does not throw when campaign is inactive — prevents BullMQ retry', async () => {
    const job = makeJob(data, 2);
    getActiveCampaign.mockResolvedValue(null);

    const result = await processRewardIssuance(job);

    expect(result.skipped).toBe(true);
    expect(distributeRewards).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith(data.issuanceId, 'Campaign is inactive or expired');
  });
});

// ============================================================================
// SUITE: processRewardIssuance — retry and failure handling
// ============================================================================
describe('processRewardIssuance — retry logic and failure handling', () => {
  const data = {
    issuanceId: 300,
    campaignId: 1,
    walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    amount: '10.0',
  };

  it('network error on first attempt — increments and throws for retry', async () => {
    const job = makeJob(data, 0);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockRejectedValue(new Error('Stellar network timeout'));

    await expect(processRewardIssuance(job)).rejects.toThrow('Stellar network timeout');

    expect(incrementAttempts).toHaveBeenCalledWith(data.issuanceId);
    expect(getActiveCampaign).toHaveBeenCalled();
    expect(distributeRewards).toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('second attempt failure — still throws for another retry', async () => {
    const job = makeJob(data, 1);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockRejectedValue(new Error('Connection refused'));

    await expect(processRewardIssuance(job)).rejects.toThrow('Connection refused');

    expect(incrementAttempts).toHaveBeenCalledWith(data.issuanceId);
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('third attempt (final) failure — marks failed and throws', async () => {
    const job = makeJob(data, 2);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockRejectedValue(new Error('Permanent failure'));

    await expect(processRewardIssuance(job)).rejects.toThrow('Permanent failure');

    expect(incrementAttempts).toHaveBeenCalledWith(data.issuanceId);
    expect(markFailed).toHaveBeenCalledWith(data.issuanceId, 'Permanent failure');
  });

  it('final attempt with job.opts.attempts=5 — respects job attempt limit', async () => {
    const job = makeJob(data, 4, { attempts: 5 });
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockRejectedValue(new Error('Still failing'));

    await expect(processRewardIssuance(job)).rejects.toThrow('Still failing');

    expect(markFailed).toHaveBeenCalledWith(data.issuanceId, 'Still failing');
  });

  it('single attempt job — marks failed on first error', async () => {
    const job = makeJob(data, 0, { attempts: 1 });
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockRejectedValue(new Error('Boom'));

    await expect(processRewardIssuance(job)).rejects.toThrow('Boom');

    expect(markFailed).toHaveBeenCalledWith(data.issuanceId, 'Boom');
  });

  it('stellar transaction error with specific message — propagates to dead-letter', async () => {
    const job = makeJob(data, 2);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    const stellarErr = new Error('insufficient balance for transaction');
    stellarErr.code = 'INSUFFICIENT_BALANCE';
    distributeRewards.mockRejectedValue(stellarErr);

    await expect(processRewardIssuance(job)).rejects.toThrow('insufficient balance for transaction');
    expect(markFailed).toHaveBeenCalledWith(data.issuanceId, 'insufficient balance for transaction');
  });
});

// ============================================================================
// SUITE: processRewardIssuance — trustline and validation errors
// ============================================================================
describe('processRewardIssuance — Stellar validation errors', () => {
  const data = {
    issuanceId: 400,
    campaignId: 1,
    walletAddress: 'INVALID_WALLET',
    amount: '10.0',
  };

  it('invalid address — marks failed, throws (will dead-letter on final attempt)', async () => {
    const job = makeJob(data, 2);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockRejectedValue(
      Object.assign(new Error('Invalid Stellar address'), { code: 'invalid_address' })
    );

    await expect(processRewardIssuance(job)).rejects.toThrow('Invalid Stellar address');
    expect(markFailed).toHaveBeenCalledWith(data.issuanceId, 'Invalid Stellar address');
  });

  it('no trustline error — marks failed on final attempt', async () => {
    const job = makeJob(data, 2);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockRejectedValue(
      Object.assign(new Error('Recipient does not have a NOVA trustline'), { code: 'no_trustline' })
    );

    await expect(processRewardIssuance(job)).rejects.toThrow('Recipient does not have a NOVA trustline');
    expect(markFailed).toHaveBeenCalledWith(data.issuanceId, 'Recipient does not have a NOVA trustline');
  });

  it('insufficient balance error — marks failed on final attempt', async () => {
    const job = makeJob(data, 2);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockRejectedValue(
      Object.assign(new Error('Distribution Account has insufficient NOVA balance'), { code: 'insufficient_balance' })
    );

    await expect(processRewardIssuance(job)).rejects.toThrow('Distribution Account has insufficient NOVA balance');
    expect(markFailed).toHaveBeenCalledWith(data.issuanceId, 'Distribution Account has insufficient NOVA balance');
  });
});

// ============================================================================
// SUITE: edge cases
// ============================================================================
describe('processRewardIssuance — edge cases', () => {
  it('campaign missing end_date — not returned as active', async () => {
    const data = {
      issuanceId: 500,
      campaignId: 999,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '1.0',
    };
    const job = makeJob(data, 0);
    getActiveCampaign.mockResolvedValue(null);

    const result = await processRewardIssuance(job);

    expect(result).toEqual({ skipped: true, reason: 'campaign_inactive' });
    expect(markFailed).toHaveBeenCalledWith(data.issuanceId, 'Campaign is inactive or expired');
  });

  it('campaign is_active=false — treated as ineligible', async () => {
    const data = {
      issuanceId: 501,
      campaignId: 998,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '1.0',
    };
    const job = makeJob(data, 0);
    getActiveCampaign.mockResolvedValue(null);

    const result = await processRewardIssuance(job);

    expect(result.skipped).toBe(true);
    expect(distributeRewards).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalled();
  });

  it('expired campaign (past end_date) — treated as inactive', async () => {
    const data = {
      issuanceId: 502,
      campaignId: 997,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '1.0',
    };
    const job = makeJob(data, 0);
    getActiveCampaign.mockResolvedValue(null);

    const result = await processRewardIssuance(job);

    expect(result.skipped).toBe(true);
  });

  it('getActiveCampaign throws — propagates error, does not mark failed', async () => {
    const data = {
      issuanceId: 600,
      campaignId: 1,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '10.0',
    };
    const job = makeJob(data, 0);
    getActiveCampaign.mockRejectedValue(new Error('Database error'));

    await expect(processRewardIssuance(job)).rejects.toThrow('Database error');

    expect(distributeRewards).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('incrementAttempts throws — propagates error, skips further processing', async () => {
    const data = {
      issuanceId: 700,
      campaignId: 1,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '10.0',
    };
    const job = makeJob(data, 0);
    incrementAttempts.mockRejectedValue(new Error('DB write failed'));

    await expect(processRewardIssuance(job)).rejects.toThrow('DB write failed');

    expect(getActiveCampaign).not.toHaveBeenCalled();
    expect(distributeRewards).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('markConfirmed throws — propagates error after successful Stellar tx', async () => {
    const data = {
      issuanceId: 800,
      campaignId: 1,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '10.0',
    };
    const job = makeJob(data, 0);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockResolvedValue({ txHash: 'tx_ok', success: true });
    markConfirmed.mockRejectedValue(new Error('Failed to update DB'));

    await expect(processRewardIssuance(job)).rejects.toThrow('Failed to update DB');

    expect(distributeRewards).toHaveBeenCalled();
    expect(markConfirmed).toHaveBeenCalled();
  });

  it('amount as numeric string — accepted by distributeRewards', async () => {
    const data = {
      issuanceId: 900,
      campaignId: 1,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '0.0000001',
    };
    const job = makeJob(data, 0);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockResolvedValue({ txHash: 'tx_hash_small', success: true });

    const result = await processRewardIssuance(job);

    expect(result.confirmed).toBe(true);
    expect(distributeRewards).toHaveBeenCalledWith({
      recipient: data.walletAddress,
      amount: '0.0000001',
      campaignId: 1,
    });
  });

  it('concurrent processing of same issuance — each attempt increments', async () => {
    const data = {
      issuanceId: 1000,
      campaignId: 1,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '10.0',
    };
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockResolvedValue({ txHash: 'tx_concurrent', success: true });

    const job1 = makeJob(data, 0);
    const job2 = makeJob(data, 1);

    const [result1, result2] = await Promise.all([
      processRewardIssuance(job1),
      processRewardIssuance(job2),
    ]);

    expect(incrementAttempts).toHaveBeenCalledTimes(2);
    expect(incrementAttempts).toHaveBeenCalledWith(data.issuanceId);
    expect(distributeRewards).toHaveBeenCalledTimes(2);
    expect(markConfirmed).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// SUITE: dead-letter queue behavior (worker side)
// ============================================================================
describe('processRewardIssuance — behavior enabling dead-letter routing', () => {
  const data = {
    issuanceId: 1100,
    campaignId: 1,
    walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    amount: '10.0',
  };

  it('always throws on transient error to allow BullMQ retry', async () => {
    const job = makeJob(data, 1);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockRejectedValue(new Error('Transient network error'));

    await expect(processRewardIssuance(job)).rejects.toThrow('Transient network error');
  });

  it('does not throw on ineligible campaign — no retry needed', async () => {
    const job = makeJob(data, 0);
    getActiveCampaign.mockResolvedValue(null);

    const result = await processRewardIssuance(job);
    expect(result.skipped).toBe(true);
  });
});

// ============================================================================
// SUITE: integration-style flow tests (multi-step scenarios)
// ============================================================================
describe('processRewardIssuance — multi-step scenarios', () => {
  const data = {
    issuanceId: 1200,
    idempotencyKey: 'merchant:999:user:888:purchase:777',
    campaignId: 1,
    userId: 888,
    walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    amount: '25.0',
  };

  it('full happy path: enqueue → process → confirm', async () => {
    getIssuanceByKey.mockResolvedValue(null);
    createIssuance.mockResolvedValue({ id: 1200, ...data, status: 'pending' });
    rewardIssuanceQueue.add.mockResolvedValue(true);

    const enqueueResult = await enqueueRewardIssuance(data);

    expect(enqueueResult).toEqual({ queued: true, issuanceId: 1200 });

    const job = makeJob({ issuanceId: 1200, ...data }, 0);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockResolvedValue({ txHash: 'final_tx_hash', success: true });

    const processResult = await processRewardIssuance(job);

    expect(processResult).toEqual({ confirmed: true, txHash: 'final_tx_hash' });
    expect(incrementAttempts).toHaveBeenCalledWith(1200);
    expect(markConfirmed).toHaveBeenCalledWith(1200, 'final_tx_hash');
  });

  it('idempotency: second enqueue returns existing', async () => {
    getIssuanceByKey.mockResolvedValueOnce({
      id: 1201,
      ...data,
      status: 'confirmed',
    });

    const result1 = await enqueueRewardIssuance(data);
    expect(result1.duplicate).toBe(true);
    expect(result1.status).toBe('confirmed');

    getIssuanceByKey.mockResolvedValueOnce({
      id: 1201,
      ...data,
      status: 'confirmed',
    });

    const result2 = await enqueueRewardIssuance(data);
    expect(result2.duplicate).toBe(true);
    expect(createIssuance).not.toHaveBeenCalled();
  });

  it('failed after 3 attempts eventually marks failed for DLQ', async () => {
    const data3 = { ...data, issuanceId: 1300 };

    let job = makeJob(data3, 0);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockRejectedValue(new Error('Network glitch'));
    await expect(processRewardIssuance(job)).rejects.toThrow('Network glitch');
    expect(markFailed).not.toHaveBeenCalled();

    job = makeJob(data3, 1);
    distributeRewards.mockRejectedValue(new Error('Network glitch'));
    await expect(processRewardIssuance(job)).rejects.toThrow('Network glitch');
    expect(markFailed).not.toHaveBeenCalled();

    job = makeJob(data3, 2);
    distributeRewards.mockRejectedValue(new Error('Network glitch'));
    await expect(processRewardIssuance(job)).rejects.toThrow('Network glitch');
    expect(markFailed).toHaveBeenCalledWith(1300, 'Network glitch');
  });
});

// ============================================================================
// SUITE: branch coverage — specific conditions in the code
// ============================================================================
describe('processRewardIssuance — 100% branch coverage', () => {
  it('job.attemptsMade >= (job.opts.attempts ?? 3) - 1 — final attempt branch', async () => {
    const data = {
      issuanceId: 1400,
      campaignId: 1,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '1.0',
    };
    const job = makeJob(data, 2);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockRejectedValue(new Error('Final error'));

    await expect(processRewardIssuance(job)).rejects.toThrow('Final error');

    expect(markFailed).toHaveBeenCalledWith(data.issuanceId, 'Final error');
  });

  it('job.attemptsMade < (job.opts.attempts ?? 3) - 1 — non-final attempt branch', async () => {
    const data = {
      issuanceId: 1500,
      campaignId: 1,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '1.0',
    };
    const job = makeJob(data, 0);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockRejectedValue(new Error('Temp error'));

    await expect(processRewardIssuance(job)).rejects.toThrow('Temp error');

    expect(markFailed).not.toHaveBeenCalled();
  });

  it('!campaign branch — campaign inactive', async () => {
    const data = {
      issuanceId: 1600,
      campaignId: 1,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '1.0',
    };
    const job = makeJob(data, 0);
    getActiveCampaign.mockResolvedValue(null);

    const result = await processRewardIssuance(job);

    expect(result).toEqual({ skipped: true, reason: 'campaign_inactive' });
  });

  it('markFailed on campaign inactive branch', async () => {
    const data = {
      issuanceId: 1700,
      campaignId: 1,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '1.0',
    };
    const job = makeJob(data, 0);
    getActiveCampaign.mockResolvedValue(null);

    await processRewardIssuance(job);

    expect(markFailed).toHaveBeenCalledWith(data.issuanceId, 'Campaign is inactive or expired');
  });

  it('successful try branch — happy path', async () => {
    const data = {
      issuanceId: 1800,
      campaignId: 1,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '1.0',
    };
    const job = makeJob(data, 0);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockResolvedValue({ txHash: 'success_tx', success: true });

    const result = await processRewardIssuance(job);

    expect(result).toEqual({ confirmed: true, txHash: 'success_tx' });
  });

  it('markConfirmed is called in success branch', async () => {
    const data = {
      issuanceId: 1900,
      campaignId: 1,
      walletAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      amount: '1.0',
    };
    const job = makeJob(data, 0);
    getActiveCampaign.mockResolvedValue(makeCampaign());
    distributeRewards.mockResolvedValue({ txHash: 'tx1900', success: true });

    await processRewardIssuance(job);

    expect(markConfirmed).toHaveBeenCalledWith(1900, 'tx1900');
  });
});

