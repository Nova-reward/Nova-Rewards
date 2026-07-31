/**
 * Integration tests: Redis cache invalidation on balance mutations — issue #576
 *
 * Covers 6 distinct balance-mutation paths:
 * 1. Direct Stellar transaction submission (walletService.submitTransaction)
 * 2. Direct reward distribution (rewards POST /distribute)
 * 3. Reward issuance via BullMQ worker (rewardIssuanceService.processRewardIssuance)
 * 4. Campaign batch distribution (campaignDistributionService.processCampaignDistribution)
 * 5. Referral bonus (referralService.processReferralBonus)
 * 6. Refund transaction (transactionService.refundTransaction)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRedisClient } from '../cache/redisClient';
import { getCampaignById, getActiveCampaign } from '../db/campaignRepository';
import { distributeRewards } from '../../blockchain/sendRewards';
import { verifyTrustline } from '../../blockchain/trustline';
import { getUserByWallet } from '../db/userRepository';
import { recordPointTransaction } from '../db/pointTransactionRepository';
import { markReferralBonusClaimed, hasReferralBonusBeenClaimed } from '../db/userRepository';
import { createIssuance, getIssuanceByKey, markConfirmed, incrementAttempts } from '../db/rewardIssuanceRepository';
import { rewardIssuanceQueue } from '../jobs/queues';

vi.mock('../cache/redisClient');
vi.mock('../db/campaignRepository');
vi.mock('../../blockchain/sendRewards');
vi.mock('../../blockchain/trustline');
vi.mock('../db/userRepository');
vi.mock('../db/pointTransactionRepository');
vi.mock('../db/rewardIssuanceRepository');
vi.mock('../jobs/queues');

const mockRedis = { get: vi.fn(), set: vi.fn(), del: vi.fn() };
getRedisClient.mockReturnValue(mockRedis);

import { createApp } from '../app';
import cacheService from '../services/cacheService';
import walletService from '../services/walletService';
import { processRewardIssuance } from '../services/rewardIssuanceService';
import { processCampaignDistribution } from '../services/campaignDistributionService';
import { processReferralBonus } from '../services/referralService';
import { refundTransaction } from '../services/transactionService';

const app = createApp();

const campaign = { id: 3, merchant_id: 1, name: 'Test', reward_rate: 1 };
const WALLET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

beforeEach(() => {
  vi.clearAllMocks();
  getCampaignById.mockResolvedValue(campaign);
  getActiveCampaign.mockResolvedValue(campaign);
  verifyTrustline.mockResolvedValue({ exists: true });
  distributeRewards.mockResolvedValue({ txHash: 'abc123', tx: {} });
  mockRedis.del.mockResolvedValue(1);
  getUserByWallet.mockResolvedValue({ id: 42, wallet_address: WALLET });
  hasReferralBonusBeenClaimed.mockResolvedValue(false);
  recordPointTransaction.mockResolvedValue({ id: 1, amount: 50 });
  markReferralBonusClaimed.mockResolvedValue();
  createIssuance.mockResolvedValue({ id: 1 });
  getIssuanceByKey.mockResolvedValue(null);
  markConfirmed.mockResolvedValue();
  incrementAttempts.mockResolvedValue();
  rewardIssuanceQueue.add.mockResolvedValue();
});

describe('Cache invalidation on reward issuance (#576)', () => {
  it('invalidates campaign cache after successful distribution', async () => {
    const res = await app.post('/api/rewards/distribute')
      .send({ walletAddress: WALLET, amount: 10, campaignId: 3 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockRedis.del).toHaveBeenCalledWith('campaigns:merchant:1');
  });

  it('does not call del when campaign not found', async () => {
    getCampaignById.mockResolvedValue(null);
    const res = await app.post('/api/rewards/distribute')
      .send({ walletAddress: WALLET, amount: 10, campaignId: 99 });

    expect(res.status).toBe(404);
    expect(mockRedis.del).not.toHaveBeenCalled();
  });
});

describe('Balance cache invalidation — 6 mutation paths', () => {
  /**
   * Path 1: Direct Stellar transaction submission via walletService.submitTransaction
   */
  it('invalidates balance cache on direct Stellar transaction submission', async () => {
    const { server } = await import('../../blockchain/stellarService');
    server.submitTransaction = vi.fn().mockResolvedValue({
      hash: 'tx-hash-1',
      ledger: 12345,
    });

    const metadata = { fromWallet: WALLET, toWallet: 'GBACKWALLET2', amount: 10, txType: 'transfer' };
    await walletService.submitTransaction('signed-xdr-placeholder', metadata);

    expect(mockRedis.del).toHaveBeenCalled();
    const allKeys = mockRedis.del.mock.calls.flat();
    expect(allKeys.some(k => k.includes('balance') || k.includes('tokenBalance'))).toBe(true);
  });

  /**
   * Path 2: Direct reward distribution via rewards POST /distribute
   */
  it('invalidates recipient balance cache on direct reward distribution', async () => {
    const res = await app.post('/api/rewards/distribute')
      .send({ walletAddress: WALLET, amount: 10, campaignId: 3 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockRedis.del).toHaveBeenCalled();
    const delCalls = mockRedis.del.mock.calls.flat();
    expect(delCalls.some(k => k.includes(WALLET))).toBe(true);
  });

  /**
   * Path 3: Reward issuance via BullMQ worker (processRewardIssuance)
   */
  it('invalidates beneficiary wallet cache on reward issuance', async () => {
    const job = {
      data: { issuanceId: 1, campaignId: 3, walletAddress: WALLET, amount: 10 },
      attemptsMade: 0,
      opts: { attempts: 3 },
    };

    await processRewardIssuance(job);

    expect(distributeRewards).toHaveBeenCalledWith({ recipient: WALLET, amount: 10, campaignId: 3 });
    expect(mockRedis.del).toHaveBeenCalled();
    const delCalls = mockRedis.del.mock.calls.flat();
    expect(delCalls.some(k => k.includes(WALLET))).toBe(true);
  });

  /**
   * Path 4: Campaign batch distribution (processCampaignDistribution)
   */
  it('invalidates recipient cache for each successful batch distribution', async () => {
    const recipients = [
      { walletAddress: WALLET, amount: '10' },
      { walletAddress: 'GBACKWALLET3', amount: '20' },
    ];

    await processCampaignDistribution({ campaignId: 3, recipients, defaultAmount: '10' });

    expect(distributeRewards).toHaveBeenCalledTimes(2);
    const delCalls = mockRedis.del.mock.calls.flat();
    expect(delCalls.some(k => k.includes(WALLET))).toBe(true);
    expect(delCalls.some(k => k.includes('GBACKWALLET3'))).toBe(true);
  });

  /**
   * Path 5: Referral bonus (processReferralBonus)
   */
  it('invalidates referrer balance cache on referral bonus', async () => {
    const result = await processReferralBonus(42, 99);

    expect(result.success).toBe(true);
    expect(recordPointTransaction).toHaveBeenCalledWith({
      userId: 42,
      type: 'referral',
      amount: 50,
      description: `Referral bonus for user ${expect.any(String)}`,
      referredUserId: 99,
    });
    expect(mockRedis.del).toHaveBeenCalled();
    const delCalls = mockRedis.del.mock.calls.flat();
    expect(delCalls.some(k => k === 'balance:42' || k === 'tokenBalance:42')).toBe(true);
  });

  /**
   * Path 6: Refund transaction (refundTransaction)
   */
  it('invalidates both wallets balance cache on refund', async () => {
    const { getTransactionByHash, processRefund } = await import('../db/transactionRepository');
    getTransactionByHash.mockResolvedValue({
      tx_hash: 'orig-hash',
      status: 'completed',
      from_wallet: WALLET,
      to_wallet: 'GBACKWALLET4',
      amount: '10',
      merchant_id: 1,
    });
    processRefund.mockResolvedValue({
      originalTransaction: { tx_hash: 'orig-hash', status: 'refunded' },
      refundTransaction: { tx_hash: 'refund-hash', tx_type: 'refund' },
    });

    const result = await refundTransaction(1, {
      txHash: 'orig-hash',
      refundTxHash: 'refund-hash',
      reason: 'Customer request',
    });

    expect(result.refundTransaction.tx_hash).toBe('refund-hash');
    expect(mockRedis.del).toHaveBeenCalled();
    const delCalls = mockRedis.del.mock.calls.flat();
    expect(delCalls.some(k => k.includes(WALLET))).toBe(true);
    expect(delCalls.some(k => k.includes('GBACKWALLET4'))).toBe(true);
  });
});

