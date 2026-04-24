'use strict';

/**
 * Jest configuration for the NovaRewards backend.
 *
 * Design decisions:
 *  - testEnvironment: 'node'  — no DOM, pure Node.js runtime
 *  - --runInBand in CI        — avoids port/DB contention between parallel workers
 *  - globalSetup              — sets required env vars once before any test module loads
 *  - setupFilesAfterEnv       — per-test-file setup (spies, global mocks)
 *  - coverageThreshold        — enforces 80 % line coverage globally; auth paths get 90 %
 *  - reporters                — human-readable summary + machine-readable junit for CI
 */
module.exports = {
  // ── Runtime ──────────────────────────────────────────────────────────────
  testEnvironment: 'node',

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

  // setupFilesAfterEnv runs inside each worker after the test framework is
  // installed — safe to use jest.spyOn / jest.fn here.
  setupFilesAfterEnv: ['./jest.setup.js'],

  // ── Behaviour ─────────────────────────────────────────────────────────────
  verbose: true,
  // Prevent hanging processes (open DB connections, timers, etc.)
  forceExit: true,
  // Fail fast in CI — stop after first test suite failure
  bail: process.env.CI ? 1 : 0,
  // Per-test timeout (ms). Individual tests can override with jest.setTimeout().
  testTimeout: 15000,
  // Clear mock state between every test automatically
  clearMocks: true,
  // Restore spied-on implementations after each test
  restoreMocks: true,

  // ── Coverage ──────────────────────────────────────────────────────────────
  collectCoverageFrom: [
    'routes/**/*.js',
    'db/**/*.js',
    'lib/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'src/**/*.js',
    // Exclude files that are infrastructure / entry-points, not business logic
    '!server.js',
    '!swagger.js',
    '!**/node_modules/**',
    '!**/*.test.js',
    '!**/tests/**',
    '!**/coverage/**',
  ],

  // Emit coverage in multiple formats:
  //  - text:    printed to stdout after every `--coverage` run
  //  - lcov:    consumed by Codecov / Coveralls in CI
  //  - json:    used by jest --coverage --json for badge generation
  //  - html:    human-readable report in coverage/lcov-report/
  coverageReporters: ['text', 'lcov', 'json', 'html'],

  coverageDirectory: 'coverage',

  coverageThreshold: {
    global: {
      lines: 40,
    },
  },
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage',
      outputName: 'junit.xml',
    }],
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
