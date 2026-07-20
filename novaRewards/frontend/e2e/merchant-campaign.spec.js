// @ts-check
const { test, expect } = require('@playwright/test');
const { uniqueEmail, TEST_MERCHANT } = require('./helpers');

test.describe('Merchant Registration & Campaign Creation', () => {
  test('registers a merchant and receives an API key', async ({ page }) => {
    await page.goto('/merchant');

    await page.fill('input[placeholder="Acme Coffee"]', TEST_MERCHANT.name);
    await page.fill('input[placeholder="G..."]', TEST_MERCHANT.walletAddress);
    await page.fill('input[placeholder="Food & Beverage"]', TEST_MERCHANT.businessCategory);
    await page.click('button[type="submit"]');

    // API key should appear after registration
    await expect(page.locator('text=API Key')).toBeVisible({ timeout: 8_000 });
    const apiKeyText = await page.locator('span', { hasText: /[A-Za-z0-9]{20,}/ }).first().textContent();
    expect(apiKeyText).toBeTruthy();
  });

  test('shows error when merchant wallet address is invalid', async ({ page }) => {
    await page.goto('/merchant');

    await page.fill('input[placeholder="Acme Coffee"]', 'Bad Merchant');
    await page.fill('input[placeholder="G..."]', 'INVALID_WALLET');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error, p.error')).toBeVisible({ timeout: 5_000 });
  });

  test('creates a campaign after merchant registration', async ({ page }) => {
    await page.goto('/merchant');

    // Register merchant
    await page.fill('input[placeholder="Acme Coffee"]', `Campaign Merchant ${Date.now()}`);
    await page.fill('input[placeholder="G..."]', TEST_MERCHANT.walletAddress);
    await page.click('button[type="submit"]');
    await expect(page.locator('text=API Key')).toBeVisible({ timeout: 8_000 });

    // Fill campaign form
    await page.fill('input[placeholder*="Campaign"], input[name="name"]', 'Summer Rewards');
    await page.fill('input[type="number"]', '1000');

    // Set end date to future
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const dateInput = page.locator('input[type="date"]');
    if (await dateInput.count() > 0) {
      await dateInput.fill(futureDate);
    }

    await page.click('button:has-text("Create Campaign"), button[type="submit"]:near(input[name="name"])');

    // Campaign should appear in the list
    await expect(page.locator('text=Summer Rewards')).toBeVisible({ timeout: 8_000 });
  });

  test('shows merchant totals panel after registration', async ({ page }) => {
    await page.goto('/merchant');

    await page.fill('input[placeholder="Acme Coffee"]', `Totals Merchant ${Date.now()}`);
    await page.fill('input[placeholder="G..."]', TEST_MERCHANT.walletAddress);
    await page.click('button[type="submit"]');
    await expect(page.locator('text=API Key')).toBeVisible({ timeout: 8_000 });

    await expect(page.locator('text=Total Distributed')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=Total Redeemed')).toBeVisible({ timeout: 5_000 });
  });
});
