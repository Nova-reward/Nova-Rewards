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

const sharedConfig = {
  testEnvironment: 'node',
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
};
