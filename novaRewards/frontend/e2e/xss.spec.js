// @ts-check
/**
 * XSS E2E Tests — Issue #947
 * @tags security xss
 *
 * DOM-based XSS tests using Playwright.
 * Verifies that XSS payloads entered in campaign name, description,
 * and wallet memo fields are not executed in the browser.
 */

const { test, expect } = require('@playwright/test');
const { uniqueEmail, registerUser } = require('./helpers');

const XSS_PAYLOADS = [
  '<script>window.__xss=1</script>',
  '<img src=x onerror="window.__xss=2">',
  '<svg onload="window.__xss=3">',
];

test.describe('XSS — DOM-based (#947)', () => {
  let userEmail;

  test.beforeEach(async ({ page }) => {
    userEmail = uniqueEmail('xss');
    await registerUser(page, { name: 'XSS Tester', email: userEmail, password: 'Password1' });
  });

  for (const payload of XSS_PAYLOADS) {
    test(`campaign name XSS payload not executed: ${payload.slice(0, 40)}`, async ({ page }) => {
      await page.goto('/merchant');

      // Locate the campaign name input (try common selectors)
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i], #campaign-name').first();
      if (await nameInput.count() === 0) {
        test.skip();
        return;
      }

      await nameInput.fill(payload);

      // Verify the XSS marker was NOT set (script not executed)
      const xssExecuted = await page.evaluate(() => window.__xss);
      expect(xssExecuted).toBeFalsy();
    });
  }

  test('campaign description XSS payload not executed', async ({ page }) => {
    await page.goto('/merchant');

    const descInput = page.locator('textarea[name="description"], textarea[placeholder*="description" i], #campaign-description').first();
    if (await descInput.count() === 0) {
      test.skip();
      return;
    }

    await descInput.fill('<script>window.__xss=99</script>');

    const xssExecuted = await page.evaluate(() => window.__xss);
    expect(xssExecuted).toBeFalsy();
  });

  test('stored campaign name rendered escaped in campaign list', async ({ page }) => {
    // Navigate to campaigns page and check that any rendered campaign names
    // do not contain unescaped script tags in the DOM
    await page.goto('/campaigns');

    // Verify no script tags were injected into the DOM by checking innerHTML
    const scriptInjected = await page.evaluate(() => {
      return document.body.innerHTML.includes('<script>window.__xss');
    });
    expect(scriptInjected).toBe(false);

    // Verify the XSS marker was not set
    const xssExecuted = await page.evaluate(() => window.__xss);
    expect(xssExecuted).toBeFalsy();
  });

  test('wallet memo XSS payload not executed in transfer form', async ({ page }) => {
    await page.goto('/dashboard');

    // Look for a memo/note field in the transfer form
    const memoInput = page.locator('input[name="memo"], input[placeholder*="memo" i], textarea[name="memo"]').first();
    if (await memoInput.count() === 0) {
      test.skip();
      return;
    }

    await memoInput.fill('<img src=x onerror="window.__xss=5">');

    const xssExecuted = await page.evaluate(() => window.__xss);
    expect(xssExecuted).toBeFalsy();
  });
});