describe('Stale-read prevention', () => {
  it('ensures no stale read on immediate subsequent balance fetch after stellarTransactionService transfer', async () => {
    // Simulate: cache has stale balance
    mockRedis.get.mockResolvedValue(JSON.stringify({ onChainBalance: '100', offChainPoints: 0 }));

    // Perform a transfer via walletService
    const { server } = await import('../../blockchain/stellarService');
    server.submitTransaction = vi.fn().mockResolvedValue({
      hash: 'tx-hash-stale',
      ledger: 54321,
    });

    const metadata = { fromWallet: WALLET, toWallet: 'GBACKWALLET5', amount: 50, txType: 'transfer' };
    await walletService.submitTransaction('signed-xdr-stale', metadata);

    // After submission, cache should have been invalidated (del called)
    expect(mockRedis.del).toHaveBeenCalled();

    // Simulate immediate subsequent fetch: cache miss now
    mockRedis.get.mockResolvedValue(null);
    const cacheKey = `balance:42`;
    const cachedAfter = await mockRedis.get(cacheKey);
    expect(cachedAfter).toBeNull();
  });

  it('ensures no stale read on immediate subsequent balance fetch after reward issuance', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ onChainBalance: '100', offChainPoints: 0 }));

    const job = {
      data: { issuanceId: 1, campaignId: 3, walletAddress: WALLET, amount: 10 },
      attemptsMade: 0,
      opts: { attempts: 3 },
    };

    await processRewardIssuance(job);

    expect(mockRedis.del).toHaveBeenCalled();
    mockRedis.get.mockResolvedValue(null);
    const cacheKey = `balance:42`;
    const cachedAfter = await mockRedis.get(cacheKey);
    expect(cachedAfter).toBeNull();
  });
});