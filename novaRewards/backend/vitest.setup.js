import { vi, expect } from 'vitest';

// Expose shared backend test utilities globally
global.testUtils = require('./tests/utils');

// Expose jest as global for backwards compatibility with existing tests
// jest.fn() returns a mock function that needs to have all mock methods
global.jest = {
  fn: (...args) => {
    const mock = vi.fn(...args);
    return mock;
  },
  mock: vi.mock,
  clearAllMocks: vi.clearAllMocks,
  resetAllMocks: vi.resetAllMocks,
  restoreAllMocks: vi.restoreAllMocks,
};

// Suppress console.error during tests to reduce noise from expected validation errors
vi.spyOn(console, 'error').mockImplementation(() => {});

// ── Custom matchers ───────────────────────────────────────────────────────
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
