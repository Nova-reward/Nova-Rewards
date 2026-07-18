// @ts-check
const { test, expect } = require('@playwright/test');
const { uniqueEmail } = require('./helpers');

test.describe('User Registration', () => {
  test('registers successfully with valid data and lands on dashboard', async ({ page }) => {
    const email = uniqueEmail('reg');
    await page.goto('/register');

    await page.fill('#name', 'Nova Tester');
    await page.fill('#email', email);
    await page.fill('#password', 'Password1');
    await page.fill('#confirmPassword', 'Password1');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 10_000 });
    await expect(page).toHaveURL(/dashboard/);
  });

  test('shows validation errors for empty fields', async ({ page }) => {
    await page.goto('/register');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message').first()).toBeVisible();
  });

  test('shows error when passwords do not match', async ({ page }) => {
    await page.goto('/register');
    await page.fill('#name', 'Nova Tester');
    await page.fill('#email', uniqueEmail('mismatch'));
    await page.fill('#password', 'Password1');
    await page.fill('#confirmPassword', 'Different1');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toContainText(/match/i);
  });

  test('shows error for weak password', async ({ page }) => {
    await page.goto('/register');
    await page.fill('#name', 'Nova Tester');
    await page.fill('#email', uniqueEmail('weak'));
    await page.fill('#password', 'short');
    await page.fill('#confirmPassword', 'short');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toContainText(/8 characters|uppercase|lowercase|number/i);
  });

  test('shows error for duplicate email', async ({ page }) => {
    const email = uniqueEmail('dup');

    // First registration
    await page.goto('/register');
    await page.fill('#name', 'First User');
    await page.fill('#email', email);
    await page.fill('#password', 'Password1');
    await page.fill('#confirmPassword', 'Password1');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10_000 });

    // Second registration with same email
    await page.goto('/register');
    await page.fill('#name', 'Second User');
    await page.fill('#email', email);
    await page.fill('#password', 'Password1');
    await page.fill('#confirmPassword', 'Password1');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-banner, .error-message')).toBeVisible({ timeout: 5_000 });
  });

  test('has a link to the login page', async ({ page }) => {
    await page.goto('/register');
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('User Login', () => {
  let registeredEmail;

  test.beforeAll(async ({ browser }) => {
    // Register once, reuse across login tests
    registeredEmail = uniqueEmail('login');
    const page = await browser.newPage();
    await page.goto('/register');
    await page.fill('#name', 'Login Tester');
    await page.fill('#email', registeredEmail);
    await page.fill('#password', 'Password1');
    await page.fill('#confirmPassword', 'Password1');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
    await page.close();
  });

  test('logs in with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', registeredEmail);
    await page.fill('#password', 'Password1');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
    await expect(page).toHaveURL(/dashboard/);
  });

  test('shows error for wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', registeredEmail);
    await page.fill('#password', 'WrongPass1');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-banner, .error-message')).toBeVisible({ timeout: 5_000 });
  });

  test('shows error for non-existent email', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'nobody@nowhere.test');
    await page.fill('#password', 'Password1');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-banner, .error-message')).toBeVisible({ timeout: 5_000 });
  });

  test('redirects unauthenticated users from /dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/login/, { timeout: 8_000 });
    await expect(page).toHaveURL(/login/);
  });
});
