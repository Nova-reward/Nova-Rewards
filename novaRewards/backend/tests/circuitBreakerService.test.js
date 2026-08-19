/**
 * Unit tests for CircuitBreakerService (issue #1230).
 *
 * Covers the circuit-open threshold, fallback invocation, retry exhaustion,
 * and successful-call paths. The logger is mocked so tests have no side
 * effects; opossum itself is exercised for real.
 */
vi.mock('../lib/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
  stream: jest.fn(),
}));

const service = require('../services/circuitBreakerService');

describe('CircuitBreakerService', () => {
  beforeEach(() => {
    // The service is a singleton; isolate each test by clearing created breakers.
    service.breakers.clear();
  });

  it('returns the expected value from a successful call', async () => {
    const ok = jest.fn().mockResolvedValue('success');
    const result = await service.execute('success-path', ok);
    expect(result).toBe('success');
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('opens the circuit once errorThresholdPercentage is exceeded', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('boom'));
    const breaker = service.getBreaker('open-threshold', failing, {
      errorThresholdPercentage: 50,
      volumeThreshold: 1,
    });
    // First failure trips the breaker open (100% of the 1-request volume).
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      try {
        await breaker.fire();
      } catch (_) {
        /* expected */
      }
    }
    // A subsequent fire must be rejected because the circuit is open.
    await expect(breaker.fire()).rejects.toThrow(/open/i);
  });

  it('invokes the fallback when the circuit is open and a fallback is provided', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('boom'));
    // Trip the breaker open first.
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      try {
        await service.execute('fallback-path', failing, null, {
          errorThresholdPercentage: 50,
          volumeThreshold: 1,
        });
      } catch (_) {
        /* expected */
      }
    }
    const fallback = jest.fn().mockReturnValue('fallback-value');
    const result = await service.execute(
      'fallback-path',
      failing,
      fallback,
      { errorThresholdPercentage: 50, volumeThreshold: 1 },
    );
    expect(result).toBe('fallback-value');
    expect(fallback).toHaveBeenCalled();
  });

  it('retries exactly `retries` times before re-throwing', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('fail'));
    await expect(
      service.execute('retry-path', failing, null, {
        errorThresholdPercentage: 50,
        volumeThreshold: 100, // keep the circuit closed so only the retry loop governs
        retries: 2,
      }),
    ).rejects.toThrow('fail');
    // initial attempt + 2 retries => 3 invocations total
    expect(failing).toHaveBeenCalledTimes(3);
  });

  it('does not retry when retries is 0 and the call fails', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('fail'));
    await expect(
      service.execute('no-retry', failing, null, {
        errorThresholdPercentage: 50,
        volumeThreshold: 100,
        retries: 0,
      }),
    ).rejects.toThrow('fail');
    expect(failing).toHaveBeenCalledTimes(1);
  });
});
