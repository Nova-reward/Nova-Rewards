// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * playwright.config.js — NovaRewards Playwright test configuration.
 *
 * Comprehensive E2E test suite configuration for Nova Rewards blockchain loyalty platform.
 * Supports local development, Docker, and GitHub Actions CI/CD.
 *
 * Test Environments
 * ─────────────────
 * LOCAL DEVELOPMENT:
 *   docker-compose up -d             # Start PostgreSQL + Backend
 *   cd frontend && npm run dev        # Start Next.js
 *   npx playwright test               # Run tests (reuses running servers)
 *
 * DOCKER (CI/CD):
 *   docker-compose up --wait          # Start all services (wait for health checks)
 *   docker exec nova-rewards-backend  # Seed test data
 *   npx playwright test               # Run tests headlessly
 *
 * GITHUB ACTIONS:
 *   Automatically starts Docker Compose, waits for health, and runs tests.
 *   Collects artifacts: HTML report, traces, screenshots, videos on failure.
 *
 * Projects
 * ────────
 *  desktop-chromium   Main project: all feature E2E tests (register, campaign, reward, balance)
 *  chromium-mobile    Mobile regression: Pixel 5 layout tests
 *  webkit-mobile      Mobile regression: iPhone 12 layout tests
 *
 * Servers
 * ───────
 *  Frontend (Next.js): Managed by Playwright via webServer block.
 *    - In CI:    Always start fresh (fail-fast on port conflicts)
 *    - Locally:  Reuse running dev server to avoid restart overhead
 *
 *  Backend (Node.js + PostgreSQL + Redis): Started separately before tests.
 *    Local:  docker-compose up -d && cd backend && npm start
 *    CI:     docker-compose up --wait (health checks ensure readiness)
 *
 * Environment Variables
 * ─────────────────────
 *  CI                         Set by GitHub Actions (enables Docker startup, retries)
 *  PLAYWRIGHT_FRONTEND_URL    Frontend base URL (default: http://localhost:3000)
 *  PLAYWRIGHT_BACKEND_URL     Backend API URL (default: http://localhost:3001)
 *  STELLAR_NETWORK            testnet or mainnet (used by backend seed)
 *
 * Artifacts (CI Only)
 * ───────────────────
 *  - HTML report:   playwright-report/index.html
 *  - Test traces:   test-results/traces/
 *  - Screenshots:   test-results/screenshots/
 *  - Videos:        test-results/videos/
 *  - Logs:          test-results/logs/
 *
 * @see https://playwright.dev/docs/test-configuration
 * @see ../e2e/README.md for quick start guide
 * @see ../e2e/IMPLEMENTATION_COMPLETE.md for architecture details
 */
module.exports = defineConfig({
  testDir: './e2e',
  testTimeout: 60_000, // 60s per test (includes polling)
  globalTimeout: 30 * 60_000, // 30m total suite timeout

  /* Run specs in parallel — each spec file gets its own worker.
   * Individual tests inside specs may run serially if they share state. */
  fullyParallel: true,

  /* Retry strategy: absorb transient issues in CI; fail fast locally. */
  retries: process.env.CI ? 1 : 0,

  /* Parallelism: limit locally to avoid backend overload; use all CPUs in CI. */
  workers: process.env.CI ? undefined : 2,

  /* Reporters: GitHub annotations in CI, interactive HTML locally. */
  reporter: [
    ...(process.env.CI
      ? [
          ['github'], // GitHub Actions annotations
          ['html', { outputFolder: 'playwright-report', open: 'never' }],
          ['list'], // Log summary
        ]
      : [['html', { open: 'on-failure' }]]),
    ['junit', { outputFile: 'test-results/junit.xml' }], // For CI parsing
  ],

  use: {
    /* Base URL for page.goto('/merchant') navigation. */
    baseURL: process.env.PLAYWRIGHT_FRONTEND_URL || 'http://localhost:3000',

    /* Trace collection: full on first retry (useful for debugging CI flakes). */
    trace: 'on-first-retry',

    /* Screenshots: only on failure (keeps artifacts lean). */
    screenshot: 'only-on-failure',

    /* Video: only on failure (useful for debugging UI issues in CI). */
    video: 'retain-on-failure',

    /* Navigation & action timeouts (match backend polling timeouts). */
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },

  /* Output folder for test artifacts. */
  outputFolder: 'test-results',

  projects: [
    // ── Feature tests (reward issuance, auth, campaigns, …) ────────────────
    // All specs run on desktop-chromium. Mobile tests run only on mobile projects.
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Explicit viewport for deterministic screenshots
        viewport: { width: 1280, height: 800 },
      },
    },

    // ── Mobile layout regression tests ──────────────────────────────────────
    // Only run mobile-overflow.spec.js on mobile projects to avoid redundant full suite runs.
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
      testMatch: '**/mobile-overflow.spec.js',
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 12'] },
      testMatch: '**/mobile-overflow.spec.js',
    },
  ],

  /* Start the Next.js dev server before tests run.
   * The backend must already be running (docker-compose up -d && npm start).
   *
   * reuseExistingServer behavior:
   *   - CI (GitHub Actions):  Always start fresh (fail-fast on port conflicts)
   *   - Local development:    Reuse running dev server (faster iteration)
   */
  webServer: {
    command: 'npm run dev',
    url: process.env.PLAYWRIGHT_FRONTEND_URL || 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // 2m to start Next.js dev server
    /* Suppress stdout noise in CI (but always capture stderr). */
    stdout: process.env.CI ? 'ignore' : 'pipe',
    stderr: 'pipe',
  },

  /* Expect configuration for assertions. */
  expect: {
    timeout: 15_000,
  },
});
