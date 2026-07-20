'use strict';

/**
 * passwordResetService — Issue #348: Authentication System
 *
 * Handles secure password-reset token lifecycle:
 *   - createResetToken(userId)        → raw token (single-use, 1-hour expiry)
 *   - validateResetToken(rawToken)    → { tokenId, userId } or throws
 *   - consumeResetToken(tokenId)      → marks token as used
 *
 * Tokens are stored as bcrypt hashes (10 rounds).
 * Raw tokens are 32 random bytes encoded as hex (64 chars) — never persisted.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../db/index');

const BCRYPT_ROUNDS    = 10;
const EXPIRY_MS        = 60 * 60 * 1000; // 1 hour

/**
 * Generates a secure reset token, stores its bcrypt hash in the DB,
 * and returns the raw token (only opportunity to read it in plaintext).
 *
 * @param {number} userId
 * @returns {Promise<string>} raw hex token
 */
async function createResetToken(userId) {
  // Invalidate any existing unused tokens for this user first
  await query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [userId]
  );

  const rawToken  = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + EXPIRY_MS);

  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return rawToken;
}

/**
 * Validates a raw reset token by scanning recent unexpired, unused rows
 * for this token (bcrypt compare).
 *
 * Returns the matching record's id and user_id on success.
 * Throws with `code: 'invalid_token'` when not found, expired, or used.
 *
 * @param {string} rawToken  64-char hex string from the reset link
 * @returns {Promise<{ tokenId: number, userId: number }>}
 */
async function validateResetToken(rawToken) {
  // Fetch all unexpired, unused tokens — we bcrypt-compare each until one matches.
  // Kept to a small window (1 hour) so the scan is always tiny.
  const result = await query(
    `SELECT id, user_id, token_hash
     FROM password_reset_tokens
     WHERE used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 20`,
    []
  );

  for (const row of result.rows) {
    const match = await bcrypt.compare(rawToken, row.token_hash);
    if (match) {
      return { tokenId: row.id, userId: row.user_id };
    }
  }

  const err = new Error('Invalid or expired password reset token');
  err.code  = 'invalid_token';
  throw err;
}

/**
 * Marks a reset token as consumed so it cannot be reused.
 *
 * @param {number} tokenId
 */
async function consumeResetToken(tokenId) {
  await query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
    [tokenId]
  );
}

module.exports = { createResetToken, validateResetToken, consumeResetToken };
