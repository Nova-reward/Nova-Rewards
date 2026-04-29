'use strict';

/**
 * JWT / token fixture helpers for integration tests.
 *
 * Generates real JWTs signed with the test secret so they pass the
 * authenticateUser middleware without mocking.
 */

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-chars!!';

/**
 * Sign a valid access token for the given user fixture.
 * @param {{ id: number, email: string, role: string }} user
 * @returns {string}
 */
function tokenFor(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: '15m' },
  );
}

/**
 * Returns an Authorization header value for the given user.
 */
function bearerFor(user) {
  return `Bearer ${tokenFor(user)}`;
}

/**
 * A token that is structurally valid but already expired.
 */
function expiredToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: -1 }, // immediately expired
  );
}

/**
 * A token signed with the wrong secret — will fail verification.
 */
function wrongSecretToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    'wrong-secret-that-does-not-match',
    { expiresIn: '15m' },
  );
}

module.exports = { tokenFor, bearerFor, expiredToken, wrongSecretToken };
