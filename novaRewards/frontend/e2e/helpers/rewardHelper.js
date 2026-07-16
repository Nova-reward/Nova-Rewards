/**
 * rewardHelper.js — Reusable reward distribution workflows.
 *
 * Provides:
 * - Reward distribution (API & UI)
 * - Balance polling
 */

import { test } from '@playwright/test';
import { MerchantPortalPage } from '../pages/MerchantPortalPage.js';
import { pollBalanceUntilReady } from './pollingHelper.js';

/**
 * Issues a reward via API (fast, for test setup).
 *
 * @param {ApiClient} apiClient
 * @param {object} rewardData
 * @param {string} apiKey
 * @returns {Promise<{ txHash }>}
 */
export async function issueRewardViaAPI(apiClient, rewardData, apiKey) {
  return test.step('Issue reward via API', async () => {
    const result = await apiClient.distributeReward(rewardData, apiKey);
    return result;
  });
}

/**
 * Issues a reward via UI (full end-to-end test).
 *
 * @param {Page} page
 * @param {object} rewardData
 * @returns {Promise<{ txHash }>}
 */
export async function issueRewardViaUI(page, rewardData) {
  return test.step('Issue reward via UI', async () => {
    const portalPage = new MerchantPortalPage(page);

    await portalPage.assertPageLoaded();

    // Scroll to reward form if needed
    const rewardHeading = page.locator('text=Issue Rewards').first();
    if (await rewardHeading.isVisible()) {
      await rewardHeading.scrollIntoViewIfNeeded();
    }

    await portalPage.fillRewardIssueForm(rewardData);
    await portalPage.submitRewardIssue();

    await portalPage.waitForRewardSuccessMessage();

    // Extract TX hash from link
    const txLink = await portalPage.getTransactionHashLink();
    const href = await txLink.getAttribute('href');
    const txHash = href.split('/').pop();

    return { txHash };
  });
}

/**
 * Waits for a reward to be reflected in the customer's balance.
 *
 * @param {ApiClient} apiClient
 * @param {string} walletAddress
 * @param {number} expectedAmount
 * @param {object} opts
 * @returns {Promise<{ balance, attempts, totalTimeMs }>}
 */
export async function waitForBalanceUpdate(
  apiClient,
  walletAddress,
  expectedAmount,
  opts = {}
) {
  return test.step('Wait for balance update', async () => {
    const result = await pollBalanceUntilReady(apiClient, walletAddress, expectedAmount, opts);
    return result;
  });
}
