'use strict';

// Mock dependencies before requiring the module under test
jest.mock('../services/auditService');
jest.mock('../services/securityAlertService');
jest.mock('../db/index', () => ({ query: jest.fn() }));
jest.mock('../services/tokenService', () => ({ verifyToken: jest.fn() }));

const fc = require('fast-check');
const AuditService = require('../services/auditService');
const SecurityAlertService = require('../services/securityAlertService');
const { requireAdmin } = require('../middleware/authenticateUser');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeReq({ role, id = 42, path = '/api/admin/users', method = 'GET', ip = '127.0.0.1' } = {}) {
  return {
    user: role !== undefined ? { id, role } : undefined,
    path,
    method,
    ip,
    headers: {},
  };
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  AuditService.log = jest.fn().mockResolvedValue(undefined);
  SecurityAlertService.send = jest.fn().mockResolvedValue(undefined);
});

// ─── Unit Tests (subtask 4.3) ────────────────────────────────────────────────

describe('requireAdmin — unit tests', () => {
  test('returns 403 + forbidden for non-admin authenticated user', async () => {
    const req = makeReq({ role: 'user' });
    const res = makeRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'forbidden' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('calls AuditService.log with correct payload for non-admin authenticated user', async () => {
    const req = makeReq({ role: 'merchant', id: 7, path: '/api/admin/rewards', method: 'POST', ip: '10.0.0.1' });
    const res = makeRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(AuditService.log).toHaveBeenCalledTimes(1);
    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRIVILEGE_ESCALATION_ATTEMPT',
        entityType: 'admin_endpoint',
        entityId: null,
        performedBy: 7,
        source: 'api',
        details: expect.objectContaining({
          method: 'POST',
          role: 'merchant',
          ip: '10.0.0.1',
          entityId: '/api/admin/rewards',
        }),
      })
    );
  });

  test('does NOT call AuditService.log for unauthenticated request (no req.user)', async () => {
    const req = makeReq(); // no role → req.user is undefined
    const res = makeRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(AuditService.log).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 403 even when AuditService.log throws', async () => {
    AuditService.log = jest.fn().mockRejectedValue(new Error('DB down'));
    const req = makeReq({ role: 'user' });
    const res = makeRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'forbidden' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('calls SecurityAlertService.send for non-admin authenticated user', async () => {
    const req = makeReq({ role: 'user', id: 5 });
    const res = makeRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(SecurityAlertService.send).toHaveBeenCalledTimes(1);
    const callArg = SecurityAlertService.send.mock.calls[0][0];
    expect(callArg).toMatchObject({
      action: 'PRIVILEGE_ESCALATION_ATTEMPT',
      performedBy: 5,
    });
    expect(typeof callArg.timestamp).toBe('string');
  });

  test('calls next() for admin user', async () => {
    const req = makeReq({ role: 'admin' });
    const res = makeRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(AuditService.log).not.toHaveBeenCalled();
    expect(SecurityAlertService.send).not.toHaveBeenCalled();
  });
});

// ─── Property Tests ──────────────────────────────────────────────────────────

// Feature: admin-auth-privilege-escalation, Property 1: Non-admin role is always rejected at the route guard
// Validates: Requirements 1.3
describe('requireAdmin — Property 1: Non-admin role is always rejected at the route guard', () => {
  test('arbitrary non-admin role strings always produce 403 + forbidden', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string().filter(s => s !== 'admin'),
          fc.constantFrom('user', 'merchant')
        ),
        async (role) => {
          jest.clearAllMocks();
          AuditService.log = jest.fn().mockResolvedValue(undefined);
          SecurityAlertService.send = jest.fn().mockResolvedValue(undefined);

          const req = makeReq({ role });
          const res = makeRes();
          const next = jest.fn();

          await requireAdmin(req, res, next);

          expect(res.status).toHaveBeenCalledWith(403);
          const jsonArg = res.json.mock.calls[0][0];
          expect(jsonArg).toMatchObject({ success: false, error: 'forbidden' });
          expect(next).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: admin-auth-privilege-escalation, Property 2: Security event recorded for every authenticated non-admin escalation attempt
// Validates: Requirements 3.1, 3.2
describe('requireAdmin — Property 2: Security event recorded for every authenticated non-admin escalation attempt', () => {
  test('AuditService.log called exactly once with all required fields for any non-admin authenticated request', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 100000 }),
          role: fc.oneof(
            fc.string().filter(s => s !== 'admin'),
            fc.constantFrom('user', 'merchant')
          ),
          path: fc.webPath(),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
          ip: fc.ipV4(),
        }),
        async ({ userId, role, path, method, ip }) => {
          jest.clearAllMocks();
          AuditService.log = jest.fn().mockResolvedValue(undefined);
          SecurityAlertService.send = jest.fn().mockResolvedValue(undefined);

          const req = {
            user: { id: userId, role },
            path,
            method,
            ip,
            headers: {},
          };
          const res = makeRes();
          const next = jest.fn();

          await requireAdmin(req, res, next);

          // AuditService.log must be called exactly once
          expect(AuditService.log).toHaveBeenCalledTimes(1);

          const logArg = AuditService.log.mock.calls[0][0];

          // Verify all required fields
          expect(logArg.action).toBe('PRIVILEGE_ESCALATION_ATTEMPT');
          expect(logArg.entityType).toBe('admin_endpoint');
          expect(logArg.entityId).toBeNull();
          expect(logArg.performedBy).toBe(userId);
          expect(logArg.source).toBe('api');
          expect(logArg.details.method).toBe(method);
          expect(logArg.details.role).toBe(role);
          expect(logArg.details.ip).toBe(ip);
          expect(logArg.details.entityId).toBe(path);
        }
      ),
      { numRuns: 100 }
    );
  });
});
