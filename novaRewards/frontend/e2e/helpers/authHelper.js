/**
 * authHelper.js — Reusable authentication workflows.
 *
 * Provides:
 * - User registration (API & UI)
 * - User login (API & UI)
 * - Merchant registration (API & UI)
 * - Authentication verification
 */

import { test } from '@playwright/test';
import { MerchantPortalPage } from '../pages/MerchantPortalPage.js';

/**
 * Registers a new user via API (fast, for test setup).
 *
 * @param {ApiClient} apiClient
 * @param {object} userData
 * @returns {Promise<{ user, accessToken, refreshToken }>}
 */
export async function registerUserViaAPI(apiClient, userData) {
  return test.step('Register user via API', async () => {
    const user = await apiClient.registerUser(userData);
    return user;
  });
}

/**
 * Logs in a user via API (fast, for test setup).
 *
 * @param {ApiClient} apiClient
 * @param {object} credentials
 * @returns {Promise<{ accessToken, refreshToken, user }>}
 */
export async function loginUserViaAPI(apiClient, credentials) {
  return test.step('Login user via API', async () => {
    const result = await apiClient.loginUser(credentials);
    return result;
  });
}

/**
 * Registers a user via UI (full end-to-end test).
 *
 * @param {Page} page
 * @param {object} userData
 * @returns {Promise<{ email }>}
 */
export async function registerUserViaUI(page, userData) {
  return test.step('Register user via UI', async () => {
    await page.goto('/register');

    await page.getByLabel('Email').fill(userData.email);
    await page.getByLabel('Password').fill(userData.password);
    await page.getByLabel('First Name').fill(userData.firstName);
    await page.getByLabel('Last Name').fill(userData.lastName);

    await page.getByRole('button', { name: /Register|Sign Up/i }).click();

    await page.waitForURL(/\/login|\/dashboard/);

    return { email: userData.email };
  });
}

/**
 * Logs in a user via UI.
 *
 * @param {Page} page
 * @param {object} credentials
 */
export async function loginUserViaUI(page, credentials) {
  return test.step('Login user via UI', async () => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Password').fill(credentials.password);

    await page.getByRole('button', { name: /Login|Sign In/i }).click();

    await page.waitForURL(/\/dashboard/);
  });
}

/**
 * Registers a merchant via API (fast, for test setup).
 *
 * @param {ApiClient} apiClient
 * @param {object} merchantData
 * @returns {Promise<{ merchant, apiKey }>}
 */
export async function registerMerchantViaAPI(apiClient, merchantData) {
  return test.step('Register merchant via API', async () => {
    const result = await apiClient.registerMerchant(merchantData);
    return result;
  });
}

/**
 * Registers a merchant via UI (full end-to-end test).
 *
 * @param {Page} page
 * @param {object} merchantData
 * @returns {Promise<{ merchant, apiKey }>}
 */
export async function registerMerchantViaUI(page, merchantData) {
  return test.step('Register merchant via UI', async () => {
    const portalPage = new MerchantPortalPage(page);
    await portalPage.goto();
    await portalPage.assertPageLoaded();

    const formVisible = await portalPage.isMerchantRegistrationFormVisible();
    if (!formVisible) {
      throw new Error('[authHelper] Merchant registration form not visible');
    }

    await portalPage.fillMerchantRegistration(merchantData);
    await portalPage.submitMerchantRegistration();

    const displayedApiKey = await portalPage.waitForApiKeyDisplay();

    if (!displayedApiKey || displayedApiKey.length !== 32) {
      throw new Error(`[authHelper] Invalid API key displayed: ${displayedApiKey}`);
    }

    return {
      merchant: { name: merchantData.name },
      apiKey: displayedApiKey,
    };
  });
}

/**
 * Verifies that a merchant is authenticated (logged in).
 *
 * @param {Page} page
 * @returns {Promise<boolean>}
 */
export async function isMerchantAuthenticated(page) {
  const portalPage = new MerchantPortalPage(page);
  const formVisible = await portalPage.isMerchantRegistrationFormVisible();
  return !formVisible; // If form is NOT visible, merchant IS authenticated
}
