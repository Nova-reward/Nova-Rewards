# E2E Suite Design - Part 3: Page Objects & Reusable Login/Merchant/Campaign Helpers

## Page Object Models

### 1. Merchant Portal Page Object (`frontend/e2e/pages/MerchantPortalPage.js`)

```javascript
/**
 * MerchantPortalPage.js — Page object for /merchant route.
 * 
 * Encapsulates merchant registration, campaign management, and reward issuance UI.
 */

export class MerchantPortalPage {
  constructor(page) {
    this.page = page;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/merchant');
    await this.page.waitForLoadState('networkidle');
  }

  async assertPageLoaded() {
    await this.page.waitForSelector('h1:has-text("Merchant Portal")');
  }

  // ── Merchant Registration Form ─────────────────────────────────────────────

  async fillMerchantRegistration({ name, walletAddress, businessCategory }) {
    await this.page.getByLabel('Business Name').fill(name);
    await this.page.getByLabel('Stellar Wallet Address').fill(walletAddress);
    if (businessCategory) {
      await this.page.getByLabel('Business Category (optional)').fill(businessCategory);
    }
  }

  async submitMerchantRegistration() {
    await this.page.getByRole('button', { name: /Register/i }).click();
  }

  async waitForApiKeyDisplay(timeoutMs = 10_000) {
    // API key is displayed as a <span> with hex pattern
    const locator = this.page.locator('span', { hasText: /[0-9a-f]{32}/i });
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    return locator.textContent();
  }

  async getDisplayedMerchantName() {
    return this.page.locator('.merchant-name, [data-testid="merchant-name"]').textContent();
  }

  async isMerchantRegistrationFormVisible() {
    return this.page.locator('h2:has-text("Register as a Merchant")').isVisible();
  }

  // ── Campaign Form ──────────────────────────────────────────────────────────

  async fillCampaignForm({ name, rewardRate, startDate, endDate }) {
    await this.page.getByLabel('Campaign Name').fill(name);
    await this.page.getByLabel(/Reward Rate/i).fill(rewardRate);

    const dateInputs = this.page.locator('input[type="date"]');
    await dateInputs.nth(0).fill(startDate); // start_date
    await dateInputs.nth(1).fill(endDate);   // end_date
  }

  async submitCampaignCreation() {
    await this.page.getByRole('button', { name: /Create Campaign/i }).click();
  }

  async waitForCampaignSuccessMessage(timeoutMs = 10_000) {
    await this.page.waitForSelector(
      'text=Campaign created successfully',
      { timeout: timeoutMs }
    );
  }

  async getCampaignTableRows() {
    // Assumes campaigns are displayed in a table/list
    return this.page.locator('tbody tr, [role="list"] > li').all();
  }

  async findCampaignInTable(campaignName) {
    return this.page.locator(`text=${campaignName}`).first();
  }

  async isCampaignVisible(campaignName) {
    const element = await this.findCampaignInTable(campaignName);
    return element.isVisible();
  }

  // ── Issue Reward Form ──────────────────────────────────────────────────────

  async selectCampaignFromDropdown(campaignName) {
    await this.page.getByLabel('Campaign').selectOption({ label: new RegExp(campaignName) });
  }

  async fillRewardIssueForm({ campaignName, walletAddress, amount }) {
    await this.selectCampaignFromDropdown(campaignName);
    await this.page.getByLabel('Customer Wallet Address').fill(walletAddress);
    await this.page.getByLabel('Amount (NOVA)').fill(amount);
  }

  async submitRewardIssue() {
    await this.page.getByRole('button', { name: /Issue Rewards/i }).click();
  }

  async waitForRewardSuccessMessage(timeoutMs = 15_000) {
    await this.page.waitForSelector(
      'text=Rewards issued successfully',
      { timeout: timeoutMs }
    );
  }

  async getTransactionHashLink() {
    // Looks for a link containing the tx hash
    return this.page.locator('a[href*="stellar.expert"]').first();
  }

  // ── Dashboard Stats ───────────────────────────────────────────────────────

  async getTotalDistributed() {
    const text = await this.page.locator('text=Total Distributed').locator('..').textContent();
    return parseFloat(text.match(/[\d.]+/)[0]);
  }

  async getTotalRedeemed() {
    const text = await this.page.locator('text=Total Redeemed').locator('..').textContent();
    return parseFloat(text.match(/[\d.]+/)[0]);
  }

  // ── Error Handling ────────────────────────────────────────────────────────

  async getErrorMessage() {
    const error = this.page.locator('.error, [role="alert"]').first();
    return error.isVisible() ? error.textContent() : null;
  }

  async assertErrorContains(pattern) {
    const message = await this.getErrorMessage();
    if (!pattern.test(message)) {
      throw new Error(`Expected error matching ${pattern}, got: ${message}`);
    }
  }
}
```

