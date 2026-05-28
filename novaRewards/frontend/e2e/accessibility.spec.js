/**
 * Axe-core accessibility tests — Issue #956
 *
 * Runs against all major page routes using Playwright + @axe-core/playwright.
 * Fails CI if any critical or serious violations are found.
 *
 * Known violations that are pending remediation are listed in the
 * `KNOWN_VIOLATIONS` map below with a linked issue for each.
 *
 * To update snapshots / re-baseline known violations:
 *   npx playwright test e2e/accessibility.spec.js --update-snapshots
 */

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

/**
 * Known violations pending remediation.
 * Key: route path. Value: array of axe rule IDs to exclude for that route.
 *
 * Add entries here only when a violation is confirmed as pre-existing and a
 * remediation issue has been filed. Remove entries once the fix is merged.
 */
const KNOWN_VIOLATIONS = {
  // Example (remove once fixed):
  // '/dashboard': ['color-contrast'],
};

/**
 * Routes to test. Each entry is { path, name, requiresAuth }.
 * Auth-required routes are tested with a mocked session cookie so the page
 * renders real content rather than a redirect.
 */
const PUBLIC_ROUTES = [
  { path: '/', name: 'Landing page' },
  { path: '/login', name: 'Login page' },
  { path: '/register', name: 'Register page' },
  { path: '/forgot-password', name: 'Forgot password page' },
  { path: '/404', name: '404 error page' },
  { path: '/500', name: '500 error page' },
  { path: '/wallet-not-connected', name: 'Wallet not connected page' },
];

const AUTH_ROUTES = [
  { path: '/dashboard', name: 'Dashboard page' },
  { path: '/rewards', name: 'Rewards page' },
  { path: '/campaigns', name: 'Campaigns page' },
  { path: '/history', name: 'Transaction history page' },
  { path: '/leaderboard', name: 'Leaderboard page' },
  { path: '/profile', name: 'Profile page' },
  { path: '/settings', name: 'Settings page' },
  { path: '/analytics', name: 'Analytics page' },
  { path: '/merchant', name: 'Merchant page' },
  { path: '/staking', name: 'Staking page' },
];

/**
 * Build an AxeBuilder for a page, excluding known violations for that route.
 */
function buildAxe(page, routePath) {
  const excluded = KNOWN_VIOLATIONS[routePath] ?? [];
  let builder = new AxeBuilder({ page })
    // Only fail on critical and serious violations per acceptance criteria
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

  if (excluded.length > 0) {
    builder = builder.disableRules(excluded);
  }

  return builder;
}

/**
 * Assert no critical/serious violations and produce a readable failure message.
 */
async function assertNoViolations(page, routePath) {
  const results = await buildAxe(page, routePath).analyze();

  const criticalOrSerious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );

  if (criticalOrSerious.length > 0) {
    const details = criticalOrSerious
      .map(
        (v) =>
          `[${v.impact.toUpperCase()}] ${v.id}: ${v.description}\n` +
          v.nodes
            .slice(0, 3)
            .map((n) => `  Element: ${n.target.join(', ')}\n  Fix: ${n.failureSummary}`)
            .join('\n')
      )
      .join('\n\n');

    throw new Error(
      `${criticalOrSerious.length} critical/serious accessibility violation(s) on ${routePath}:\n\n${details}`
    );
  }
}

// ── Public routes (no auth required) ─────────────────────────────────────────

for (const { path, name } of PUBLIC_ROUTES) {
  test(`[a11y] ${name} (${path}) has no critical/serious violations`, async ({ page }) => {
    await page.goto(path);
    // Wait for the page to be interactive before scanning
    await page.waitForLoadState('networkidle');
    await assertNoViolations(page, path);
  });
}

// ── Auth-required routes ──────────────────────────────────────────────────────
// We inject a mock auth cookie so the page renders its real content.
// In CI the backend is not running, so pages that fail to load data will still
// render their skeleton/empty states — which are what we want to test.

for (const { path, name } of AUTH_ROUTES) {
  test(`[a11y] ${name} (${path}) has no critical/serious violations`, async ({ page, context }) => {
    // Inject a mock JWT so auth-gated pages don't immediately redirect
    await context.addCookies([
      {
        name: 'nova_token',
        value: 'mock-ci-token',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
      },
    ]);

    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await assertNoViolations(page, path);
  });
}

// ── Interactive state tests ───────────────────────────────────────────────────

test('[a11y] Login form with validation errors has no critical/serious violations', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Submit empty form to trigger validation errors
  const submitBtn = page.locator('button[type="submit"]').first();
  if (await submitBtn.isVisible()) {
    await submitBtn.click();
    await page.waitForTimeout(300);
  }

  await assertNoViolations(page, '/login');
});

test('[a11y] Register form with validation errors has no critical/serious violations', async ({ page }) => {
  await page.goto('/register');
  await page.waitForLoadState('networkidle');

  const submitBtn = page.locator('button[type="submit"]').first();
  if (await submitBtn.isVisible()) {
    await submitBtn.click();
    await page.waitForTimeout(300);
  }

  await assertNoViolations(page, '/register');
});
