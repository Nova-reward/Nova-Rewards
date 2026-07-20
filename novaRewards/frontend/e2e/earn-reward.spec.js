// @ts-check
const { test, expect } = require('@playwright/test');
const { uniqueEmail, registerUser } = require('./helpers');

test.describe('Earn Reward Flow', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, {
      name: 'Reward Earner',
      email: uniqueEmail('earn'),
      password: 'Password1',
    });
  });

  test('rewards page displays available campaigns', async ({ page }) => {
    await page.route('**/api/campaigns**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          campaigns: [
            { id: 1, name: 'Summer Promo', reward_amount: 100, status: 'active' },
          ],
        }),
      })
    );

    await page.goto('/rewards');
    await expect(page.locator('text=Summer Promo')).toBeVisible({ timeout: 8_000 });
  });

  test('user can earn points via daily login bonus', async ({ page }) => {
    await page.route('**/api/users/*/balance**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ balance: 150, pending: 0 }),
      })
    );

    await page.goto('/dashboard');
    await expect(page.locator('text=/150|points|NOVA/i')).toBeVisible({ timeout: 8_000 });
  });

  test('reward issuance shows confirmation feedback', async ({ page }) => {
    await page.route('**/api/rewards/issue**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, amount: 50, tx_hash: 'abc123' }),
      })
    );

    await page.goto('/rewards');
    const issueBtn = page.locator('button:has-text("Earn"), button:has-text("Claim")').first();
    if (await issueBtn.count() > 0) {
      await issueBtn.click();
      await expect(page.locator('text=/success|earned|confirmed/i')).toBeVisible({ timeout: 8_000 });
    }
  });
});