### 2. Customer Dashboard Page Object (`frontend/e2e/pages/CustomerDashboardPage.js`)

```javascript
/**
 * CustomerDashboardPage.js — Page object for /dashboard route (customer view).
 */

export class CustomerDashboardPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  // ── Wallet Connection ──────────────────────────────────────────────────────

  async connectWallet() {
    await this.page.getByRole('button', { name: /Connect Wallet|Connect Freighter/i }).click();
  }

  async assertWalletConnected(walletAddress) {
    // Displays shortened wallet address
    const shortAddr = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
    await this.page.waitForSelector(`text=${shortAddr}`);
  }

  // ── Points Display ────────────────────────────────────────────────────────

  async getPointsBalance() {
    const text = await this.page.locator('[data-testid="points-balance"], .points-widget').textContent();
    return parseFloat(text.match(/[\d.]+/)[0]);
  }

  async waitForPointsUpdate(expectedAmount, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const balance = await this.getPointsBalance();
      if (balance >= expectedAmount) return balance;
      await this.page.waitForTimeout(500);
    }
    throw new Error(`Points did not update to ${expectedAmount} within ${timeoutMs}ms`);
  }

  // ── Trustline Setup ───────────────────────────────────────────────────────

  async clickSetupTrustline() {
    await this.page.getByRole('button', { name: /Setup Trustline|Add Trustline/i }).click();
  }

  async waitForTrustlineSetupModal() {
    await this.page.waitForSelector('[role="dialog"], .modal');
  }

  async signTrustlineTransaction() {
    // "Confirm" button in the modal that triggers Freighter signing
    await this.page.getByRole('button', { name: /Confirm|Sign/i }).click();
  }

  async waitForTrustlineSuccess(timeoutMs = 10_000) {
    await this.page.waitForSelector(
      'text=Trustline created successfully',
      { timeout: timeoutMs }
    );
  }

  // ── Transaction History ─────────────────────────────────────────────────────

  async getTransactionHistoryRows() {
    return this.page.locator('tbody tr, [role="list"] > li').all();
  }

  async findTransactionInHistory(walletAddress, amount) {
    const pattern = new RegExp(`${walletAddress}.*${amount}`);
    return this.page.locator(`text=${pattern}`).first();
  }
}
```

---

## Reusable Login/Auth Helpers

### 3. Authentication Helper (`frontend/e2e/helpers/authHelper.js`)

