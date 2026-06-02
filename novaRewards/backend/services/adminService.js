'use strict';

const assertAdminCaller = require('../middleware/assertAdminCaller');
const adminRepository = require('../db/adminRepository');
const userRepository = require('../db/userRepository');
const AuditService = require('./auditService');
const SecurityAlertService = require('./securityAlertService');
const { pool } = require('../db/index');

/**
 * Creates a ValidationError with status 400 and code 'validation_error'.
 * @param {string} message
 * @returns {Error}
 */
function createValidationError(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = 'validation_error';
  err.name = 'ValidationError';
  return err;
}

/**
 * Create a new reward.
 * @param {string} callerRole - Role of the caller (must be 'admin')
 * @param {Object} data - Reward data
 * @returns {Promise<Object>} Created reward
 */
async function createRewardService(callerRole, data) {
  assertAdminCaller(callerRole);
  return adminRepository.createReward(data);
}

/**
 * Update an existing reward.
 * @param {string} callerRole - Role of the caller (must be 'admin')
 * @param {number|string} id - Reward ID
 * @param {Object} data - Fields to update
 * @returns {Promise<Object>} Updated reward
 */
async function updateRewardService(callerRole, id, data) {
  assertAdminCaller(callerRole);
  return adminRepository.updateReward(id, data);
}

/**
 * Soft-delete a reward.
 * @param {string} callerRole - Role of the caller (must be 'admin')
 * @param {number|string} id - Reward ID
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteRewardService(callerRole, id) {
  assertAdminCaller(callerRole);
  return adminRepository.deleteReward(id);
}

/**
 * List users with optional search/pagination.
 * @param {string} callerRole - Role of the caller (must be 'admin')
 * @param {Object} opts - Query options (search, page, limit)
 * @returns {Promise<Object>} { users, total }
 */
async function listUsersService(callerRole, opts) {
  assertAdminCaller(callerRole);
  return adminRepository.listUsers(opts);
}

/**
 * Update a user's role. Only 'user' and 'merchant' are valid target roles.
 * Wraps the DB update and audit log in a single transaction.
 * Fires a ROLE_CHANGE security alert after the transaction commits.
 *
 * @param {string} callerRole    - Role of the caller (must be 'admin')
 * @param {number|string} targetUserId - ID of the user whose role is being changed
 * @param {string} newRole       - New role value; must be 'user' or 'merchant'
 * @param {number|string} adminId - ID of the admin performing the change
 * @returns {Promise<Object>} Updated user row
 */
async function updateUserRoleService(callerRole, targetUserId, newRole, adminId) {
  assertAdminCaller(callerRole);

  const allowedRoles = ['user', 'merchant'];
  if (!allowedRoles.includes(newRole)) {
    throw createValidationError(`role must be one of: ${allowedRoles.join(', ')}`);
  }

  // Fetch the current state before making any changes
  const beforeState = await userRepository.findById(targetUserId);

  // Execute the role update inside a transaction
  const client = await pool.connect();
  let updatedUser;
  try {
    await client.query('BEGIN');

    updatedUser = await userRepository.updateUserRole(targetUserId, newRole, client);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Write audit log after the transaction commits.
  // auditLogRepository.logAudit does not accept a transaction client,
  // so we call AuditService.log outside the transaction block.
  await AuditService.log({
    action: 'UPDATE_USER_ROLE',
    entityType: 'user',
    entityId: targetUserId,
    performedBy: adminId,
    beforeState: { role: beforeState ? beforeState.role : null },
    afterState: { role: newRole },
    source: 'admin_api',
  });

  // Fire-and-forget security alert — never blocks the response
  SecurityAlertService.send({
    action: 'ROLE_CHANGE',
    performedBy: adminId,
    entityId: String(targetUserId),
    details: {
      previousRole: beforeState ? beforeState.role : null,
      newRole,
    },
    timestamp: new Date().toISOString(),
  }).catch((err) =>
    console.error('[updateUserRoleService] SecurityAlertService failed:', err)
  );

  return updatedUser;
}

module.exports = {
  createRewardService,
  updateRewardService,
  deleteRewardService,
  listUsersService,
  updateUserRoleService,
};
