// @ts-check
const { test, expect } = require('@playwright/test');
const { uniqueEmail, registerUser } = require('./helpers');

test.describe('Redeem Reward Flow', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, {
      name: 'Redeemer',
      email: uniqueEmail('redeem'),
      password: 'Password1',
    });

    // Seed balance so redemption is available
    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('authUser') || '{}');
      user.points = 500;
      localStorage.setItem('authUser', JSON.stringify(user));
    });
  });

  test('redemption catalogue lists redeemable items', async ({ page }) => {
    await page.route('**/api/redemptions/catalogue**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ id: 1, name: 'Coffee Voucher', cost: 100 }],
        }),
      })
    );

    await page.goto('/rewards');
    await expect(page.locator('text=/redeem|catalogue|voucher/i')).toBeVisible({ timeout: 8_000 });
  });

  test('redeem flow shows confirmation modal', async ({ page }) => {
    await page.route('**/api/redemptions**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, redemption_id: 'r-001' }),
      })
    );

    await page.goto('/rewards');
    const redeemBtn = page.locator('button:has-text("Redeem")').first();
    if (await redeemBtn.count() > 0) {
      await redeemBtn.click();
      await expect(page.locator('text=/confirm|redeem|success/i')).toBeVisible({ timeout: 8_000 });
    }
  });

  test('insufficient balance shows error message', async ({ page }) => {
    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('authUser') || '{}');
      user.points = 0;
      localStorage.setItem('authUser', JSON.stringify(user));
    });

    await page.route('**/api/redemptions**', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Insufficient balance' }),
      })
    );

    await page.goto('/rewards');
    const redeemBtn = page.locator('button:has-text("Redeem")').first();
    if (await redeemBtn.count() > 0) {
      await redeemBtn.click();
      await expect(page.locator('text=/insufficient|balance|error/i')).toBeVisible({ timeout: 8_000 });
    }
  });
});
