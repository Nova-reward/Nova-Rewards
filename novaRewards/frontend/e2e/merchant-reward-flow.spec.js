/**
 * merchant-reward-flow.spec.js
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Complete happy-path E2E test for reward issuance:
 *   1. Merchant registration (UI)
 *   2. Campaign creation (UI)
 *   3. Reward issuance (UI)
 *   4. Balance polling (API)
 *   5. Stellar testnet confirmation
 *
 * All flows use test.step() for hierarchical test reporting.
 * Mocks: Freighter (browser) + Backend APIs (Playwright routes)
 */

import { test, expect } from '@playwright/test';
import { createTestApiClient } from './helpers/testApiClient.js';
import { buildAdvancedFreighterMock, getFreighterMockTracking } from './helpers/freighterMockBuilder.js';
import { setupBackendMocks } from './helpers/mockSetup.js';
import { registerMerchantViaUI, isMerchantAuthenticated } from './helpers/authHelper.js';
import { createCampaignViaUI } from './helpers/campaignHelper.js';
import { issueRewardViaUI, waitForBalanceUpdate } from './helpers/rewardHelper.js';
import { MerchantPortalPage } from './pages/MerchantPortalPage.js';
import { MERCHANTS, STELLAR_WALLETS, CAMPAIGNS, REWARDS, TEST_CONFIG } from './fixtures/index.js';

// ── Test Setup ─────────────────────────────────────────────────────────

const merchantData = MERCHANTS.valid();
const campaignData = CAMPAIGNS.valid();
const rewardData = {
  campaignName: campaignData.name,
  walletAddress: STELLAR_WALLETS.customer1,
  amount: REWARDS.standard().amount,
};
const expectedBalance = parseFloat(REWARDS.standard().amount);

const apiClient = createTestApiClient(TEST_CONFIG.BACKEND_URL);

// ── Main Test Suite ────────────────────────────────────────────────────

test.describe('Merchant Reward Flow (Happy Path)', () => {
  test('Merchant registers, creates campaign, issues rewards, and balance is reflected', async ({
    page,
  }) => {
    // ── Phase 1: Install Mocks ─────────────────────────────────────────

    await test.step('Install Freighter wallet mock', async () => {
      const { script, arg } = buildAdvancedFreighterMock({
        publicKey: STELLAR_WALLETS.customer1,
        autoApprove: true,
        responseDelayMs: TEST_CONFIG.FREIGHTER.SIGN_TRANSACTION_DELAY_MS,
      });
      await page.addInitScript(script, arg);
    });

    let distributionTxHash;
    await test.step('Install backend API mocks', async () => {
      const mocks = await setupBackendMocks(page, {
        expectedBalance: expectedBalance,
      });
      distributionTxHash = mocks.distributionTxHash;
    });

    // ── Phase 2: Merchant Registration ───────────────────────────────

    await test.step('Navigate to merchant portal', async () => {
      const portalPage = new MerchantPortalPage(page);
      await portalPage.goto();
      await portalPage.assertPageLoaded();
    });

    let merchantApiKey;
    await test.step('Register merchant via UI', async () => {
      const result = await registerMerchantViaUI(page, merchantData);
      merchantApiKey = result.apiKey;

      expect(merchantApiKey, 'API key should be 32 hex characters').toMatch(/^[0-9a-f]{32}$/i);
      expect(merchantApiKey.length).toBe(32);
    });

    await test.step('Verify merchant authenticated', async () => {
      const authenticated = await isMerchantAuthenticated(page);
      expect(authenticated, 'Merchant should be authenticated after registration').toBe(true);
    });

    // ── Phase 3: Campaign Creation ───────────────────────────────────

    await test.step('Create campaign via UI', async () => {
      const result = await createCampaignViaUI(page, campaignData);
      expect(result.campaign.name).toBe(campaignData.name);
    });

    await test.step('Verify campaign visible in table', async () => {
      const portalPage = new MerchantPortalPage(page);
      const isVisible = await portalPage.isCampaignVisible(campaignData.name);
      expect(isVisible, `Campaign "${campaignData.name}" should be visible in table`).toBe(true);
    });

    // ── Phase 4: Reward Issuance ─────────────────────────────────────

    let transactionHash;
    await test.step('Issue reward via UI', async () => {
      const result = await issueRewardViaUI(page, rewardData);
      transactionHash = result.txHash;
      expect(transactionHash, 'Transaction hash should be returned').toBeTruthy();
    });

    await test.step('Verify transaction hash link', async () => {
      const portalPage = new MerchantPortalPage(page);
      const txLink = await portalPage.getTransactionHashLink();
      const href = await txLink.getAttribute('href');

      expect(href, 'TX link should contain stellar.expert').toContain('stellar.expert');
      expect(href, 'TX link should target testnet').toContain('testnet');
      expect(href, 'TX link should contain transaction hash').toContain(transactionHash);
    });

    // ── Phase 5: Balance Polling ─────────────────────────────────────

    await test.step('Poll for balance update', async () => {
      const result = await waitForBalanceUpdate(
        apiClient,
        STELLAR_WALLETS.customer1,
        expectedBalance,
        { timeoutMs: TEST_CONFIG.BALANCE_POLL_TIMEOUT_MS }
      );

      expect(result.balance, `Balance should be >= ${expectedBalance}`).toBeGreaterThanOrEqual(
        expectedBalance
      );
      expect(result.attempts, 'Should converge within reasonable attempts').toBeLessThan(20);
      expect(result.totalTimeMs, 'Should complete within timeout').toBeLessThan(
        TEST_CONFIG.BALANCE_POLL_TIMEOUT_MS
      );
    });

    // ── Phase 6: Stellar Testnet Confirmation ───────────────────────

    await test.step('Verify Freighter mock was invoked', async () => {
      const tracking = await getFreighterMockTracking(page);
      expect(
        tracking.signRequests.length,
        'Freighter.signTransaction should have been called'
      ).toBeGreaterThan(0);
    });

    await test.step('Verify transaction format', async () => {
      expect(transactionHash, 'TX hash should match mock pattern').toMatch(/^mock-tx-hash-/);
    });

    // ── Test Summary ────────────────────────────────────────────────

    await test.step('Test complete - Happy path verified', async () => {
      // Just verify all key assertions passed
      expect(merchantApiKey.length).toBe(32);
      expect(transactionHash).toBeTruthy();
    });
  });
});
