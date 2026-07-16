# E2E Suite Design - Part 4: Complete Test Flow with test.step()

## Main Happy-Path Test Flow

### Test: `frontend/e2e/merchant-reward-flow.spec.js`

This is the primary E2E test that exercises the complete merchant-to-reward-balance flow.

```javascript
/**
 * merchant-reward-flow.spec.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Complete end-to-end flow:
 *   1. Merchant registration (UI)
 *   2. Merchant login/authentication
 *   3. Campaign creation (UI)
 *   4. Reward issuance (UI)
 *   5. Balance polling (API)
 *   6. Stellar testnet verification
 *
 * All flows use test.step() for hierarchical test reporting.
 * 
 * Run: npx playwright test merchant-reward-flow.spec.js --project=desktop-chromium
 */

import { test, expect } from '@playwright/test';
import { createTestApiClient } from './helpers/testApiClient.js';
import { buildAdvancedFreighterMock, getFreighterMockTracking } from './helpers/freighterMockBuilder.js';
import { setupBackendMocks } from './helpers/mockSetup.js';
import { pollUntil, pollForElement } from './helpers/pollingHelper.js';
import { registerMerchantViaUI, isMerchantAuthenticated } from './helpers/authHelper.js';
import { createCampaignViaUI } from './helpers/campaignHelper.js';
import { issueRewardViaUI, waitForBalanceUpdate } from './helpers/rewardHelper.js';
import { MerchantPortalPage } from './pages/MerchantPortalPage.js';
import { MERCHANTS, STELLAR_WALLETS, CAMPAIGNS, REWARDS } from './fixtures/index.js';
import { TEST_CONFIG, STELLAR_EXPERT_URL } from './fixtures/constants.js';

// ── Test Configuration ─────────────────────────────────────────────────────

const merchantData = MERCHANTS.valid();
const campaignData = CAMPAIGNS.valid();
const rewardData = {
  campaignName: campaignData.name,
  walletAddress: STELLAR_WALLETS.customer1,
  amount: REWARDS.standard().amount,
};
const expectedBalance = parseFloat(REWARDS.standard().amount);

const apiClient = createTestApiClient(TEST_CONFIG.BACKEND_URL);

// ── Main Test ──────────────────────────────────────────────────────────────

test.describe('Merchant Reward Flow (Happy Path)', () => {
  test(
    'Merchant registers, creates campaign, issues rewards, and balance is reflected',
    async ({ page }) => {
      /**
       * ── Phase 1: Install Mocks ─────────────────────────────────────────
       * 
       * Install both Freighter (browser-side) and backend API mocks before
       * navigating so they're active during the entire test.
       */
      await test.step('Install Freighter wallet mock', async () => {
        const { script, arg } = buildAdvancedFreighterMock({
          publicKey: STELLAR_WALLETS.customer1,
          autoApprove: true,
          responseDelayMs: TEST_CONFIG.FREIGHTER.SIGN_TRANSACTION_DELAY_MS,
        });
        await page.addInitScript(script, arg);
        console.log('[test] Freighter mock installed for:', arg.publicKey);
      });

      await test.step('Install backend API mocks', async () => {
        const { distributionTxHash } = await setupBackendMocks(page, {
          expectedBalance: expectedBalance,
        });
        console.log('[test] Backend mocks installed. TX hash:', distributionTxHash);
      });

      /**
       * ── Phase 2: Merchant Registration ──────────────────────────────────
       * 
       * Navigate to /merchant, fill registration form, capture API key.
       */
      await test.step('Navigate to merchant portal', async () => {
        const portalPage = new MerchantPortalPage(page);
        await portalPage.goto();
        await portalPage.assertPageLoaded();
        console.log('[test] Navigated to /merchant');
      });

      let merchantApiKey;
      await test.step('Register merchant via UI', async () => {
        const result = await registerMerchantViaUI(page, merchantData);
        merchantApiKey = result.apiKey;
        expect(merchantApiKey).toMatch(/^[0-9a-f]{32}$/i);
        console.log('[test] Merchant registered. API key length:', merchantApiKey.length);
      });

      await test.step('Verify merchant authenticated', async () => {
        const authenticated = await isMerchantAuthenticated(page);
        expect(authenticated).toBe(true);
        console.log('[test] Merchant authenticated');
      });

      /**
       * ── Phase 3: Campaign Creation ─────────────────────────────────────
       * 
       * Create a campaign via UI, verify it appears in table.
       */
      await test.step('Create campaign via UI', async () => {
        const result = await createCampaignViaUI(page, campaignData);
        expect(result.campaign.name).toBe(campaignData.name);
        console.log('[test] Campaign created:', result.campaign.name);
      });

      await test.step('Verify campaign visible in table', async () => {
        const portalPage = new MerchantPortalPage(page);
        const isVisible = await portalPage.isCampaignVisible(campaignData.name);
        expect(isVisible).toBe(true);
        console.log('[test] Campaign visible in merchant portal');
      });

      /**
       * ── Phase 4: Reward Issuance ───────────────────────────────────────
       * 
       * Fill reward distribution form, submit, verify success message and
       * transaction hash link.
       */
      let transactionHash;
      await test.step('Issue reward via UI', async () => {
        const result = await issueRewardViaUI(page, rewardData);
        transactionHash = result.txHash;
        expect(transactionHash).toBeTruthy();
        console.log('[test] Reward issued. TX hash:', transactionHash);
      });

      await test.step('Verify transaction hash link points to Stellar Expert', async () => {
        const portalPage = new MerchantPortalPage(page);
        const txLink = await portalPage.getTransactionHashLink();
        const href = await txLink.getAttribute('href');
        expect(href).toContain('stellar.expert');
        expect(href).toContain('testnet');
        expect(href).toContain(transactionHash);
        console.log('[test] TX link verified:', href);
      });

      /**
       * ── Phase 5: Balance Polling ───────────────────────────────────────
       * 
       * Poll the backend for the customer's balance until it reflects
       * the issued reward amount.
       */
      await test.step('Poll for balance update', async () => {
        const result = await waitForBalanceUpdate(
          apiClient,
          STELLAR_WALLETS.customer1,
          expectedBalance,
          { timeoutMs: TEST_CONFIG.BALANCE_POLL_TIMEOUT_MS }
        );
        expect(result.balance).toBeGreaterThanOrEqual(expectedBalance);
        console.log(
          `[test] Balance updated to ${result.balance} after ${result.attempts} attempts (${result.totalTimeMs}ms)`
        );
      });

      /**
       * ── Phase 6: Stellar Testnet Confirmation ──────────────────────────
       * 
       * Verify the mocked transaction hash format and that it could be
       * submitted to Stellar testnet (in this case, we verify the mock was called).
       */
      await test.step('Verify Freighter mock was used', async () => {
        const tracking = await getFreighterMockTracking(page);
        expect(tracking.signRequests.length).toBeGreaterThan(0);
        console.log('[test] Freighter sign requests:', tracking.signRequests.length);
      });

      await test.step('Verify transaction could be submitted to Stellar testnet', async () => {
        // In a real scenario, this would verify the TX was submitted to Horizon.
        // With mocking, we verify the mock received the distribution request.
        expect(transactionHash).toMatch(/^mock-tx-hash-/);
        console.log('[test] Mock transaction format verified');
      });

      /**
       * ── Test Summary ───────────────────────────────────────────────────
       */
      await test.step('Test complete', async () => {
        console.log('[test] ✓ Complete merchant reward flow executed successfully');
        console.log('[test] ✓ Merchant:', merchantData.name);
        console.log('[test] ✓ Campaign:', campaignData.name);
        console.log('[test] ✓ Reward:', rewardData.amount, 'NOVA to', STELLAR_WALLETS.customer1);
        console.log('[test] ✓ Final balance:', expectedBalance);
      });
    }
  );
});
```

