const jwt = require('jsonwebtoken');
const { getRequiredConfig, getConfig } = require('./configService');

const ACCESS_EXPIRES_IN  = getConfig('JWT_EXPIRES_IN', '15m');
const REFRESH_EXPIRES_IN = getConfig('JWT_REFRESH_EXPIRES_IN', '7d');

/**
 * Signs an access token for the given user payload.
 * @param {{ id: number, email: string, role: string }} payload
 * @returns {string}
 */
function signAccessToken(payload) {
  const secret = getRequiredConfig('JWT_SECRET');
  return jwt.sign(
    { userId: payload.id, email: payload.email, role: payload.role },
    secret,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

/**
 * Signs a refresh token (minimal payload — just userId).
 * @param {{ id: number }} payload
 * @returns {string}
 */
function signRefreshToken(payload) {
  const secret = getRequiredConfig('JWT_SECRET');
  return jwt.sign(
    { userId: payload.id, type: 'refresh' },
    secret,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
}

/**
 * Verifies and decodes a JWT.
 * @param {string} token
 * @returns {Object} decoded payload
 * @throws {JsonWebTokenError | TokenExpiredError}
 */
function verifyToken(token) {
  const secret = getRequiredConfig('JWT_SECRET');
  return jwt.verify(token, secret);
}

module.exports = { signAccessToken, signRefreshToken, verifyToken };
