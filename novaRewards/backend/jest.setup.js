'use strict';

/**
 * Jest setupFilesAfterEnv — runs inside each worker after the Jest framework
 * is installed. Safe to use jest.spyOn / jest.fn / expect.extend here.
 *
 * This file runs before every test file, so keep it lean.
 */

// ── Silence expected noise ────────────────────────────────────────────────
// console.error is spied on globally so validation-error logs don't pollute
// test output. Individual tests can restore it with jest.restoreAllMocks().
jest.spyOn(console, 'error').mockImplementation(() => {});

// ── Global test timeout ───────────────────────────────────────────────────
// Matches the value in jest.config.js; set here as well so it applies even
// when jest.config.js is not loaded (e.g. --config override in one-off runs).
jest.setTimeout(15000);

// ── Custom matchers ───────────────────────────────────────────────────────
/**
 * .toBeValidJwt()
 * Asserts that a value is a string with the three-part JWT structure.
 */
expect.extend({
  toBeValidJwt(received) {
    const pass =
      typeof received === 'string' &&
      received.split('.').length === 3 &&
      received.length > 20;
    return {
      pass,
      message: () =>
        pass
          ? `expected "${received}" NOT to be a valid JWT`
          : `expected a three-part JWT string, received: ${JSON.stringify(received)}`,
    };
  },
});