```javascript
/**
 * authHelper.js — Reusable authentication flows (user login, merchant registration).
 * 
 * Handles both UI-based and API-based auth for maximum flexibility.
 */

import { test } from '@playwright/test';
import { MerchantPortalPage } from '../pages/MerchantPortalPage.js';

/**
 * User registration via API (preferred for speed in test setup).
 * 
 * @param {ApiClient} apiClient
 * @param {object} userData
 * @returns {Promise<{ user, accessToken, refreshToken }>}
 */
export async function registerUserViaAPI(apiClient, userData) {
  return test.step('User registration via API', async () => {
    const user = await apiClient.registerUser(userData);
    console.log('[authHelper] User registered:', user.user.email);
    return user;
  });
}

/**
 * User login via API (preferred for speed).
 * 
 * @param {ApiClient} apiClient
 * @param {object} credentials — { email, password }
 * @returns {Promise<{ accessToken, refreshToken, user }>}
 */
export async function loginUserViaAPI(apiClient, credentials) {
  return test.step('User login via API', async () => {
    const result = await apiClient.loginUser(credentials);
    console.log('[authHelper] User logged in:', result.user.email);
    return result;
  });
}

/**
 * User registration via UI (full end-to-end test of registration flow).
 * 
 * @param {Page} page
 * @param {object} userData — { email, password, firstName, lastName }
 * @returns {Promise<{ email }>}
 */
export async function registerUserViaUI(page, userData) {
  return test.step('User registration via UI', async () => {
    await page.goto('/register');

    await page.getByLabel('Email').fill(userData.email);
    await page.getByLabel('Password').fill(userData.password);
    await page.getByLabel('First Name').fill(userData.firstName);
    await page.getByLabel('Last Name').fill(userData.lastName);

    await page.getByRole('button', { name: /Register|Sign Up/i }).click();

    // Wait for redirect to login or success message
    await page.waitForURL(/\/login|\/dashboard/);

    return { email: userData.email };
  });
}

/**
 * User login via UI.
 * 
 * @param {Page} page
 * @param {object} credentials — { email, password }
 * @returns {Promise<void>}
 */
export async function loginUserViaUI(page, credentials) {
  return test.step('User login via UI', async () => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Password').fill(credentials.password);

    await page.getByRole('button', { name: /Login|Sign In/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/);

    console.log('[authHelper] User logged in via UI:', credentials.email);
  });
}

/**
 * Merchant registration via API (preferred for test setup).
 * 
 * @param {ApiClient} apiClient
 * @param {object} merchantData — { name, walletAddress, businessCategory }
 * @returns {Promise<{ merchant, apiKey }>}
 */
export async function registerMerchantViaAPI(apiClient, merchantData) {
  return test.step('Merchant registration via API', async () => {
    const result = await apiClient.registerMerchant(merchantData);
    console.log('[authHelper] Merchant registered:', result.merchant.name);
    console.log('[authHelper] API key generated (length:', result.apiKey.length, ')');
    return result;
  });
}

/**
 * Merchant registration via UI (full end-to-end test).
 * 
 * @param {Page} page
 * @param {object} merchantData — { name, walletAddress, businessCategory }
 * @returns {Promise<{ merchant, apiKey }>}
 */
export async function registerMerchantViaUI(page, merchantData) {
  return test.step('Merchant registration via UI', async () => {
    const portalPage = new MerchantPortalPage(page);
    await portalPage.goto();
    await portalPage.assertPageLoaded();

    // Check that registration form is visible
    const formVisible = await portalPage.isMerchantRegistrationFormVisible();
    if (!formVisible) {
      throw new Error('Merchant registration form not visible');
    }

    await portalPage.fillMerchantRegistration(merchantData);
    await portalPage.submitMerchantRegistration();

    // Wait for API key to display
    const displayedApiKey = await portalPage.waitForApiKeyDisplay();

    if (!displayedApiKey || displayedApiKey.length !== 32) {
      throw new Error(`Invalid API key displayed: ${displayedApiKey}`);
    }

    console.log('[authHelper] Merchant registered via UI:', merchantData.name);
    console.log('[authHelper] API key captured from UI:', displayedApiKey);

    return {
      merchant: { name: merchantData.name },
      apiKey: displayedApiKey,
    };
  });
}

/**
 * Verify merchant is logged in (authenticated) by checking for dashboard elements.
 * 
 * @param {Page} page
 * @returns {Promise<boolean>}
 */
export async function isMerchantAuthenticated(page) {
  const portalPage = new MerchantPortalPage(page);
  // If registration form is visible, merchant is NOT logged in
  return !(await portalPage.isMerchantRegistrationFormVisible());
}
```

---

## Reusable Campaign Helper

### 4. Campaign Helper (`frontend/e2e/helpers/campaignHelper.js`)

```javascript
/**
 * campaignHelper.js — Reusable campaign creation and management.
 */

import { test } from '@playwright/test';
import { MerchantPortalPage } from '../pages/MerchantPortalPage.js';

/**
 * Create campaign via API (preferred for test setup).
 * 
 * @param {ApiClient} apiClient
 * @param {object} campaignData — { name, rewardRate, startDate, endDate }
 * @param {string} apiKey — Merchant API key
 * @returns {Promise<{ campaign }>}
 */
export async function createCampaignViaAPI(apiClient, campaignData, apiKey) {
  return test.step('Campaign creation via API', async () => {
    const result = await apiClient.createCampaign(campaignData, apiKey);
    console.log('[campaignHelper] Campaign created:', result.campaign.name, `(ID: ${result.campaign.id})`);
    return result;
  });
}

/**
 * Create campaign via UI (full end-to-end test).
 * 
 * @param {Page} page
 * @param {object} campaignData — { name, rewardRate, startDate, endDate }
 * @returns {Promise<{ campaign }>}
 */
export async function createCampaignViaUI(page, campaignData) {
  return test.step('Campaign creation via UI', async () => {
    const portalPage = new MerchantPortalPage(page);

    // Ensure we're on the merchant portal and the form is ready
    await portalPage.assertPageLoaded();

    // Scroll to campaign form if necessary
    await page.locator('text=Create Campaign').scrollIntoViewIfNeeded();

    await portalPage.fillCampaignForm(campaignData);
    await portalPage.submitCampaignCreation();

    // Wait for success message
    await portalPage.waitForCampaignSuccessMessage();

    // Verify campaign appears in table
    const isVisible = await portalPage.isCampaignVisible(campaignData.name);
    if (!isVisible) {
      throw new Error(`Campaign "${campaignData.name}" not visible in table after creation`);
    }

    console.log('[campaignHelper] Campaign created via UI:', campaignData.name);

    return {
      campaign: { name: campaignData.name, ...campaignData },
    };
  });
}

/**
 * List campaigns via API.
 * 
 * @param {ApiClient} apiClient
 * @param {string} apiKey
 * @returns {Promise<Array>}
 */
export async function listCampaignsViaAPI(apiClient, apiKey) {
  return test.step('List campaigns via API', async () => {
    // Note: apiClient doesn't have this yet, so it would need to be added
    // For now, this is a placeholder
    throw new Error('listCampaigns not yet implemented in apiClient');
  });
}
```

