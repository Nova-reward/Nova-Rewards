'use strict';

// Mock all external dependencies before requiring the module under test
jest.mock('../db/adminRepository');
jest.mock('../db/userRepository');
jest.mock('../services/auditService');
jest.mock('../services/securityAlertService');
jest.mock('../db/index', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    pool: {
      connect: jest.fn().mockResolvedValue(mockClient),
    },
    query: jest.fn(),
    _mockClient: mockClient,
  };
});

const fc = require('fast-check');

const adminRepository = require('../db/adminRepository');
const userRepository = require('../db/userRepository');
const AuditService = require('../services/auditService');
const SecurityAlertService = require('../services/securityAlertService');
const { pool, _mockClient: mockClient } = require('../db/index');

const {
  createRewardService,
  updateRewardService,
  deleteRewardService,
  listUsersService,
  updateUserRoleService,
} = require('../services/adminService');

const AuthorizationError = require('../errors/AuthorizationError');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  jest.clearAllMocks();

  // Default: transaction client succeeds
  mockClient.query.mockResolvedValue({});
  mockClient.release.mockReturnValue(undefined);
  pool.connect.mockResolvedValue(mockClient);

  // Default: repository stubs
  adminRepository.createReward.mockResolvedValue({ id: 1, name: 'Test' });
  adminRepository.updateReward.mockResolvedValue({ id: 1, name: 'Updated' });
  adminRepository.deleteReward.mockResolvedValue(true);
  adminRepository.listUsers.mockResolvedValue({ users: [], total: 0 });

  userRepository.findById.mockResolvedValue({ id: 42, role: 'user' });
  userRepository.updateUserRole.mockResolvedValue({ id: 42, role: 'merchant', updated_at: new Date() });

  AuditService.log.mockResolvedValue({});
  SecurityAlertService.send.mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Subtask 7.3 — Unit tests
// ---------------------------------------------------------------------------

