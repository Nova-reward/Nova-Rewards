// @ts-check
const { test, expect } = require('@playwright/test');
const { uniqueEmail, registerUser } = require('./helpers');

test.describe('Admin Operations', () => {
  // Seed an admin session by mocking the auth token with admin role
  async function seedAdminSession(page) {
    await page.goto('/login');
    await page.evaluate(() => {
      const adminUser = { id: 1, name: 'Admin', email: 'admin@nova.test', role: 'admin' };
      localStorage.setItem('authToken', 'mock-admin-token');
      localStorage.setItem('authUser', JSON.stringify(adminUser));
    });
  }

  test('admin can access the merchant portal', async ({ page }) => {
    await seedAdminSession(page);
    await page.goto('/merchant');
    await expect(page.locator('text=Merchant Portal')).toBeVisible({ timeout: 8_000 });
  });

  test('admin reward issuance form is present on merchant page', async ({ page }) => {
    await seedAdminSession(page);
    await page.goto('/merchant');

    // Register a merchant first to reveal the issue reward form
    await page.fill('input[placeholder="Acme Coffee"]', `Admin Merchant ${Date.now()}`);
    await page.fill('input[placeholder="G..."]', 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3QLBDQBQD');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=API Key')).toBeVisible({ timeout: 8_000 });

    // Issue reward form should be visible
    await expect(
      page.locator('text=/Issue Reward|Distribute/i')
    ).toBeVisible({ timeout: 5_000 });
  });

  test('reward issuance shows error for invalid wallet address', async ({ page }) => {
    await seedAdminSession(page);
    await page.goto('/merchant');

    await page.fill('input[placeholder="Acme Coffee"]', `Err Merchant ${Date.now()}`);
    await page.fill('input[placeholder="G..."]', 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3QLBDQBQD');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=API Key')).toBeVisible({ timeout: 8_000 });

    // Try to issue reward to invalid address
    const recipientInput = page.locator('input[placeholder*="recipient"], input[placeholder*="wallet"], input[placeholder="G..."]').last();
    if (await recipientInput.count() > 0) {
      await recipientInput.fill('INVALID_ADDRESS');
      const amountInput = page.locator('input[type="number"]').last();
      if (await amountInput.count() > 0) await amountInput.fill('10');
      await page.click('button:has-text("Issue"), button:has-text("Distribute")');
      await expect(page.locator('.error, p.error, .error-message')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('campaign list is visible after merchant registration', async ({ page }) => {
    await seedAdminSession(page);
    await page.goto('/merchant');

    await page.fill('input[placeholder="Acme Coffee"]', `List Merchant ${Date.now()}`);
    await page.fill('input[placeholder="G..."]', 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3QLBDQBQD');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=API Key')).toBeVisible({ timeout: 8_000 });

    // Campaign section should render (even if empty)
    await expect(
      page.locator('text=/Campaign|No campaigns/i')
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Error Scenarios', () => {
  test('API 401 redirects to login', async ({ page }) => {
    // Intercept any API call and return 401
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ message: 'Unauthorized' }) })
    );

    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'expired-token');
      localStorage.setItem('authUser', JSON.stringify({ id: 1, name: 'User' }));
    });
    await page.goto('/dashboard');

    // Should eventually redirect to login
    await page.waitForURL(/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/login/);
  });

  test('rewards page shows error banner when API fails', async ({ page }) => {
    await registerUser(page, {
      name: 'Error Tester',
      email: uniqueEmail('err'),
      password: 'Password1',
    });

    await page.route('**/rewards*', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ message: 'Internal Server Error' }) })
    );

    await page.goto('/rewards');
    await expect(
      page.locator('.error, .error-message, text=/failed|error/i')
    ).toBeVisible({ timeout: 8_000 });
  });

  test('redemption history shows error when API fails', async ({ page }) => {
    await registerUser(page, {
      name: 'History Error',
      email: uniqueEmail('histerr'),
      password: 'Password1',
    });

    await page.route('**/redemptions*', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ message: 'Server error' }) })
    );

    await page.goto('/history');
    await expect(
      page.locator('.error, text=/failed|error/i')
    ).toBeVisible({ timeout: 8_000 });
  });

  test('register page shows server error message', async ({ page }) => {
    await page.route('**/auth/register', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Service unavailable' }),
      })
    );

    await page.goto('/register');
    await page.fill('#name', 'Server Error User');
    await page.fill('#email', uniqueEmail('servererr'));
    await page.fill('#password', 'Password1');
    await page.fill('#confirmPassword', 'Password1');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-banner, .error-message')).toBeVisible({ timeout: 5_000 });
  });

  test('login page shows error for network failure', async ({ page }) => {
    await page.route('**/auth/login', (route) => route.abort('failed'));

    await page.goto('/login');
    await page.fill('#email', 'test@test.com');
    await page.fill('#password', 'Password1');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-banner, .error-message')).toBeVisible({ timeout: 5_000 });
  });

  test('merchant registration shows error for duplicate wallet', async ({ page }) => {
    await page.route('**/merchants/register', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Wallet address already registered' }),
      })
    );

    await page.goto('/merchant');
    await page.fill('input[placeholder="Acme Coffee"]', 'Duplicate Merchant');
    await page.fill('input[placeholder="G..."]', 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3QLBDQBQD');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error, p.error')).toBeVisible({ timeout: 5_000 });
  });

  test('redemption with insufficient points shows 409 error in modal', async ({ page }) => {
    await registerUser(page, {
      name: 'Broke User',
      email: uniqueEmail('broke'),
      password: 'Password1',
    });

    await page.route('**/redemptions', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'insufficient_points', message: 'Not enough points' }),
      })
    );

    // Inject points so the button is enabled, but API will reject
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
      await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5_000 });
      await page.click('button:has-text("Sign & Redeem"), button:has-text("Confirm")');
      await expect(
        page.locator('text=/Not enough points|insufficient|failed/i')
      ).toBeVisible({ timeout: 8_000 });
    }
  });
});