---

## Reusable Reward Distribution Helper

### 5. Reward Helper (`frontend/e2e/helpers/rewardHelper.js`)

```javascript
/**
 * rewardHelper.js — Reusable reward distribution flows.
 */

import { test } from '@playwright/test';
import { MerchantPortalPage } from '../pages/MerchantPortalPage.js';
import { pollBalanceUntilReady } from './pollingHelper.js';

/**
 * Issue reward via API (preferred for test setup).
 * 
 * @param {ApiClient} apiClient
 * @param {object} rewardData — { walletAddress, amount, campaignId }
 * @param {string} apiKey
 * @returns {Promise<{ txHash }>}
 */
export async function issueRewardViaAPI(apiClient, rewardData, apiKey) {
  return test.step('Reward issuance via API', async () => {
    const result = await apiClient.distributeReward(rewardData, apiKey);
    console.log('[rewardHelper] Reward issued:', rewardData.amount, 'NOVA to', rewardData.walletAddress);
    console.log('[rewardHelper] Transaction hash:', result.txHash);
    return result;
  });
}

/**
 * Issue reward via UI (full end-to-end test).
 * 
 * @param {Page} page
 * @param {object} rewardData — { campaignName, walletAddress, amount }
 * @returns {Promise<{ txHash }>}
 */
export async function issueRewardViaUI(page, rewardData) {
  return test.step('Reward issuance via UI', async () => {
    const portalPage = new MerchantPortalPage(page);

    await portalPage.assertPageLoaded();

    // Scroll to reward form
    await page.locator('text=Issue Rewards').scrollIntoViewIfNeeded();

    await portalPage.fillRewardIssueForm(rewardData);
    await portalPage.submitRewardIssue();

    // Wait for success message
    await portalPage.waitForRewardSuccessMessage();

    // Get transaction hash from the link
    const txLink = await portalPage.getTransactionHashLink();
    const href = await txLink.getAttribute('href');
    const txHash = href.split('/').pop(); // Extract from URL

    console.log('[rewardHelper] Reward issued via UI:', rewardData.amount, 'NOVA');
    console.log('[rewardHelper] Transaction hash:', txHash);

    return { txHash };
  });
}

/**
 * Poll for reward to be reflected in customer's balance.
 * 
 * @param {ApiClient} apiClient
 * @param {string} walletAddress
 * @param {number} expectedAmount
 * @param {object} opts
 * @returns {Promise<{ balance, attempts, totalTimeMs }>}
 */
export async function waitForBalanceUpdate(apiClient, walletAddress, expectedAmount, opts = {}) {
  return test.step('Poll for balance update', async () => {
    const result = await pollBalanceUntilReady(apiClient, walletAddress, expectedAmount, opts);
    console.log(
      `[rewardHelper] Balance updated to ${result.balance} after ${result.attempts} attempts (${result.totalTimeMs}ms)`
    );
    return result;
  });
}
```

---

## Summary of Page Objects & Helpers to Create

| File | Purpose |
|------|---------|
| `frontend/e2e/pages/MerchantPortalPage.js` | Page object for merchant portal (/merchant) |
| `frontend/e2e/pages/CustomerDashboardPage.js` | Page object for customer dashboard (/dashboard) |
| `frontend/e2e/helpers/authHelper.js` | User & merchant registration/login (API & UI) |
| `frontend/e2e/helpers/campaignHelper.js` | Campaign creation (API & UI) |
| `frontend/e2e/helpers/rewardHelper.js` | Reward distribution & balance polling |

