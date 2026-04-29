/**
 * tokenService — Issue #648: JWT RS256 Security Hardening
 *
 * - RS256 asymmetric signing (2048-bit RSA key pair)
 * - Access token: 15 min expiry; payload: sub, roles, iat, exp only
 * - Refresh token: 7 day expiry; payload: sub, type, jti, iat, exp
 * - Refresh token rotation: new refresh token on every /auth/refresh
 * - Revoked tokens stored in Redis blocklist (checked on every request)
 */
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { client: redis } = require('../lib/redis');
const { getRequiredConfig } = require('./configService');

const ACCESS_EXPIRES_IN  = '15m';
const REFRESH_EXPIRES_IN = '7d';
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getPrivateKey() { return getRequiredConfig('JWT_PRIVATE_KEY').replace(/\\n/g, '\n'); }
function getPublicKey()  { return getRequiredConfig('JWT_PUBLIC_KEY').replace(/\\n/g, '\n'); }

/**
 * Signs an RS256 access token.
 * Payload contains only: sub (wallet_address), roles, iat, exp.
 * @param {{ wallet_address: string, role: string }} user
 * @returns {string}
 */
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.wallet_address, roles: [user.role] },
    getPrivateKey(),
    { algorithm: 'RS256', expiresIn: ACCESS_EXPIRES_IN }
  );
}

/**
 * Signs an RS256 refresh token with a unique jti for rotation tracking.
 * @param {{ wallet_address: string }} user
 * @returns {{ token: string, jti: string }}
 */
function signRefreshToken(user) {
  const jti = randomUUID();
  const token = jwt.sign(
    { sub: user.wallet_address, type: 'refresh', jti },
    getPrivateKey(),
    { algorithm: 'RS256', expiresIn: REFRESH_EXPIRES_IN }
  );
  return { token, jti };
}

/**
 * Verifies an RS256 JWT using the public key.
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyToken(token) {
  return jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] });
}

/**
 * Adds a token's jti to the Redis blocklist until its expiry.
 * @param {string} jti  - JWT ID
 * @param {number} exp  - Unix timestamp of token expiry
 */
async function revokeToken(jti, exp) {
  const ttl = exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redis.setEx(`blocklist:${jti}`, ttl, '1');
  }
}

/**
 * Returns true if the token's jti is in the Redis blocklist.
 * @param {string} jti
 * @returns {Promise<boolean>}
 */
async function isRevoked(jti) {
  const val = await redis.get(`blocklist:${jti}`);
  return val !== null;
}

/**
 * Stores a refresh token's jti in Redis so it can be rotated/revoked.
 * @param {string} jti
 * @param {string} walletAddress
 */
async function storeRefreshJti(jti, walletAddress) {
  await redis.setEx(`refresh:${jti}`, REFRESH_TTL_SECONDS, walletAddress);
}

/**
 * Validates a refresh jti exists in Redis (not yet rotated/revoked).
 * @param {string} jti
 * @returns {Promise<string|null>} walletAddress or null
 */
async function consumeRefreshJti(jti) {
  const walletAddress = await redis.get(`refresh:${jti}`);
  if (!walletAddress) return null;
  // Consume (delete) so it cannot be reused — rotation
  await redis.del(`refresh:${jti}`);
  return walletAddress;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  revokeToken,
  isRevoked,
  storeRefreshJti,
  consumeRefreshJti,
};
