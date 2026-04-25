// Expose shared backend test utilities for Jest-based tests.
global.testUtils = require('./tests/utils');

// Suppress console.error during tests to reduce noise from expected validation errors
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
