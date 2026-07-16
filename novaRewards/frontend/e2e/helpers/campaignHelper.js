/**
 * campaignHelper.js — Reusable campaign creation workflows.
 *
 * Provides:
 * - Campaign creation (API & UI)
 */

import { test } from '@playwright/test';
import { MerchantPortalPage } from '../pages/MerchantPortalPage.js';

/**
 * Creates a campaign via API (fast, for test setup).
 *
 * @param {ApiClient} apiClient
 * @param {object} campaignData
 * @param {string} apiKey
 * @returns {Promise<{ campaign }>}
 */
export async function createCampaignViaAPI(apiClient, campaignData, apiKey) {
  return test.step('Create campaign via API', async () => {
    const result = await apiClient.createCampaign(campaignData, apiKey);
    return result;
  });
}

/**
 * Creates a campaign via UI (full end-to-end test).
 *
 * @param {Page} page
 * @param {object} campaignData
 * @returns {Promise<{ campaign }>}
 */
export async function createCampaignViaUI(page, campaignData) {
  return test.step('Create campaign via UI', async () => {
    const portalPage = new MerchantPortalPage(page);

    await portalPage.assertPageLoaded();

    // Scroll to campaign form if needed
    const campaignHeading = page.locator('text=Create Campaign').first();
    if (await campaignHeading.isVisible()) {
      await campaignHeading.scrollIntoViewIfNeeded();
    }

    await portalPage.fillCampaignForm(campaignData);
    await portalPage.submitCampaignCreation();

    await portalPage.waitForCampaignSuccessMessage();

    const isVisible = await portalPage.isCampaignVisible(campaignData.name);
    if (!isVisible) {
      throw new Error(`[campaignHelper] Campaign "${campaignData.name}" not visible after creation`);
    }

    return {
      campaign: { name: campaignData.name, ...campaignData },
    };
  });
}
