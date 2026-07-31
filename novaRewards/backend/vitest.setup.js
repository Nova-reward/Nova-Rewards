import { vi, expect } from 'vitest';

// Expose shared backend test utilities globally (optional — some test files use these)
try {
  global.testUtils = require('./tests/utils');
} catch {
  // Silently skip if test utils cannot be loaded in this environment
}

// ---------------------------------------------------------------------------
// Jest compatibility shim
// ---------------------------------------------------------------------------
// Expose jest as global for backwards compatibility with existing tests
// that were written for Jest but run under Vitest.
global.jest = {
  fn: (...args) => vi.fn(...args),
  mock: vi.mock,
  unmock: vi.unmock,
  clearAllMocks: vi.clearAllMocks,
  resetAllMocks: vi.resetAllMocks,
  restoreAllMocks: vi.restoreAllMocks,
  resetModules: vi.resetModules,
  useFakeTimers: (...args) => vi.useFakeTimers(...args),
  useRealTimers: () => vi.useRealTimers(),
  advanceTimersByTime: (ms) => vi.advanceTimersByTime(ms),
  runAllTimers: () => vi.runAllTimers(),
  spyOn: (...args) => vi.spyOn(...args),
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
