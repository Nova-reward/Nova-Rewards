/**
 * merchant-reward-errors.spec.js
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Error path tests for reward distribution:
 *   - Distribution blocked without trustline
 *   - Distribution blocked for expired campaigns
 *   - Invalid wallet address rejected
 *   - Rate limiting enforced
 *
 * Each test is isolated with separate merchant + campaign.
 */

import { test, expect } from '@playwright/test';
import { buildAdvancedFreighterMock } from './helpers/freighterMockBuilder.js';
import {
  setupBackendMocks,
  setupMockNoTrustline,
  setupMockExpiredCampaign,
  setupMockRateLimit,
} from './helpers/mockSetup.js';
import { registerMerchantViaUI } from './helpers/authHelper.js';
import { createCampaignViaUI } from './helpers/campaignHelper.js';
import { issueRewardViaUI } from './helpers/rewardHelper.js';
import { MerchantPortalPage } from './pages/MerchantPortalPage.js';
import { MERCHANTS, STELLAR_WALLETS, CAMPAIGNS, REWARDS, TEST_CONFIG } from './fixtures/index.js';

// ── Setup: Install Freighter mock before each test ────────────────

test.beforeEach(async ({ page }) => {
  const { script, arg } = buildAdvancedFreighterMock({
    publicKey: STELLAR_WALLETS.customer1,
    autoApprove: true,
  });
  await page.addInitScript(script, arg);
});

// ── Test Suite ──────────────────────────────────────────────────────

test.describe('Merchant Reward Errors', () => {
  // ── Test 1: Distribution blocked without trustline ────────────────

  test('distribution is blocked if recipient has no NOVA trustline', async ({ page }) => {
    const merchantData = MERCHANTS.forErrors();
    const campaignData = CAMPAIGNS.valid();

    await test.step('Setup mock: no trustline', async () => {
      await setupMockNoTrustline(page);
    });

    let merchantApiKey;
    await test.step('Register merchant', async () => {
      const portalPage = new MerchantPortalPage(page);
      await portalPage.goto();
      const result = await registerMerchantViaUI(page, merchantData);
      merchantApiKey = result.apiKey;
      expect(merchantApiKey).toBeTruthy();
    });

    await test.step('Create campaign', async () => {
      await createCampaignViaUI(page, campaignData);
    });

    await test.step('Attempt reward issuance - expect error', async () => {
      const portalPage = new MerchantPortalPage(page);

      await portalPage.fillRewardIssueForm({
        campaignName: campaignData.name,
        walletAddress: STELLAR_WALLETS.customer2,
        amount: '10',
      });

      await portalPage.submitRewardIssue();

      const errorMsg = await portalPage.getErrorMessage();
      expect(errorMsg, 'Should show trustline error').toContain('trustline');
    });
  });

  // ── Test 2: Distribution blocked for expired campaigns ───────────

  test('distribution is blocked if campaign has expired', async ({ page }) => {
    const merchantData = MERCHANTS.forErrors();
    const expiredCampaignData = CAMPAIGNS.expired();

    await test.step('Setup mock: expired campaign', async () => {
      await setupMockExpiredCampaign(page);
    });

    let merchantApiKey;
    await test.step('Register merchant', async () => {
      const portalPage = new MerchantPortalPage(page);
      await portalPage.goto();
      const result = await registerMerchantViaUI(page, merchantData);
      merchantApiKey = result.apiKey;
      expect(merchantApiKey).toBeTruthy();
    });

    await test.step('Create expired campaign', async () => {
      await createCampaignViaUI(page, expiredCampaignData);
    });

    await test.step('Attempt reward issuance - expect error', async () => {
      const portalPage = new MerchantPortalPage(page);

      await portalPage.fillRewardIssueForm({
        campaignName: expiredCampaignData.name,
        walletAddress: STELLAR_WALLETS.customer1,
        amount: '10',
      });

      await portalPage.submitRewardIssue();

      const errorMsg = await portalPage.getErrorMessage();
      expect(errorMsg, 'Should show expired campaign error').toContain('expired');
    });
  });

  // ── Test 3: Invalid wallet address rejected ──────────────────────

  test('distribution is rejected for invalid wallet address', async ({ page }) => {
    const merchantData = MERCHANTS.valid();
    const campaignData = CAMPAIGNS.valid();

    await test.step('Setup standard mocks', async () => {
      await setupBackendMocks(page, { expectedBalance: 10 });
    });

    await test.step('Register merchant', async () => {
      const portalPage = new MerchantPortalPage(page);
      await portalPage.goto();
      const result = await registerMerchantViaUI(page, merchantData);
      expect(result.apiKey).toBeTruthy();
    });

    await test.step('Create campaign', async () => {
      await createCampaignViaUI(page, campaignData);
    });

    await test.step('Attempt reward issuance with invalid wallet', async () => {
      const portalPage = new MerchantPortalPage(page);

      await portalPage.fillRewardIssueForm({
        campaignName: campaignData.name,
        walletAddress: 'INVALID_WALLET_123',
        amount: '10',
      });

      await portalPage.submitRewardIssue();

      const errorMsg = await portalPage.getErrorMessage();
      expect(errorMsg, 'Should show wallet validation error').toContain('wallet');
    });
  });

  // ── Test 4: Rate limiting enforced ──────────────────────────────

  test('distribution requests are rate limited', async ({ page }) => {
    const merchantData = MERCHANTS.valid();
    const campaignData = CAMPAIGNS.valid();

    await test.step('Setup mock: rate limit', async () => {
      await setupMockRateLimit(page);
    });

    await test.step('Register merchant', async () => {
      const portalPage = new MerchantPortalPage(page);
      await portalPage.goto();
      const result = await registerMerchantViaUI(page, merchantData);
      expect(result.apiKey).toBeTruthy();
    });

    await test.step('Create campaign', async () => {
      await createCampaignViaUI(page, campaignData);
    });

    await test.step('Attempt reward issuance - expect rate limit error', async () => {
      const portalPage = new MerchantPortalPage(page);

      await portalPage.fillRewardIssueForm({
        campaignName: campaignData.name,
        walletAddress: STELLAR_WALLETS.customer1,
        amount: '10',
      });

      await portalPage.submitRewardIssue();

      const errorMsg = await portalPage.getErrorMessage();
      expect(errorMsg, 'Should show rate limit error').toContain('rate limit');
    });
  });
});
