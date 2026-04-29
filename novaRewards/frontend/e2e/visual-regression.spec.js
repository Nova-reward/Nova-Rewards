// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Visual Regression Tests
 *
 * Captures and compares screenshots to detect layout and style regressions
 * across public pages at multiple viewport sizes and across browsers.
 *
 * Run:  npm run test:e2e
 * Update snapshots: npm run test:e2e -- --update-snapshots
 */

// ---------------------------------------------------------------------------
// Viewports
// ---------------------------------------------------------------------------
const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
};

// ---------------------------------------------------------------------------
// Public pages (no authentication required)
// ---------------------------------------------------------------------------
const PUBLIC_PAGES = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
  { name: 'merchant', path: '/merchant' },
  { name: 'leaderboard', path: '/leaderboard' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the page to settle: no pending network requests and no CSS
 * transitions in flight.
 */
async function waitForPageStable(page) {
  await page.waitForLoadState('networkidle');
  // Give CSS transitions a moment to complete
  await page.waitForTimeout(300);
}

/**
 * Disable all CSS animations and transitions so screenshots are deterministic.
 */
async function disableAnimations(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

// ---------------------------------------------------------------------------
// 1. Full-page snapshots – all public pages × all viewports
// ---------------------------------------------------------------------------
for (const { name, path } of PUBLIC_PAGES) {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    test(`[snapshot] ${name} – ${viewportName} (${viewport.width}×${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);
      await waitForPageStable(page);
      await disableAnimations(page);

      await expect(page).toHaveScreenshot(`${name}-${viewportName}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });
  }
}

// ---------------------------------------------------------------------------
// 2. Theme regression – light vs dark mode snapshots on the landing page
// ---------------------------------------------------------------------------
test('[snapshot] landing – light theme', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto('/');
  await waitForPageStable(page);
  await disableAnimations(page);

  // Ensure light mode is applied (remove dark class if present)
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  });

  await expect(page).toHaveScreenshot('landing-theme-light.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});

test('[snapshot] landing – dark theme', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto('/');
  await waitForPageStable(page);
  await disableAnimations(page);

  // Apply dark mode
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  });

  await expect(page).toHaveScreenshot('landing-theme-dark.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});

// ---------------------------------------------------------------------------
// 3. Login page – form interaction states
// ---------------------------------------------------------------------------
test('[snapshot] login – empty form state', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto('/login');
  await waitForPageStable(page);
  await disableAnimations(page);

  await expect(page).toHaveScreenshot('login-form-empty.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});

test('[snapshot] login – validation errors visible', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto('/login');
  await waitForPageStable(page);
  await disableAnimations(page);

  // Submit with empty fields to trigger validation errors
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();
  await page.waitForTimeout(200);

  await expect(page).toHaveScreenshot('login-form-validation-errors.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});

test('[snapshot] login – filled form', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto('/login');
  await waitForPageStable(page);
  await disableAnimations(page);

  // Fill in the form fields
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

  if (await emailInput.isVisible()) {
    await emailInput.fill('testuser@example.com');
  }
  if (await passwordInput.isVisible()) {
    await passwordInput.fill('SecurePassword123');
  }

  await expect(page).toHaveScreenshot('login-form-filled.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});

// ---------------------------------------------------------------------------
// 4. Register page – form interaction states
// ---------------------------------------------------------------------------
test('[snapshot] register – empty form state', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto('/register');
  await waitForPageStable(page);
  await disableAnimations(page);

  await expect(page).toHaveScreenshot('register-form-empty.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});

test('[snapshot] register – validation errors visible', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto('/register');
  await waitForPageStable(page);
  await disableAnimations(page);

  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();
  await page.waitForTimeout(200);

  await expect(page).toHaveScreenshot('register-form-validation-errors.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});

// ---------------------------------------------------------------------------
// 5. Layout regression – no horizontal overflow at any viewport
// ---------------------------------------------------------------------------
for (const { name, path } of PUBLIC_PAGES) {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    test(`[layout] ${name} – no horizontal overflow at ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);
      await waitForPageStable(page);

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - window.innerWidth;
      });

      expect(
        overflow,
        `${path} overflows horizontally by ${overflow}px at ${viewportName}`
      ).toBeLessThanOrEqual(0);
    });
  }
}

// ---------------------------------------------------------------------------
// 6. Layout regression – no element wider than the viewport
// ---------------------------------------------------------------------------
for (const { name, path } of PUBLIC_PAGES) {
  test(`[layout] ${name} – no element exceeds desktop viewport width`, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(path);
    await waitForPageStable(page);

    const offenders = await page.evaluate(() => {
      const vw = window.innerWidth;
      return Array.from(document.querySelectorAll('*'))
        .filter((el) => el.getBoundingClientRect().right > vw + 1)
        .map((el) => ({
          tag: el.tagName,
          className: typeof el.className === 'string' ? el.className : '',
          right: Math.round(el.getBoundingClientRect().right),
        }))
        .slice(0, 10);
    });

    expect(
      offenders,
      `Elements exceed desktop viewport on ${path}: ${JSON.stringify(offenders)}`
    ).toHaveLength(0);
  });
}

// ---------------------------------------------------------------------------
// 7. Responsive navigation – leaderboard page across breakpoints
// ---------------------------------------------------------------------------
test('[snapshot] leaderboard – desktop layout', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto('/leaderboard');
  await waitForPageStable(page);
  await disableAnimations(page);

  await expect(page).toHaveScreenshot('leaderboard-desktop.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});

test('[snapshot] leaderboard – mobile layout', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await page.goto('/leaderboard');
  await waitForPageStable(page);
  await disableAnimations(page);

  await expect(page).toHaveScreenshot('leaderboard-mobile.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});

// ---------------------------------------------------------------------------
// 8. Merchant page – desktop and tablet layouts
// ---------------------------------------------------------------------------
test('[snapshot] merchant – tablet layout', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.tablet);
  await page.goto('/merchant');
  await waitForPageStable(page);
  await disableAnimations(page);

  await expect(page).toHaveScreenshot('merchant-tablet.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});
