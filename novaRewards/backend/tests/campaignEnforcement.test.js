'use strict';
/**
 * Tests for campaign end-date and budget-cap enforcement in
 * campaignDistributionService.js
 */

const {
  assertCampaignEligible,
  CampaignEnforcementError,
  processCampaignDistribution,
} = require('../services/campaignDistributionService');

// Mock sendRewards so no real Stellar calls happen
jest.mock('../../blockchain/sendRewards', () => ({
  distributeRewards: jest.fn().mockResolvedValue({ txHash: 'mock-tx-hash' }),
}));

describe('assertCampaignEligible', () => {
  const baseCampaign = {
    id: 1,
    status: 'active',
    end_date: null,
    budget_cap: 1000,
    total_issued: 0,
    token_amount: 1000,
    tokens_issued: 0,
  };

  test('passes for a valid active campaign with no end_date', () => {
    expect(() => assertCampaignEligible(baseCampaign)).not.toThrow();
  });

  test('passes for a campaign whose end_date is in the future', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(() =>
      assertCampaignEligible({ ...baseCampaign, end_date: future.toISOString() })
    ).not.toThrow();
  });

  test('throws CAMPAIGN_EXPIRED when end_date is in the past', () => {
    const past = new Date('2020-01-01T00:00:00Z');
    expect(() =>
      assertCampaignEligible({ ...baseCampaign, end_date: past.toISOString() })
    ).toThrow(CampaignEnforcementError);

    try {
      assertCampaignEligible({ ...baseCampaign, end_date: past.toISOString() });
    } catch (err) {
      expect(err.code).toBe('CAMPAIGN_EXPIRED');
      expect(err.statusCode).toBe(422);
    }
  });

  test('throws CAMPAIGN_EXPIRED even one second past end_date', () => {
    const now = new Date();
    const justPast = new Date(now.getTime() - 1000);
    expect(() =>
      assertCampaignEligible({ ...baseCampaign, end_date: justPast.toISOString() })
    ).toThrow(CampaignEnforcementError);
  });

  test('throws CAMPAIGN_BUDGET_EXHAUSTED when total_issued equals budget_cap', () => {
    expect(() =>
      assertCampaignEligible({ ...baseCampaign, total_issued: 1000, budget_cap: 1000 })
    ).toThrow(CampaignEnforcementError);

    try {
      assertCampaignEligible({ ...baseCampaign, total_issued: 1000, budget_cap: 1000 });
    } catch (err) {
      expect(err.code).toBe('CAMPAIGN_BUDGET_EXHAUSTED');
    }
  });

  test('throws CAMPAIGN_BUDGET_EXHAUSTED when total_issued exceeds budget_cap', () => {
    expect(() =>
      assertCampaignEligible({ ...baseCampaign, total_issued: 1500, budget_cap: 1000 })
    ).toThrow(CampaignEnforcementError);
  });

  test('passes when total_issued is below budget_cap', () => {
    expect(() =>
      assertCampaignEligible({ ...baseCampaign, total_issued: 500, budget_cap: 1000 })
    ).not.toThrow();
  });

  test('throws CAMPAIGN_INACTIVE when status is not active', () => {
    expect(() =>
      assertCampaignEligible({ ...baseCampaign, status: 'inactive' })
    ).toThrow(CampaignEnforcementError);

    try {
      assertCampaignEligible({ ...baseCampaign, status: 'inactive' });
    } catch (err) {
      expect(err.code).toBe('CAMPAIGN_INACTIVE');
    }
  });

  test('throws CAMPAIGN_NOT_FOUND for null campaign', () => {
    expect(() => assertCampaignEligible(null)).toThrow(CampaignEnforcementError);
    try {
      assertCampaignEligible(null);
    } catch (err) {
      expect(err.code).toBe('CAMPAIGN_NOT_FOUND');
    }
  });

  test('accepts custom "now" override for deterministic testing', () => {
    // end_date in the past relative to real now, but future relative to fake now
    const endDate = new Date('2025-06-01T00:00:00Z');
    const fakeNow = new Date('2025-01-01T00:00:00Z');

    expect(() =>
      assertCampaignEligible(
        { ...baseCampaign, end_date: endDate.toISOString() },
        { now: fakeNow }
      )
    ).not.toThrow();
  });

  test('skips budget check when budget_cap is 0 (unlimited)', () => {
    // budget_cap 0 means no cap
    expect(() =>
      assertCampaignEligible({ ...baseCampaign, budget_cap: 0, total_issued: 999999 })
    ).not.toThrow();
  });
});

describe('processCampaignDistribution with campaign enforcement', () => {
  const { distributeRewards } = require('../../blockchain/sendRewards');

  beforeEach(() => {
    distributeRewards.mockClear();
    distributeRewards.mockResolvedValue({ txHash: 'mock-tx-hash' });
  });

  test('rejects distribution for expired campaign before any transfers', async () => {
    const expiredCampaign = {
      id: 99,
      status: 'active',
      end_date: new Date('2020-01-01').toISOString(),
      budget_cap: 1000,
      total_issued: 0,
    };

    await expect(
      processCampaignDistribution({
        campaignId: 99,
        recipients: [{ walletAddress: 'GTEST123', amount: '10' }],
        campaign: expiredCampaign,
      })
    ).rejects.toThrow(CampaignEnforcementError);

    // distributeRewards should NEVER be called for an expired campaign
    expect(distributeRewards).not.toHaveBeenCalled();
  });

  test('rejects distribution when budget exhausted before any transfers', async () => {
    const exhaustedCampaign = {
      id: 88,
      status: 'active',
      end_date: null,
      budget_cap: 500,
      total_issued: 500,
    };

    await expect(
      processCampaignDistribution({
        campaignId: 88,
        recipients: [{ walletAddress: 'GTEST456', amount: '10' }],
        campaign: exhaustedCampaign,
      })
    ).rejects.toThrow(CampaignEnforcementError);

    expect(distributeRewards).not.toHaveBeenCalled();
  });

  test('proceeds and calls distributeRewards for a valid campaign', async () => {
    const validCampaign = {
      id: 1,
      status: 'active',
      end_date: null,
      budget_cap: 0,
      total_issued: 0,
    };

    const result = await processCampaignDistribution({
      campaignId: 1,
      recipients: [{ walletAddress: 'GTEST789', amount: '50' }],
      campaign: validCampaign,
    });

    expect(distributeRewards).toHaveBeenCalledTimes(1);
    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
  });
});
