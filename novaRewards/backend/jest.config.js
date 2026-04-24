'use strict';

/**
 * Jest configuration for the NovaRewards backend.
 *
 * Two projects:
 *  - unit        — existing mocked tests (no real DB required)
 *  - integration — Supertest tests against a real PostgreSQL database
 *                  Run with: jest --selectProjects integration
 *                  Requires DATABASE_URL pointing to a test database.
 */

  // ── Discovery ────────────────────────────────────────────────────────────
  // Pact tests live under pact/ and are excluded here so `npm test` does not
  // run them. Use `npx jest --testPathPattern="pact/"` to run them explicitly.
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/tests/load/',   // k6 / artillery load scripts are not Jest tests
    '/pact/',         // Pact provider tests — run via the pact project only
  ],

  // ── Setup ─────────────────────────────────────────────────────────────────
  // globalSetup runs once in the main process before any test suite.
  // It injects the minimum env vars required by configService / tokenService
  // so tests never depend on a real .env file.
  globalSetup: './jest.global-setup.js',
  setupFilesAfterEnv: ['./jest.setup.js'],
  verbose: true,
  forceExit: true,
  bail: process.env.CI ? 1 : 0,
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
};

module.exports = {
  ...sharedConfig,

  // ── Projects ──────────────────────────────────────────────────────────────
  projects: [
    {
      ...sharedConfig,
      displayName: 'unit',
      testMatch: ['**/tests/**/*.test.js'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/',
        '/tests/load/',
        '/tests/integration/',
      ],
    },
    {
      ...sharedConfig,
      displayName: 'integration',
      testMatch: ['**/tests/integration/**/*.integration.test.js'],
      testPathIgnorePatterns: ['/node_modules/', '/coverage/'],
      // Integration tests need a longer timeout for real DB operations
      testTimeout: 30000,
    },
  ],

  // ── Coverage (collected across all projects) ──────────────────────────────
  collectCoverageFrom: [
    'routes/**/*.js',
    'db/**/*.js',
    'lib/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'src/**/*.js',
    '!server.js',
    '!swagger.js',
    '!**/node_modules/**',
    '!**/*.test.js',
    '!**/tests/**',
    '!**/coverage/**',
  ],
  coverageReporters: ['text', 'lcov', 'json', 'html'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { lines: 40 },
  },
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'coverage', outputName: 'junit.xml' }],
  ],

  // ── Projects ──────────────────────────────────────────────────────────────
  // The `pact` project is defined here so it can be targeted explicitly with
  // `npx jest --selectProjects pact` or `--testPathPattern="pact/"`.
  // It is NOT included in the default test run (`npm test`) because the default
  // testMatch above excludes the pact/ directory.
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/**/*.test.js'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/',
        '/tests/load/',
      ],
      globalSetup: '<rootDir>/jest.global-setup.js',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      clearMocks: true,
      restoreMocks: true,
      forceExit: true,
      testTimeout: 15000,
    },
    {
      displayName: 'pact',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/pact/**/*.pact.test.js'],
      testTimeout: 30000,
      forceExit: true,
    },
  ],
};
