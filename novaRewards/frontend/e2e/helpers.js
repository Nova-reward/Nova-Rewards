// @ts-check
/**
 * Shared test helpers and fixtures for Nova Rewards E2E tests.
 */

const { expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Unique email per test run to avoid conflicts */
function uniqueEmail(prefix = 'user') {
  return `${prefix}+${Date.now()}@test.nova`;
}

const TEST_USER = {
  name: 'Test User',
  email: uniqueEmail('e2e'),
  password: 'Password1',
};

const TEST_MERCHANT = {
  name: 'E2E Coffee Shop',
  walletAddress: 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3QLBDQBQD',
  businessCategory: 'Food & Beverage',
};

/**
 * Register a user via the UI and return to the page after redirect.
 * @param {import('@playwright/test').Page} page
 * @param {{ name: string, email: string, password: string }} user
 */
async function registerUser(page, user = TEST_USER) {
  await page.goto('/register');
  await page.fill('#name', user.name);
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.fill('#confirmPassword', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}

/**
 * Log in via the UI.
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string, password: string }} credentials
 */
async function loginUser(page, credentials = TEST_USER) {
  await page.goto('/login');
  await page.fill('#email', credentials.email);
  await page.fill('#password', credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}

/**
 * Seed auth tokens directly into localStorage to skip UI login.
 * @param {import('@playwright/test').Page} page
 * @param {{ token: string, user: object }} auth
 */
async function seedAuth(page, auth) {
  await page.goto('/login');
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('authUser', JSON.stringify(user));
  }, auth);
}

module.exports = { uniqueEmail, TEST_USER, TEST_MERCHANT, registerUser, loginUser, seedAuth, API_URL };