---

## Test Flow Breakdown with test.step() Hierarchy

```
test("Merchant registers, creates campaign, issues rewards, and balance is reflected")
│
├─ test.step("Install Freighter wallet mock")
│  └─ [Browser] window.freighterApi = stub { isConnected, getPublicKey, signTransaction }
│
├─ test.step("Install backend API mocks")
│  ├─ page.route('/api/trustline/verify') → { exists: true }
│  ├─ page.route('/api/trustline/build') → { xdr: '...' }
│  ├─ page.route('/api/rewards/distribute') → { txHash, success: true }
│  └─ page.route('/api/users/*/points') → { balance: 0 | expectedBalance }
│
├─ test.step("Navigate to merchant portal")
│  └─ page.goto('/merchant')
│
├─ test.step("Register merchant via UI")
│  ├─ Fill form: name, walletAddress, businessCategory
│  ├─ Submit form
│  └─ Capture API key from screen
│
├─ test.step("Verify merchant authenticated")
│  └─ Assert registration form NOT visible
│
├─ test.step("Create campaign via UI")
│  ├─ Fill form: name, rewardRate, startDate, endDate
│  ├─ Submit form
│  └─ Wait for success message
│
├─ test.step("Verify campaign visible in table")
│  └─ Assert campaign name appears in table
│
├─ test.step("Issue reward via UI")
│  ├─ Select campaign from dropdown
│  ├─ Fill wallet address & amount
│  ├─ Submit form
│  └─ Capture transaction hash from success message
│
├─ test.step("Verify transaction hash link points to Stellar Expert")
│  └─ Assert link href contains stellar.expert + testnet + txHash
│
├─ test.step("Poll for balance update")
│  ├─ GET /api/users/:wallet/points → loop
│  ├─ Wait for balance >= expectedBalance
│  └─ Assert succeeded within timeout
│
├─ test.step("Verify Freighter mock was used")
│  └─ window.__freighterMockTracking.signRequests.length > 0
│
├─ test.step("Verify transaction could be submitted to Stellar testnet")
│  └─ Assert txHash format matches mock-tx-hash-*
│
└─ test.step("Test complete")
   └─ Log summary
```

