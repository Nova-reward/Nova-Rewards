'use strict';

const AuthorizationError = require('../errors/AuthorizationError');

/**
 * Asserts that the caller has the 'admin' role.
 * Throws AuthorizationError if callerRole !== 'admin'.
 * Pure function — no Express dependency, testable in isolation.
 *
 * @param {string} callerRole - The role of the caller to check.
 * @throws {AuthorizationError} When callerRole is not 'admin'.
 */
function assertAdminCaller(callerRole) {
  if (callerRole !== 'admin') {
    throw new AuthorizationError('Caller does not have admin privileges');
  }
}

module.exports = assertAdminCaller;