describe('adminService — unit tests (Subtask 7.3)', () => {
  beforeEach(resetMocks);

  // -------------------------------------------------------------------------
  // AuthorizationError for non-admin callers
  // -------------------------------------------------------------------------

  describe('createRewardService', () => {
    test('throws AuthorizationError when callerRole is "user"', async () => {
      await expect(createRewardService('user', {})).rejects.toThrow(AuthorizationError);
    });

    test('throws AuthorizationError when callerRole is "merchant"', async () => {
      await expect(createRewardService('merchant', {})).rejects.toThrow(AuthorizationError);
    });

    test('throws AuthorizationError when callerRole is empty string', async () => {
      await expect(createRewardService('', {})).rejects.toThrow(AuthorizationError);
    });

    test('does NOT call adminRepository.createReward when callerRole is not admin', async () => {
      await expect(createRewardService('user', {})).rejects.toThrow(AuthorizationError);
      expect(adminRepository.createReward).not.toHaveBeenCalled();
    });

    test('calls adminRepository.createReward when callerRole is "admin"', async () => {
      const data = { name: 'Reward', cost: 100, stock: 10 };
      await createRewardService('admin', data);
      expect(adminRepository.createReward).toHaveBeenCalledWith(data);
    });
  });

  describe('updateRewardService', () => {
    test('throws AuthorizationError when callerRole is "user"', async () => {
      await expect(updateRewardService('user', 1, {})).rejects.toThrow(AuthorizationError);
    });

    test('throws AuthorizationError when callerRole is "merchant"', async () => {
      await expect(updateRewardService('merchant', 1, {})).rejects.toThrow(AuthorizationError);
    });

    test('does NOT call adminRepository.updateReward when callerRole is not admin', async () => {
      await expect(updateRewardService('user', 1, {})).rejects.toThrow(AuthorizationError);
      expect(adminRepository.updateReward).not.toHaveBeenCalled();
    });

    test('calls adminRepository.updateReward when callerRole is "admin"', async () => {
      await updateRewardService('admin', 1, { name: 'New' });
      expect(adminRepository.updateReward).toHaveBeenCalledWith(1, { name: 'New' });
    });
  });

  describe('deleteRewardService', () => {
    test('throws AuthorizationError when callerRole is "user"', async () => {
      await expect(deleteRewardService('user', 1)).rejects.toThrow(AuthorizationError);
    });

    test('throws AuthorizationError when callerRole is "merchant"', async () => {
      await expect(deleteRewardService('merchant', 1)).rejects.toThrow(AuthorizationError);
    });

    test('does NOT call adminRepository.deleteReward when callerRole is not admin', async () => {
      await expect(deleteRewardService('user', 1)).rejects.toThrow(AuthorizationError);
      expect(adminRepository.deleteReward).not.toHaveBeenCalled();
    });

    test('calls adminRepository.deleteReward when callerRole is "admin"', async () => {
      await deleteRewardService('admin', 5);
      expect(adminRepository.deleteReward).toHaveBeenCalledWith(5);
    });
  });

  describe('listUsersService', () => {
    test('throws AuthorizationError when callerRole is "user"', async () => {
      await expect(listUsersService('user', {})).rejects.toThrow(AuthorizationError);
    });

    test('throws AuthorizationError when callerRole is "merchant"', async () => {
      await expect(listUsersService('merchant', {})).rejects.toThrow(AuthorizationError);
    });

    test('does NOT call adminRepository.listUsers when callerRole is not admin', async () => {
      await expect(listUsersService('user', {})).rejects.toThrow(AuthorizationError);
      expect(adminRepository.listUsers).not.toHaveBeenCalled();
    });

    test('calls adminRepository.listUsers when callerRole is "admin"', async () => {
      const opts = { page: 1, limit: 20 };
      await listUsersService('admin', opts);
      expect(adminRepository.listUsers).toHaveBeenCalledWith(opts);
    });
  });

  describe('updateUserRoleService', () => {
    test('throws AuthorizationError when callerRole is "user"', async () => {
      await expect(updateUserRoleService('user', 42, 'merchant', 1)).rejects.toThrow(AuthorizationError);
    });

    test('throws AuthorizationError when callerRole is "merchant"', async () => {
      await expect(updateUserRoleService('merchant', 42, 'user', 1)).rejects.toThrow(AuthorizationError);
    });

    test('throws AuthorizationError when callerRole is null', async () => {
      await expect(updateUserRoleService(null, 42, 'user', 1)).rejects.toThrow(AuthorizationError);
    });

    test('does NOT call userRepository when callerRole is not admin', async () => {
      await expect(updateUserRoleService('user', 42, 'merchant', 1)).rejects.toThrow(AuthorizationError);
      expect(userRepository.findById).not.toHaveBeenCalled();
      expect(userRepository.updateUserRole).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Validation: 'admin' role is rejected
    // -----------------------------------------------------------------------

    test('throws ValidationError (status 400) when newRole is "admin"', async () => {
      const err = await updateUserRoleService('admin', 42, 'admin', 1).catch((e) => e);
      expect(err).toBeDefined();
      expect(err.status).toBe(400);
      expect(err.code).toBe('validation_error');
    });

    test('throws ValidationError when newRole is an arbitrary invalid value', async () => {
      const err = await updateUserRoleService('admin', 42, 'superuser', 1).catch((e) => e);
      expect(err.status).toBe(400);
      expect(err.code).toBe('validation_error');
    });

    test('does NOT call userRepository when newRole is invalid', async () => {
      await expect(updateUserRoleService('admin', 42, 'admin', 1)).rejects.toMatchObject({
        status: 400,
        code: 'validation_error',
      });
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Audit log: correct beforeState / afterState
    // -----------------------------------------------------------------------

    test('writes audit log with correct beforeState and afterState', async () => {
      userRepository.findById.mockResolvedValue({ id: 42, role: 'user' });
      userRepository.updateUserRole.mockResolvedValue({ id: 42, role: 'merchant', updated_at: new Date() });

      await updateUserRoleService('admin', 42, 'merchant', 99);

      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_USER_ROLE',
          entityType: 'user',
          entityId: 42,
          performedBy: 99,
          beforeState: { role: 'user' },
          afterState: { role: 'merchant' },
          source: 'admin_api',
        })
      );
    });

    test('writes audit log with beforeState.role = null when user not found', async () => {
      userRepository.findById.mockResolvedValue(null);
      userRepository.updateUserRole.mockResolvedValue({ id: 42, role: 'merchant', updated_at: new Date() });

      await updateUserRoleService('admin', 42, 'merchant', 99);

      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          beforeState: { role: null },
          afterState: { role: 'merchant' },
        })
      );
    });

    // -----------------------------------------------------------------------
    // Transaction rollback on failure
    // -----------------------------------------------------------------------

    test('rolls back transaction when userRepository.updateUserRole throws', async () => {
      userRepository.updateUserRole.mockRejectedValue(new Error('DB error'));

      await expect(updateUserRoleService('admin', 42, 'merchant', 99)).rejects.toThrow('DB error');

      // ROLLBACK must have been called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      // COMMIT must NOT have been called
      expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
    });

    test('does NOT write audit log when transaction rolls back', async () => {
      userRepository.updateUserRole.mockRejectedValue(new Error('DB error'));

      await expect(updateUserRoleService('admin', 42, 'merchant', 99)).rejects.toThrow('DB error');

      expect(AuditService.log).not.toHaveBeenCalled();
    });

    test('releases the DB client even when transaction fails', async () => {
      userRepository.updateUserRole.mockRejectedValue(new Error('DB error'));

      await expect(updateUserRoleService('admin', 42, 'merchant', 99)).rejects.toThrow();

      expect(mockClient.release).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    test('returns the updated user on success', async () => {
      const updated = { id: 42, role: 'merchant', updated_at: new Date() };
      userRepository.updateUserRole.mockResolvedValue(updated);

      const result = await updateUserRoleService('admin', 42, 'merchant', 99);

      expect(result).toEqual(updated);
    });

    test('fires SecurityAlertService.send with ROLE_CHANGE after commit', async () => {
      await updateUserRoleService('admin', 42, 'merchant', 99);

      // Give the fire-and-forget a tick to execute
      await new Promise((resolve) => setImmediate(resolve));

      expect(SecurityAlertService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROLE_CHANGE',
          performedBy: 99,
          entityId: '42',
        })
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Subtask 7.1 — Property test: Property 3 (service functions)
// Feature: admin-auth-privilege-escalation, Property 3: Service-layer check rejects any non-admin caller role
// Validates: Requirements 2.1, 2.2, 2.4
// ---------------------------------------------------------------------------

describe('adminService — Property 3: service-layer check rejects any non-admin caller role (Subtask 7.1)', () => {
  beforeEach(resetMocks);

  const nonAdminRoleArb = fc.oneof(
    fc.string().filter((s) => s !== 'admin'),
    fc.constantFrom('user', 'merchant')
  );

  test('all five service functions throw AuthorizationError for any non-admin role', async () => {
    await fc.assert(
      fc.asyncProperty(nonAdminRoleArb, async (role) => {
        // Reset call counts before each iteration
        jest.clearAllMocks();
        mockClient.query.mockResolvedValue({});
        mockClient.release.mockReturnValue(undefined);
        pool.connect.mockResolvedValue(mockClient);

        const serviceCalls = [
          () => createRewardService(role, { name: 'x', cost: 1, stock: 1 }),
          () => updateRewardService(role, 1, { name: 'x' }),
          () => deleteRewardService(role, 1),
          () => listUsersService(role, { page: 1, limit: 10 }),
          () => updateUserRoleService(role, 1, 'user', 99),
        ];

        for (const call of serviceCalls) {
          let threw = false;
          let thrownError;
          try {
            await call();
          } catch (err) {
            threw = true;
            thrownError = err;
          }

          if (!threw) return false;
          if (!(thrownError instanceof AuthorizationError)) return false;
          if (thrownError.message !== 'Caller does not have admin privileges') return false;
        }

        // Verify no repository functions were called
        if (adminRepository.createReward.mock.calls.length > 0) return false;
        if (adminRepository.updateReward.mock.calls.length > 0) return false;
        if (adminRepository.deleteReward.mock.calls.length > 0) return false;
        if (adminRepository.listUsers.mock.calls.length > 0) return false;
        if (userRepository.findById.mock.calls.length > 0) return false;
        if (userRepository.updateUserRole.mock.calls.length > 0) return false;

        return true;
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Subtask 7.2 — Property test: Property 6
// Feature: admin-auth-privilege-escalation, Property 6: Role change audit log captures full before/after state
// Validates: Requirements 6.1
// ---------------------------------------------------------------------------

describe('adminService — Property 6: role change audit log captures full before/after state (Subtask 7.2)', () => {
  beforeEach(resetMocks);

  const validRoleArb = fc.constantFrom('user', 'merchant');

  test('audit log always contains correct action, entityId, performedBy, beforeState.role, afterState.role', async () => {
    await fc.assert(
      fc.asyncProperty(
        validRoleArb,
        validRoleArb,
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1, max: 100000 }),
        async (previousRole, newRole, targetUserId, adminId) => {
          jest.clearAllMocks();
          mockClient.query.mockResolvedValue({});
          mockClient.release.mockReturnValue(undefined);
          pool.connect.mockResolvedValue(mockClient);

          userRepository.findById.mockResolvedValue({ id: targetUserId, role: previousRole });
          userRepository.updateUserRole.mockResolvedValue({
            id: targetUserId,
            role: newRole,
            updated_at: new Date(),
          });
          AuditService.log.mockResolvedValue({});
          SecurityAlertService.send.mockResolvedValue(undefined);

          await updateUserRoleService('admin', targetUserId, newRole, adminId);

          if (AuditService.log.mock.calls.length !== 1) return false;

          const [logArg] = AuditService.log.mock.calls[0];

          if (logArg.action !== 'UPDATE_USER_ROLE') return false;
          if (logArg.entityId !== targetUserId) return false;
          if (logArg.performedBy !== adminId) return false;
          if (!logArg.beforeState || logArg.beforeState.role !== previousRole) return false;
          if (!logArg.afterState || logArg.afterState.role !== newRole) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