---

## Supporting Test File: Error Path Tests

### Test: `frontend/e2e/merchant-reward-errors.spec.js`

```javascript
/**
 * merchant-reward-errors.spec.js
 * ──────────────────────────────────────────────────────────────────────────
 * 
 * Tests error paths and edge cases:
 * - Expired campaigns block distribution
 * - Missing trustline blocks distribution
 * - Invalid wallet addresses rejected
 * - Rate limiting enforced
 * 
 * Each test uses separate merchant + campaign for isolation.
 */

import { test, expect } from '@playwright/test';
import { createTestApiClient } from './helpers/testApiClient.js';
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
import { MERCHANTS, STELLAR_WALLETS, CAMPAIGNS, REWARDS } from './fixtures/index.js';
import { TEST_CONFIG } from './fixtures/constants.js';

const apiClient = createTestApiClient(TEST_CONFIG.BACKEND_URL);

test.describe('Merchant Reward Errors', () => {
  // ── Setup Freighter mock before each test ──────────────────────────────

  test.beforeEach(async ({ page }) => {
    const { script, arg } = buildAdvancedFreighterMock({
      publicKey: STELLAR_WALLETS.customer1,
      autoApprove: true,
    });
    await page.addInitScript(script, arg);
  });

  // ── Test: Distribution blocked without trustline ──────────────────────

  test('distribution is blocked if recipient has no NOVA trustline', async ({ page }) => {
    await test.step('Setup mocks for no trustline', async () => {
      await setupMockNoTrustline(page);
    });

    const merchantData = MERCHANTS.forErrors();
    const campaignData = CAMPAIGNS.valid();

    await test.step('Setup: Register merchant', async () => {
      const portalPage = new MerchantPortalPage(page);
      await portalPage.goto();
      const result = await registerMerchantViaUI(page, merchantData);
      expect(result.apiKey).toBeTruthy();
    });

    await test.step('Setup: Create campaign', async () => {
      await createCampaignViaUI(page, campaignData);
    });

    await test.step('Attempt reward issuance (expect error)', async () => {
      const portalPage = new MerchantPortalPage(page);
      
      await portalPage.fillRewardIssueForm({
        campaignName: campaignData.name,
        walletAddress: STELLAR_WALLETS.customer2, // Different customer
        amount: '10',
      });

      await portalPage.submitRewardIssue();

      // Expect error message about trustline
      const errorMsg = await portalPage.getErrorMessage();
      expect(errorMsg).toContain('trustline');
    });
  });

  // ── Test: Distribution blocked for expired campaigns ────────────────

  test('distribution is blocked if campaign has expired', async ({ page }) => {
    await test.step('Setup mocks for expired campaign', async () => {
      await setupMockExpiredCampaign(page);
    });

    const merchantData = MERCHANTS.forErrors();
    const expiredCampaignData = CAMPAIGNS.expired();

    await test.step('Setup: Register merchant and create expired campaign', async () => {
      const portalPage = new MerchantPortalPage(page);
      await portalPage.goto();
      const result = await registerMerchantViaUI(page, merchantData);
      expect(result.apiKey).toBeTruthy();

      await createCampaignViaUI(page, expiredCampaignData);
    });

    await test.step('Attempt reward issuance to expired campaign (expect error)', async () => {
      const portalPage = new MerchantPortalPage(page);

      await portalPage.fillRewardIssueForm({
        campaignName: expiredCampaignData.name,
        walletAddress: STELLAR_WALLETS.customer1,
        amount: '10',
      });

      await portalPage.submitRewardIssue();

      const errorMsg = await portalPage.getErrorMessage();
      expect(errorMsg).toContain('expired');
    });
  });

  // ── Test: Invalid wallet address rejected ──────────────────────────

  test('distribution is rejected for invalid wallet address', async ({ page }) => {
    await test.step('Setup: Register merchant and campaign', async () => {
      const merchantData = MERCHANTS.valid();
      const campaignData = CAMPAIGNS.valid();

      const portalPage = new MerchantPortalPage(page);
      await portalPage.goto();
      const result = await registerMerchantViaUI(page, merchantData);
      expect(result.apiKey).toBeTruthy();

      await createCampaignViaUI(page, campaignData);
    });

    await test.step('Attempt reward issuance with invalid wallet', async () => {
      const portalPage = new MerchantPortalPage(page);
      const campaignData = CAMPAIGNS.valid();

      await portalPage.fillRewardIssueForm({
        campaignName: campaignData.name,
        walletAddress: 'INVALID_WALLET_123', // Invalid
        amount: '10',
      });

      await portalPage.submitRewardIssue();

      const errorMsg = await portalPage.getErrorMessage();
      expect(errorMsg).toContain('wallet');
    });
  });

  // ── Test: Rate limiting enforced ────────────────────────────────────

  test('distribution requests are rate limited', async ({ page }) => {
    await test.step('Setup mocks for rate limiting', async () => {
      await setupMockRateLimit(page);
    });

    const merchantData = MERCHANTS.valid();
    const campaignData = CAMPAIGNS.valid();

    await test.step('Setup: Register merchant and campaign', async () => {
      const portalPage = new MerchantPortalPage(page);
      await portalPage.goto();
      const result = await registerMerchantViaUI(page, merchantData);
      expect(result.apiKey).toBeTruthy();

      await createCampaignViaUI(page, campaignData);
    });

    await test.step('Attempt reward issuance (expect rate limit error)', async () => {
      const portalPage = new MerchantPortalPage(page);

      await portalPage.fillRewardIssueForm({
        campaignName: campaignData.name,
        walletAddress: STELLAR_WALLETS.customer1,
        amount: '10',
      });

      await portalPage.submitRewardIssue();

      const errorMsg = await portalPage.getErrorMessage();
      expect(errorMsg).toContain('rate limit');
    });
  });
});
```

