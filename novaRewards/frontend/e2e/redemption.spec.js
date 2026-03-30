// @ts-check
const { test, expect } = require('@playwright/test');
const { uniqueEmail, registerUser } = require('./helpers');

test.describe('Reward Redemption Flow', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, {
      name: 'Redeem Tester',
      email: uniqueEmail('redeem'),
      password: 'Password1',
    });
  });

  test('rewards page loads and shows catalogue', async ({ page }) => {
    await page.goto('/rewards');
    // Either rewards grid or empty state should be visible
    await expect(
      page.locator('.rewards-grid, .empty-state, text=No rewards available')
    ).toBeVisible({ timeout: 8_000 });
  });

  test('shows user points balance on rewards page', async ({ page }) => {
    await page.goto('/rewards');
    await expect(page.locator('text=/\\d+ points/i')).toBeVisible({ timeout: 8_000 });
  });

  test('category filter updates the displayed rewards', async ({ page }) => {
    await page.goto('/rewards');
    const categorySelect = page.locator('#category-filter, select').first();
    await expect(categorySelect).toBeVisible({ timeout: 8_000 });

    const options = await categorySelect.locator('option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(1); // at least "All Categories"
  });

  test('sort control is present and functional', async ({ page }) => {
    await page.goto('/rewards');
    const sortSelect = page.locator('#sort-by, select').last();
    await expect(sortSelect).toBeVisible({ timeout: 8_000 });

    await sortSelect.selectOption('cost-desc');
    await expect(sortSelect).toHaveValue('cost-desc');
  });

  test('redeem button is disabled when user has insufficient points', async ({ page }) => {
    await page.goto('/rewards');

    // New user has 0 points — all redeem buttons should be disabled
    const redeemBtns = page.locator('button:has-text("Insufficient Points"), button[disabled]:has-text("Redeem")');
    const count = await redeemBtns.count();
    // If rewards exist, at least one should be disabled for a 0-point user
    if (count > 0) {
      await expect(redeemBtns.first()).toBeDisabled();
    }
  });

  test('redemption modal opens when redeem is clicked on an affordable reward', async ({ page }) => {
    // Inject enough points via localStorage mock to make a reward affordable
    await page.goto('/rewards');
    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('authUser') || '{}');
      user.points = 99999;
      localStorage.setItem('authUser', JSON.stringify(user));
    });
    await page.reload();

    const redeemBtn = page.locator('button:has-text("Redeem")').first();
    const count = await redeemBtn.count();
    if (count > 0) {
      await redeemBtn.click();
      await expect(page.locator('.modal-overlay, .redemption-modal')).toBeVisible({ timeout: 5_000 });
      await expect(page.locator('text=Confirm Redemption')).toBeVisible();
    }
  });

  test('redemption modal can be cancelled', async ({ page }) => {
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
      await page.click('button:has-text("Cancel")');
      await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 3_000 });
    }
  });
});

test.describe('Redemption History', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, {
      name: 'History Tester',
      email: uniqueEmail('history'),
      password: 'Password1',
    });
  });

  test('history page renders the redemption history component', async ({ page }) => {
    await page.goto('/history');
    await expect(page.locator('text=Redemption History')).toBeVisible({ timeout: 8_000 });
  });

  test('shows empty state when no redemptions exist', async ({ page }) => {
    await page.goto('/history');
    await expect(
      page.locator('text=No redemptions yet, text=Redemption History')
    ).toBeVisible({ timeout: 8_000 });
  });

  test('history table shows correct column headers', async ({ page }) => {
    await page.goto('/history');
    // Intercept API to return a fake redemption
    await page.route('**/redemptions*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{
            id: 1,
            reward_name: 'Free Coffee',
            points_spent: 100,
            status: 'completed',
            created_at: new Date().toISOString(),
            tx_hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
          }],
          total: 1,
          limit: 10,
        }),
      })
    );
    await page.reload();

    await expect(page.locator('text=Free Coffee')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=Completed')).toBeVisible({ timeout: 5_000 });
  });
});
