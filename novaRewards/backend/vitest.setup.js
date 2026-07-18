import { vi, expect } from 'vitest';

// Expose shared backend test utilities globally (optional — some test files use these)
try {
  global.testUtils = require('./tests/utils');
} catch {
  // Silently skip if test utils cannot be loaded in this environment
}

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