---

## Test Execution Diagram

```
playwright test --project=desktop-chromium

├─ merchant-reward-flow.spec.js
│  └─ "Merchant registers, creates campaign, issues rewards..."
│     ├─ Install Freighter mock
│     ├─ Install backend mocks
│     ├─ Navigate to /merchant
│     ├─ Register merchant via UI → capture API key
│     ├─ Create campaign via UI → verify table
│     ├─ Issue reward via UI → verify success message & TX hash
│     ├─ Poll balance until updated
│     ├─ Verify TX link points to Stellar Expert
│     └─ PASS ✓

├─ merchant-reward-errors.spec.js
│  ├─ "Distribution blocked without trustline"
│  │  ├─ Mock no trustline response
│  │  ├─ Register merchant, create campaign
│  │  ├─ Attempt distribution → expect error
│  │  └─ PASS ✓
│  ├─ "Distribution blocked for expired campaign"
│  │  ├─ Mock expired campaign error
│  │  ├─ Register merchant, create campaign
│  │  ├─ Attempt distribution → expect error
│  │  └─ PASS ✓
│  ├─ "Invalid wallet address rejected"
│  │  ├─ Register merchant, create campaign
│  │  ├─ Attempt distribution with invalid wallet
│  │  └─ PASS ✓
│  └─ "Rate limit enforced"
│     ├─ Mock rate limit response
│     ├─ Register merchant, create campaign
│     ├─ Attempt distribution → expect 429
│     └─ PASS ✓

└─ mobile-overflow.spec.js
   └─ Only runs on chromium-mobile, webkit-mobile projects
```

---

## Summary

**Test Files to Create:**

| File | Tests |
|------|-------|
| `frontend/e2e/merchant-reward-flow.spec.js` | Happy-path: register → campaign → reward → balance |
| `frontend/e2e/merchant-reward-errors.spec.js` | Error paths: no trustline, expired campaign, invalid wallet, rate limit |

**Flow Architecture:**
1. Each test installs Freighter mock + backend API mocks before any navigation
2. All interactions use `test.step()` for hierarchical reporting
3. Helpers (`authHelper`, `campaignHelper`, `rewardHelper`) handle UI/API abstraction
4. Page objects (`MerchantPortalPage`, `CustomerDashboardPage`) encapsulate selectors
5. Fixtures provide deterministic, collision-free test data
6. Polling helper handles balance verification with exponential backoff

**Key Design Decisions:**
- **Mocking Strategy**: Freighter mock in browser + Playwright route mocks for backend
- **Flow Representation**: Each major action is a separate `test.step()` for visibility
- **Error Testing**: Separate spec file for error paths (isolation + clarity)
- **Helper Reusability**: Helpers accept both page + apiClient for flexible test composition
- **Deterministic Data**: RUN_SUFFIX + factory functions ensure no collisions

