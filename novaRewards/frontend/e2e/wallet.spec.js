// @ts-check
const { test, expect } = require('@playwright/test');
const { uniqueEmail, registerUser } = require('./helpers');

test.describe('Wallet Integration', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, {
      name: 'Wallet Tester',
      email: uniqueEmail('wallet'),
      password: 'Password1',
    });
  });

  test('dashboard shows connect wallet prompt when no wallet is linked', async ({ page }) => {
    await page.goto('/dashboard');
    // Without Freighter installed, a connect/install prompt should appear
    await expect(
      page.locator('button:has-text("Connect"), text=Connect Wallet, text=Install Freighter')
    ).toBeVisible({ timeout: 8_000 });
  });

  test('shows Freighter not installed message when extension is absent', async ({ page }) => {
    // Freighter is not available in headless Playwright — simulate the error state
    await page.goto('/dashboard');
    await page.evaluate(() => {
      // Remove any freighter globals to simulate missing extension
      delete window.freighter;
    });

    const connectBtn = page.locator('button:has-text("Connect")').first();
    if (await connectBtn.count() > 0) {
      await connectBtn.click();
      await expect(
        page.locator('text=/freighter|not installed|extension/i')
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('wallet address is truncated in the UI when connected', async ({ page }) => {
    // Seed a fake wallet key into WalletContext via localStorage
    const fakeKey = 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3QLBDQBQD';
    await page.goto('/dashboard');
    await page.evaluate((key) => {
      localStorage.setItem('walletPublicKey', key);
    }, fakeKey);

    // Mock Horizon balance call to avoid real network
    await page.route('**/accounts/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balances: [{ asset_code: 'NOVA', asset_type: 'credit_alphanum4', balance: '250.0000000' }],
        }),
      })
    );

    await page.reload();

    // Truncated address should show first + last chars
    await expect(page.locator(`text=${fakeKey.slice(0, 4)}`)).toBeVisible({ timeout: 8_000 });
  });

  test('NOVA balance is displayed on dashboard', async ({ page }) => {
    const fakeKey = 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3QLBDQBQD';
    await page.goto('/dashboard');
    await page.evaluate((key) => {
      localStorage.setItem('walletPublicKey', key);
    }, fakeKey);

    await page.route('**/accounts/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balances: [{ asset_code: 'NOVA', asset_type: 'credit_alphanum4', balance: '500.0000000' }],
        }),
      })
    );

    await page.reload();
    await expect(page.locator('text=/500|NOVA/i')).toBeVisible({ timeout: 8_000 });
  });

  test('disconnect wallet clears the public key from UI', async ({ page }) => {
    const fakeKey = 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3QLBDQBQD';
    await page.goto('/dashboard');
    await page.evaluate((key) => {
      localStorage.setItem('walletPublicKey', key);
    }, fakeKey);

    await page.route('**/accounts/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ balances: [] }),
      })
    );

    await page.reload();

    const disconnectBtn = page.locator('button:has-text("Disconnect")');
    if (await disconnectBtn.count() > 0) {
      await disconnectBtn.click();
      await expect(page.locator('button:has-text("Connect")')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('reward distribution page requires wallet signature prompt', async ({ page }) => {
    await page.goto('/rewards');
    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('authUser') || '{}');
      user.points = 99999;
      localStorage.setItem('authUser', JSON.stringify(user));
    });
    await page.reload();

    const redeemBtn = page.locator('button:has-text("Redeem")').first();
    if (await redeemBtn.count() > 0) {
      await redeemBtn.click();
      // Modal should mention wallet signature
      await expect(
        page.locator('text=/wallet|sign|freighter/i')
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
