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
      testIgnore: '**/accessibility.spec.js',
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: '**/accessibility.spec.js',
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: '**/accessibility.spec.js',
    },
    // Mobile browsers
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
    // Accessibility — axe-core scans on Chromium only (Issue #956)
    {
      name: 'accessibility',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/accessibility.spec.js',
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
