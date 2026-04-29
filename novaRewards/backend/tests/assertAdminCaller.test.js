'use strict';

// Feature: admin-auth-privilege-escalation
const fc = require('fast-check');
const assertAdminCaller = require('../middleware/assertAdminCaller');
const AuthorizationError = require('../errors/AuthorizationError');

// ── Unit Tests ────────────────────────────────────────────────────────────────

describe('assertAdminCaller — unit tests', () => {
  describe('throws AuthorizationError for non-admin roles', () => {
    test.each([
      ['user'],
      ['merchant'],
      [''],
      [null],
      [undefined],
    ])('throws for callerRole = %j', (role) => {
      expect(() => assertAdminCaller(role)).toThrow(AuthorizationError);
    });

    test('thrown error has correct message', () => {
      expect(() => assertAdminCaller('user')).toThrow(
        'Caller does not have admin privileges'
      );
    });

    test('thrown error has status 403', () => {
      try {
        assertAdminCaller('merchant');
      } catch (err) {
        expect(err.status).toBe(403);
      }
    });

    test('thrown error has code "forbidden"', () => {
      try {
        assertAdminCaller('user');
      } catch (err) {
        expect(err.code).toBe('forbidden');
      }
    });

    test('thrown error has name "AuthorizationError"', () => {
      try {
        assertAdminCaller('');
      } catch (err) {
        expect(err.name).toBe('AuthorizationError');
      }
    });
  });

  describe('does not throw for admin role', () => {
    test('does not throw when callerRole is "admin"', () => {
      expect(() => assertAdminCaller('admin')).not.toThrow();
    });

    test('returns undefined for "admin"', () => {
      expect(assertAdminCaller('admin')).toBeUndefined();
    });
  });
});

// ── Property-Based Tests ──────────────────────────────────────────────────────

describe('assertAdminCaller — property tests', () => {
  // Feature: admin-auth-privilege-escalation, Property 3: Service-layer check rejects any non-admin caller role
  // Validates: Requirements 2.1, 2.2, 2.4
  test('Property 3: throws AuthorizationError for any non-admin role string', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary strings that are not 'admin'
        fc.string().filter((s) => s !== 'admin'),
        (role) => {
          expect(() => assertAdminCaller(role)).toThrow(AuthorizationError);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-auth-privilege-escalation, Property 3: Service-layer check rejects any non-admin caller role
  // Validates: Requirements 2.1, 2.2, 2.4
  test('Property 3: throws AuthorizationError for known non-admin role values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('user', 'merchant'),
        (role) => {
          expect(() => assertAdminCaller(role)).toThrow(AuthorizationError);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-auth-privilege-escalation, Property 3: Service-layer check rejects any non-admin caller role
  // Validates: Requirements 2.1, 2.2, 2.4
  test('Property 3: thrown error always has correct message, status, and code for non-admin roles', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s !== 'admin'),
        (role) => {
          try {
            assertAdminCaller(role);
            // Should never reach here
            return false;
          } catch (err) {
            expect(err).toBeInstanceOf(AuthorizationError);
            expect(err.message).toBe('Caller does not have admin privileges');
            expect(err.status).toBe(403);
            expect(err.code).toBe('forbidden');
            return true;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-auth-privilege-escalation, Property 3: Service-layer check rejects any non-admin caller role
  // Validates: Requirements 2.1, 2.4
  test('Property 3: does not throw for "admin" — verified across repeated calls', () => {
    // Verify the positive case is stable
    fc.assert(
      fc.property(
        fc.constant('admin'),
        (role) => {
          expect(() => assertAdminCaller(role)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
