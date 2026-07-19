// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright Configuration for Nova Rewards E2E Tests
 * 
 * Supports both desktop and mobile testing
 * Can run against local dev server or staging environment
 * 
 * Environment variables:
 *   - CI: Set to true in CI/CD pipeline
 *   - BASE_URL: Override base URL (default: http://localhost:3000)
 *   - STAGING_URL: When set, tests run against this URL instead of starting a local server
 *   - TESTNET_MODE: Set to true to test against testnet
 */

const stagingUrl = process.env.STAGING_URL;
const baseURL = stagingUrl || process.env.BASE_URL || 'http://localhost:3000';
const isCI = !!process.env.CI;
const isTestnet = !!process.env.TESTNET_MODE;
const useRemote = !!(stagingUrl || isTestnet);

module.exports = defineConfig({
  testDir: './e2e',
  
  // Run tests sequentially for reward issuance (state-dependent tests)
  fullyParallel: false,
  
  // Allow one retry in CI to handle flaky startup timing
  retries: isCI ? 1 : 0,
  
  // Set test timeout to 60s for slow testnet interactions
  timeout: 60_000,
  
  // Expect timeout for assertions
  expect: {
    timeout: 10_000,
  },
  
  // HTML reporter with screenshots
  reporter: [
    ['html', { outputFolder: './playwright-report' }],
    ['junit', { outputFile: './test-results/junit.xml' }],
    ['json', { outputFile: './test-results/results.json' }],
  ],
  
  // Global test settings
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  // Browser projects
  // Names must match the project names used in the CI matrix: chromium, firefox, webkit
  projects: [
    // Chromium (Desktop Chrome) — primary project used by e2e.yml CI matrix
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // Firefox (Desktop Firefox) — used by e2e.yml CI matrix
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },

    // WebKit (Desktop Safari) — used by e2e.yml CI matrix
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },

    // Legacy alias kept for ci.yml (--project=chromium-desktop)
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // Mobile — optional (out of scope per issue #1145)
    // Uncomment to enable:
    // {
    //   name: 'chromium-mobile',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],
  
  // Web server configuration — only started when not hitting a remote URL
  webServer: useRemote
    ? undefined // Don't start a local server when testing remote staging/testnet
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
  
  // Global setup/teardown hooks (only for testnet flows)
  globalSetup: isTestnet ? require.resolve('./e2e/global-setup.js') : undefined,
  globalTeardown: isTestnet ? require.resolve('./e2e/global-teardown.js') : undefined,
});
