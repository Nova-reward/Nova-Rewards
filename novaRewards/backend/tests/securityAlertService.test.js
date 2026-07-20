'use strict';

// Feature: admin-auth-privilege-escalation
const fc = require('fast-check');
const SecurityAlertService = require('../services/securityAlertService');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal valid payload that mirrors what requireAdmin passes to send().
 */
function makePayload(overrides = {}) {
  return {
    action: 'PRIVILEGE_ESCALATION_ATTEMPT',
    performedBy: 42,
    entityId: '/api/admin/users',
    details: {
      method: 'GET',
      role: 'user',
      ip: '203.0.113.5',
    },
    timestamp: '2026-04-01T12:00:00.000Z',
    ...overrides,
  };
}

// ── Property-Based Tests ──────────────────────────────────────────────────────

describe('SecurityAlertService — property tests', () => {
  // Feature: admin-auth-privilege-escalation, Property 7: Alert payload contains all required fields
  // Validates: Requirements 4.2
  test('Property 7: emitted log entry contains all required fields for arbitrary security events', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          action: fc.constantFrom(
            'PRIVILEGE_ESCALATION_ATTEMPT',
            'ROLE_CHANGE'
          ),
          performedBy: fc.integer({ min: 1, max: 1_000_000 }),
          entityId: fc.string({ minLength: 1, maxLength: 50 }).map((s) => `/api/${s}`),
          details: fc.record({
            method: fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
            role: fc.oneof(fc.constantFrom('user', 'merchant'), fc.string({ minLength: 1, maxLength: 20 })),
            ip: fc.tuple(
              fc.integer({ min: 1, max: 254 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 1, max: 254 })
            ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
          }),
          timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
            .map((d) => d.toISOString()),
        }),
        async (payload) => {
          warnSpy.mockClear();

          await SecurityAlertService.send(payload);

          expect(warnSpy).toHaveBeenCalledTimes(1);

          const emitted = JSON.parse(warnSpy.mock.calls[0][0]);

          // All required fields must be present
          expect(emitted).toHaveProperty('event_type', payload.action);
          expect(emitted).toHaveProperty('user_id', payload.performedBy);
          expect(emitted).toHaveProperty('target_endpoint', payload.entityId);
          expect(emitted).toHaveProperty('method', payload.details.method);
          expect(emitted).toHaveProperty('role', payload.details.role);
          expect(emitted).toHaveProperty('ip', payload.details.ip);
          expect(emitted).toHaveProperty('timestamp', payload.timestamp);

          // Structural fields
          expect(emitted).toHaveProperty('level', 'warn');
          expect(emitted).toHaveProperty('security_event', true);
        }
      ),
      { numRuns: 100 }
    );

    warnSpy.mockRestore();
  });
});

// ── Unit Tests ────────────────────────────────────────────────────────────────

describe('SecurityAlertService — unit tests', () => {
  describe('3.2.1 — emits structured log with all required fields', () => {
    test('emits a JSON line to console.warn with all required fields', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const payload = makePayload();
      await SecurityAlertService.send(payload);

      expect(warnSpy).toHaveBeenCalledTimes(1);

      const emitted = JSON.parse(warnSpy.mock.calls[0][0]);
      expect(emitted.level).toBe('warn');
      expect(emitted.security_event).toBe(true);
      expect(emitted.event_type).toBe('PRIVILEGE_ESCALATION_ATTEMPT');
      expect(emitted.user_id).toBe(42);
      expect(emitted.target_endpoint).toBe('/api/admin/users');
      expect(emitted.method).toBe('GET');
      expect(emitted.role).toBe('user');
      expect(emitted.ip).toBe('203.0.113.5');
      expect(emitted.timestamp).toBe('2026-04-01T12:00:00.000Z');
    });

    test('emits valid JSON (parseable string)', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await SecurityAlertService.send(makePayload());

      const raw = warnSpy.mock.calls[0][0];
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  });

  describe('3.2.2 — retries up to 3 times on delivery failure', () => {
    test('retries when console.warn throws on first attempt', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      let callCount = 0;
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        callCount += 1;
        if (callCount < 3) throw new Error('transient failure');
      });

      // Speed up by replacing _sleep with a no-op
      jest.spyOn(SecurityAlertService, '_sleep').mockResolvedValue(undefined);

      await SecurityAlertService.send(makePayload());

      // Should have been called 3 times (2 failures + 1 success)
      expect(callCount).toBe(3);
    });

    test('retries exactly twice before succeeding on third attempt', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      let callCount = 0;
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        callCount += 1;
        if (callCount <= 2) throw new Error('transient failure');
      });

      jest.spyOn(SecurityAlertService, '_sleep').mockResolvedValue(undefined);

      await SecurityAlertService.send(makePayload());

      expect(callCount).toBe(3);
      // No final error logged because it succeeded on attempt 3
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('3.2.3 — does not retry more than 3 times', () => {
    test('stops after 3 failed attempts and does not call console.warn a 4th time', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      let callCount = 0;
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        callCount += 1;
        throw new Error('persistent failure');
      });

      jest.spyOn(SecurityAlertService, '_sleep').mockResolvedValue(undefined);

      await SecurityAlertService.send(makePayload());

      // Must not exceed 3 attempts
      expect(callCount).toBe(3);
    });

    test('resolves (does not throw) even after 3 failures', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {
        throw new Error('persistent failure');
      });
      jest.spyOn(SecurityAlertService, '_sleep').mockResolvedValue(undefined);

      // Must always resolve — never reject
      await expect(SecurityAlertService.send(makePayload())).resolves.toBeUndefined();
    });
  });

  describe('3.2.4 — logs final failure after max retries', () => {
    test('calls console.error after 3 failed attempts', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {
        throw new Error('persistent failure');
      });
      jest.spyOn(SecurityAlertService, '_sleep').mockResolvedValue(undefined);

      await SecurityAlertService.send(makePayload());

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toMatch(
        /Failed to deliver security alert after 3 attempts/
      );
    });

    test('does NOT call console.error when delivery succeeds on first attempt', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      await SecurityAlertService.send(makePayload());

      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('exponential back-off delays', () => {
    test('waits 1000 ms before second attempt', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      let callCount = 0;
      jest.spyOn(console, 'warn').mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) throw new Error('fail once');
      });

      const sleepSpy = jest
        .spyOn(SecurityAlertService, '_sleep')
        .mockResolvedValue(undefined);

      await SecurityAlertService.send(makePayload());

      // First retry: attempt=1 → delay = 2^(1-1)*1000 = 1000 ms
      expect(sleepSpy).toHaveBeenCalledWith(1000);
    });

    test('waits 2000 ms before third attempt', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      let callCount = 0;
      jest.spyOn(console, 'warn').mockImplementation(() => {
        callCount += 1;
        if (callCount <= 2) throw new Error('fail twice');
      });

      const sleepSpy = jest
        .spyOn(SecurityAlertService, '_sleep')
        .mockResolvedValue(undefined);

      await SecurityAlertService.send(makePayload());

      // Second retry: attempt=2 → delay = 2^(2-1)*1000 = 2000 ms
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000);
    });
  });
});
