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
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/tests/load/',   // k6 / artillery load scripts are not Jest tests
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
    'middleware/**/*.js',
    'services/**/*.js',
    'dtos/**/*.js',
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
      lines:      80,
      functions:  80,
      branches:   75,
      statements: 80,
    },
    // Auth paths are security-critical — hold them to a higher bar
    './routes/auth.js': {
      lines:      90,
      functions:  90,
      branches:   85,
      statements: 90,
    },
    './middleware/authenticateUser.js': {
      lines:      90,
      functions:  90,
      branches:   85,
      statements: 90,
    },
    './dtos/registerDto.js': {
      lines:      95,
      functions:  95,
      branches:   90,
      statements: 95,
    },
    './dtos/loginDto.js': {
      lines:      95,
      functions:  95,
      branches:   90,
      statements: 95,
    },
    './services/tokenService.js': {
      lines:      90,
      functions:  90,
      branches:   85,
      statements: 90,
    },
  },

  // ── Reporters ─────────────────────────────────────────────────────────────
  reporters: [
    // Default reporter: coloured summary in the terminal
    'default',
    // JUnit XML consumed by GitHub Actions test-results and most CI dashboards.
    // Only emit in CI to avoid cluttering local runs.
    ...(process.env.CI
      ? [['jest-junit', {
          outputDirectory: 'coverage',
          outputName:      'junit.xml',
          classNameTemplate: '{classname}',
          titleTemplate:     '{title}',
          ancestorSeparator: ' › ',
        }]]
      : []),
  ],

  // ── Module resolution ─────────────────────────────────────────────────────
  // Map bare module names that need special handling in tests.
  // Currently empty — add entries here if you introduce path aliases.
  moduleNameMapper: {},

  // Ignore transforming node_modules (Jest default) plus any compiled output
  transformIgnorePatterns: ['/node_modules/', '/dist/'],
};
