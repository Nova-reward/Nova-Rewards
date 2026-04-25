// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: process.env.STAGING_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      // Allow up to 2% pixel difference to tolerate minor anti-aliasing changes
      maxDiffPixelRatio: 0.02,
      // Wait for fonts and images to fully load before snapshotting
      animations: 'disabled',
    },
  },
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
      // Only run mobile-specific tests on mobile project
      testMatch: '**/mobile-overflow.spec.js',
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 12'] },
      testMatch: '**/mobile-overflow.spec.js',
    },
  ],
  // Skip local webServer when running against staging in CI
  ...(process.env.STAGING_URL
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
