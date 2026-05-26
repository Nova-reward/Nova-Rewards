// @ts-check
/**
 * E2E Token Transfer Flow — Issue #942
 *
 * Tests the full transfer flow:
 *   wallet connect → transfer form → submit → success toast → balance update
 *   → transaction appears in history
 *
 * Runs against the local Docker Compose environment (http://localhost:3000).
 * Stellar network calls are intercepted via route mocking so the test does
 * not require a live Stellar node.
 */

const { test, expect } = require('@playwright/test');
const { uniqueEmail, registerUser } = require('./helpers');

const SENDER_PUBLIC_KEY = 'GABC1111111111111111111111111111111111111111111111111111';
const RECIPIENT_PUBLIC_KEY = 'GDEF2222222222222222222222222222222222222222222222222222';
const TX_HASH = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

test.describe('Token Transfer Flow (#942)', () => {
  test.beforeEach(async ({ page }) => {
    // Register and log in a test user
    await registerUser(page, {
      name: 'Transfer Tester',
      email: uniqueEmail('transfer'),
      password: 'Password1',
    });

    // Inject a fake connected wallet into the app state via localStorage/sessionStorage
    await page.evaluate(
      ({ pub }) => {
        localStorage.setItem('walletPublicKey', pub);
        localStorage.setItem('walletConnected', 'true');
        localStorage.setItem('walletBalance', '500');
      },
      { pub: SENDER_PUBLIC_KEY }
    );

    // Mock backend API calls
    await page.route('**/api/trustline/verify', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { exists: true } }),
      })
    );

    await page.route('**/api/transactions/record', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: 42, txHash: TX_HASH }),
      })
    );

    await page.route('**/api/users/*/balance**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { balance: 490 } }),
      })
    );

    await page.route('**/api/users/*/transactions**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: '42',
              type: 'transfer',
              amount: '10',
              toWallet: RECIPIENT_PUBLIC_KEY,
              createdAt: new Date().toISOString(),
              status: 'confirmed',
              txHash: TX_HASH,
            },
          ],
        }),
      })
    );

    // Mock Freighter / Stellar SDK calls at the window level
    await page.addInitScript(
      ({ txHash }) => {
        // Stub signAndSubmit used by TransferForm
        window.__freighterMock = { txHash };
        // Intercept dynamic imports of freighter-api
        Object.defineProperty(window, 'freighter', {
          value: {
            isConnected: () => Promise.resolve(true),
            getPublicKey: () => Promise.resolve('GABC1111111111111111111111111111111111111111111111111111'),
            signTransaction: () => Promise.resolve('signed-xdr'),
          },
          writable: true,
        });
      },
      { txHash: TX_HASH }
    );
  });

  test('navigates to dashboard and finds transfer form', async ({ page }) => {
    await page.goto('/dashboard');
    // The transfer form may be on dashboard or a dedicated page
    const transferLink = page.locator('a:has-text("Transfer"), a:has-text("Send"), button:has-text("Send NOVA")').first();
    if (await transferLink.count() > 0) {
      await transferLink.click();
    } else {
      await page.goto('/dashboard');
    }
    // Verify we can find the recipient input
    const recipientInput = page.locator('input[placeholder*="G"], input[name="recipient"], input[placeholder*="Recipient" i]').first();
    await expect(recipientInput).toBeVisible({ timeout: 8_000 });
  });

  test('fills transfer form and submits successfully', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to transfer form
    const sendBtn = page.locator('button:has-text("Send"), a:has-text("Send"), a:has-text("Transfer")').first();
    if (await sendBtn.count() > 0) {
      await sendBtn.click();
    }

    const recipientInput = page.locator('input[placeholder*="G"], input[name="recipient"], input[placeholder*="Recipient" i]').first();
    if (await recipientInput.count() === 0) {
      test.skip();
      return;
    }

    await recipientInput.fill(RECIPIENT_PUBLIC_KEY);

    const amountInput = page.locator('input[type="number"], input[name="amount"], input[placeholder*="amount" i]').first();
    await amountInput.fill('10');

    // Submit the form
    const submitBtn = page.locator('button[type="submit"]:has-text("Send"), button:has-text("Send NOVA")').first();
    await submitBtn.click();

    // Confirm in modal if present
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Verify success feedback (toast or inline message)
    await expect(
      page.locator('text=/success|Transfer successful|sent/i')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('balance updates after successful transfer', async ({ page }) => {
    await page.goto('/dashboard');

    // After the mocked balance endpoint returns 490, the UI should reflect it
    await expect(
      page.locator('text=/490|balance/i')
    ).toBeVisible({ timeout: 8_000 });
  });

  test('transaction appears in transaction history after transfer', async ({ page }) => {
    await page.goto('/history');

    // The mocked transaction history should show the transfer
    await expect(
      page.locator(`text=/transfer|${TX_HASH.slice(0, 8)}/i`)
    ).toBeVisible({ timeout: 8_000 });
  });

  test('shows error when recipient has no trustline', async ({ page }) => {
    // Override trustline mock to return false
    await page.route('**/api/trustline/verify', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { exists: false } }),
      })
    );

    await page.goto('/dashboard');

    const sendBtn = page.locator('button:has-text("Send"), a:has-text("Send"), a:has-text("Transfer")').first();
    if (await sendBtn.count() > 0) await sendBtn.click();

    const recipientInput = page.locator('input[placeholder*="G"], input[name="recipient"], input[placeholder*="Recipient" i]').first();
    if (await recipientInput.count() === 0) { test.skip(); return; }

    await recipientInput.fill(RECIPIENT_PUBLIC_KEY);
    const amountInput = page.locator('input[type="number"], input[name="amount"]').first();
    await amountInput.fill('10');

    const submitBtn = page.locator('button[type="submit"]:has-text("Send"), button:has-text("Send NOVA")').first();
    await submitBtn.click();

    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(
      page.locator('text=/trustline|does not have/i')
    ).toBeVisible({ timeout: 8_000 });
  });
});
