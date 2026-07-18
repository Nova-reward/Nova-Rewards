/**
 * tokenService — Issue #648: JWT RS256 Security Hardening
 *                Issue #865: DB-backed refresh token rotation
 *
 * - RS256 asymmetric signing (2048-bit RSA key pair)
 * - Access token: 15 min expiry; payload: sub, roles, iat, exp only
 * - Refresh token: 30 day expiry; bcrypt hash stored in DB
 * - Rotation: every /refresh issues a new token and invalidates the old one
 * - Reuse detection: using a revoked token revokes the entire family
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { client: redis } = require('../lib/redis');
const { query } = require('../db/index');
const { getRequiredConfig } = require('./configService');

const ACCESS_EXPIRES_IN   = '15m';
const REFRESH_EXPIRES_IN  = '30d';
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const BCRYPT_ROUNDS       = 10;

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
 * Also adds the jti to the user's set of active refresh JTIs for logout-all support.
 * @param {string} jti
 * @param {string} walletAddress
 */
async function storeRefreshJti(jti, walletAddress) {
  await redis.setEx(`refresh:${jti}`, REFRESH_TTL_SECONDS, walletAddress);
  // Track active JTIs per user for logout-all
  await redis.sAdd(`user_refresh_jtis:${walletAddress}`, jti);
  await redis.expire(`user_refresh_jtis:${walletAddress}`, REFRESH_TTL_SECONDS);
}

/**
 * Revokes all active refresh tokens for a user by consuming every tracked JTI.
 * @param {string} walletAddress
 */
async function revokeAllUserRefreshJtis(walletAddress) {
  const setKey = `user_refresh_jtis:${walletAddress}`;
  const jtis = await redis.sMembers(setKey);
  if (jtis.length > 0) {
    await Promise.all(
      jtis.map(async (jti) => {
        // Get expiry from the refresh key to set blocklist TTL
        const ttl = await redis.ttl(`refresh:${jti}`);
        if (ttl > 0) await redis.setEx(`blocklist:${jti}`, ttl, '1');
        await redis.del(`refresh:${jti}`);
      })
    );
    await redis.del(setKey);
  }
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

// ---------------------------------------------------------------------------
// DB-backed refresh token rotation (Issue #865)
// ---------------------------------------------------------------------------

/**
 * Issues a new DB-backed refresh token:
 * 1. Signs a JWT (30-day expiry)
 * 2. Stores a bcrypt hash of the raw token in refresh_tokens
 * 3. Returns the raw token (only time it's available in plaintext)
 *
 * @param {{ id: number, wallet_address: string }} user
 * @param {string} [familyId]  - pass existing familyId to continue a rotation chain
 * @returns {Promise<{ token: string, tokenId: number, familyId: string }>}
 */
async function issueDbRefreshToken(user, familyId = randomUUID()) {
  const { token, jti } = signRefreshToken(user);
  const hash = await bcrypt.hash(token, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);

  const result = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [user.id, hash, familyId, expiresAt]
  );
  return { token, tokenId: result.rows[0].id, familyId };
}

/**
 * Rotates a DB refresh token:
 * - Finds all active tokens in the family by looking up the user's tokens
 * - If the presented token matches a *revoked* token → reuse detected → revoke entire family
 * - If it matches a *valid* token → revoke it, issue a new one
 *
 * @param {string} rawToken   - the raw refresh token from the client
 * @param {number} userId
 * @returns {Promise<{ token: string, tokenId: number, familyId: string } | null>}
 *          null means invalid/expired, throws on reuse detection
 */
async function rotateDbRefreshToken(rawToken, userId) {
  // Load all non-expired tokens for this user (both valid and revoked, within expiry window)
  const { rows } = await query(
    `SELECT id, token_hash, family_id, revoked_at
     FROM refresh_tokens
     WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );

  // Find which DB row the presented token matches
  let matchedRow = null;
  for (const row of rows) {
    if (await bcrypt.compare(rawToken, row.token_hash)) {
      matchedRow = row;
      break;
    }
  }

  if (!matchedRow) return null; // expired or unknown token

  // Reuse detection: token was already revoked → revoke entire family
  if (matchedRow.revoked_at !== null) {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND family_id = $2 AND revoked_at IS NULL`,
      [userId, matchedRow.family_id]
    );
    throw Object.assign(new Error('Refresh token reuse detected'), { code: 'token_reuse', statusCode: 401 });
  }

  // Valid token — revoke it and issue a replacement in the same family
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
    [matchedRow.id]
  );

  // Load user for signing
  const userResult = await query(
    `SELECT id, wallet_address, role FROM users WHERE id = $1 AND is_deleted = FALSE`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) return null;

  return issueDbRefreshToken(user, matchedRow.family_id);
}

/**
 * Revokes all active DB refresh tokens for a user (logout-all / reuse detection).
 * @param {number} userId
 */
async function revokeAllDbRefreshTokens(userId) {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  revokeToken,
  isRevoked,
  storeRefreshJti,
  consumeRefreshJti,
  revokeAllUserRefreshJtis,
  // DB-backed rotation (Issue #865)
  issueDbRefreshToken,
  rotateDbRefreshToken,
  revokeAllDbRefreshTokens,
};
