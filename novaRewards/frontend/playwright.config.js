// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright Configuration for Nova Rewards E2E Tests
 * 
 * Supports both desktop and mobile testing
 * Can run against local dev server or remote testnet
 * 
 * Environment variables:
 *   - CI: Set to true in CI/CD pipeline
 *   - BASE_URL: Override base URL (default: http://localhost:3000)
 *   - TESTNET_MODE: Set to true to test against testnet
 */

const baseURL = process.env.BASE_URL || 'http://localhost:3000';
const isCI = !!process.env.CI;
const isTestnet = !!process.env.TESTNET_MODE;

module.exports = defineConfig({
  testDir: './e2e',
  
  // Run tests sequentially for reward issuance (state-dependent tests)
  fullyParallel: false,
  
  // Disable retries - E2E tests are deterministic or should fail fast
  retries: 0,
  
  // Set test timeout to 60s for slow testnet interactions
  timeout: 60_000,
  
  // Expect timeout for assertions
  expect: {
    timeout: 5_000,
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
  projects: [
    // Desktop Chrome - primary testing
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        // Disable headless for local debugging
        headless: isCI || isTestnet,
      },
    },
    
    // Mobile - optional (out of scope per issue #1145)
    // Uncomment to enable:
    // {
    //   name: 'chromium-mobile',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],
  
  // Web server configuration
  webServer: isTestnet
    ? null // Don't start server when testing remote testnet
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
  
  // Global setup/teardown hooks
  globalSetup: isTestnet ? require.resolve('./e2e/global-setup.js') : undefined,
  globalTeardown: isTestnet ? require.resolve('./e2e/global-teardown.js') : undefined,
});
