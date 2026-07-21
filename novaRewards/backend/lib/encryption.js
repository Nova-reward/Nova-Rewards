/**
 * Field-level AES-256-GCM encryption utility.
 *
 * Encrypted values are stored as a single base64 string with the format:
 *   base64(iv[12 bytes] + authTag[16 bytes] + ciphertext)
 *
 * The encryption key is a 32-byte (256-bit) value sourced from the
 * FIELD_ENCRYPTION_KEY environment variable as a 64-character hex string.
 *
 * Key rotation (dual-key strategy):
 *   1. Set FIELD_ENCRYPTION_KEY to the new key hex.
 *   2. Set FIELD_ENCRYPTION_KEY_PREVIOUS to the old key hex.
 *   3. Set FIELD_ENCRYPTION_KEY_ROTATED_AT to the ISO-8601 timestamp when the
 *      new key was activated (used to track the deprecation window).
 *   4. The service will automatically decrypt old-key rows, re-encrypt with
 *      the new key on read (via the Prisma middleware), and log a deprecation
 *      warning when the window has elapsed.
 *   5. Once all rows are re-encrypted (run scripts/encrypt-existing-rows.js),
 *      remove FIELD_ENCRYPTION_KEY_PREVIOUS and FIELD_ENCRYPTION_KEY_ROTATED_AT.
 *
 * KEY_ROTATION_WINDOW_DAYS (default 7): number of days the previous key is
 * accepted before a deprecation warning is emitted.
 *
 * Requirements: #651
 */

'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES  = 12;  // 96-bit IV recommended for GCM
const TAG_BYTES = 16;  // 128-bit auth tag

// Default deprecation window before a warning is emitted when the old key is
// still in use. Can be overridden via KEY_ROTATION_WINDOW_DAYS env var.
const DEFAULT_ROTATION_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// Key loading
// ---------------------------------------------------------------------------

/**
 * Loads and validates a 32-byte key from a 64-char hex string.
 * Returns null if the value is absent; throws for malformed values.
 *
 * @param {string} envVar  name of the environment variable
 * @returns {Buffer|null}
 */
function loadKey(envVar) {
  const hex = process.env[envVar];
  if (!hex) return null;
  if (hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      `[encryption] ${envVar} must be a 64-character hex string (32 bytes). ` +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Returns the active (primary / new) encryption key.
 * Throws if not configured.
 *
 * @returns {Buffer}
 */
function getPrimaryKey() {
  const key = loadKey('FIELD_ENCRYPTION_KEY');
  if (!key) {
    throw new Error(
      '[encryption] FIELD_ENCRYPTION_KEY is required for field-level encryption. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return key;
}

/**
 * Returns the number of days configured for the dual-key deprecation window.
 *
 * @returns {number}
 */
function getRotationWindowDays() {
  const raw = process.env.KEY_ROTATION_WINDOW_DAYS;
  if (!raw) return DEFAULT_ROTATION_WINDOW_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `[encryption] KEY_ROTATION_WINDOW_DAYS must be a positive number, got: ${raw}`
    );
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Core encrypt / decrypt primitives
// ---------------------------------------------------------------------------

/**
 * Encrypts a plaintext string using AES-256-GCM with the primary key.
 *
 * @param {string} plaintext
 * @returns {string} base64-encoded blob (iv + authTag + ciphertext)
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  return encryptWithKey(String(plaintext), getPrimaryKey());
}

/**
 * Encrypts plaintext with an explicit key buffer.
 * Use this when you need to re-encrypt with a specific key (e.g. the new key)
 * without modifying the current primary-key environment variable.
 *
 * @param {string} plaintext
 * @param {Buffer} keyBuffer  32-byte AES key
 * @returns {string} base64-encoded blob (iv + authTag + ciphertext)
 */
function encryptWithKey(plaintext, keyBuffer) {
  if (!Buffer.isBuffer(keyBuffer) || keyBuffer.length !== 32) {
    throw new Error('[encryption] encryptWithKey: keyBuffer must be a 32-byte Buffer');
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: iv (12) + authTag (16) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypts a base64-encoded ciphertext blob produced by `encrypt` or
 * `encryptWithKey`. Falls back to FIELD_ENCRYPTION_KEY_PREVIOUS during
 * key rotation.
 *
 * Emits a deprecation warning when the previous key is used and the
 * KEY_ROTATION_WINDOW_DAYS deprecation window has elapsed since
 * FIELD_ENCRYPTION_KEY_ROTATED_AT.
 *
 * @param {string} ciphertextBase64
 * @returns {string} plaintext
 */
function decrypt(ciphertextBase64) {
  return decryptWithKeyInfo(ciphertextBase64).plaintext;
}

/**
 * Decrypts a base64-encoded blob and returns extended information about
 * which key was used. This is the entry point used by the Prisma middleware
 * to decide whether a transparent re-encryption is needed.
 *
 * @param {string} ciphertextBase64
 * @returns {{ plaintext: string, usedFallbackKey: boolean, oldKeyAgeMs: number|null }}
 *   - plaintext:       the decrypted value
 *   - usedFallbackKey: true when the previous key was used (row needs re-encryption)
 *   - oldKeyAgeMs:     milliseconds since the rotation was activated, or null if
 *                      FIELD_ENCRYPTION_KEY_ROTATED_AT is not set
 */
function decryptWithKeyInfo(ciphertextBase64) {
  if (ciphertextBase64 === null || ciphertextBase64 === undefined) {
    return { plaintext: ciphertextBase64, usedFallbackKey: false, oldKeyAgeMs: null };
  }

  // Legacy plaintext passthrough — values stored before encryption was enabled
  if (!isEncrypted(ciphertextBase64)) {
    return { plaintext: ciphertextBase64, usedFallbackKey: false, oldKeyAgeMs: null };
  }

  const primaryKey  = getPrimaryKey();
  const previousKey = loadKey('FIELD_ENCRYPTION_KEY_PREVIOUS');

  const blob       = Buffer.from(ciphertextBase64, 'base64');
  const iv         = blob.subarray(0, IV_BYTES);
  const authTag    = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = blob.subarray(IV_BYTES + TAG_BYTES);

  // Try primary key first
  const primaryResult = _tryDecrypt(primaryKey, iv, authTag, ciphertext);
  if (primaryResult !== null) {
    return { plaintext: primaryResult, usedFallbackKey: false, oldKeyAgeMs: null };
  }

  // Try previous (fallback) key
  if (previousKey) {
    const fallbackResult = _tryDecrypt(previousKey, iv, authTag, ciphertext);
    if (fallbackResult !== null) {
      // Compute age of the rotation to check whether the deprecation window has passed
      const oldKeyAgeMs = _computeOldKeyAgeMs();
      _maybeEmitDeprecationWarning(oldKeyAgeMs);
      return { plaintext: fallbackResult, usedFallbackKey: true, oldKeyAgeMs };
    }
  }

  throw new Error(
    '[encryption] Failed to decrypt value: authentication tag mismatch. ' +
    'Ensure FIELD_ENCRYPTION_KEY (and FIELD_ENCRYPTION_KEY_PREVIOUS during rotation) are correct.'
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Attempts AES-256-GCM decryption with the given key.
 * Returns the plaintext string on success, or null if the tag check fails.
 *
 * @param {Buffer} key
 * @param {Buffer} iv
 * @param {Buffer} authTag
 * @param {Buffer} ciphertext
 * @returns {string|null}
 */
function _tryDecrypt(key, iv, authTag, ciphertext) {
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Returns the age (in milliseconds) of the current rotation based on
 * FIELD_ENCRYPTION_KEY_ROTATED_AT, or null if the variable is not set.
 *
 * @returns {number|null}
 */
function _computeOldKeyAgeMs() {
  const rotatedAt = process.env.FIELD_ENCRYPTION_KEY_ROTATED_AT;
  if (!rotatedAt) return null;
  const ts = Date.parse(rotatedAt);
  if (Number.isNaN(ts)) {
    // Malformed timestamp — don't block decryption, just skip the window check
    return null;
  }
  return Date.now() - ts;
}

/**
 * Emits a console.warn deprecation warning when oldKeyAgeMs exceeds the
 * configured rotation window.
 *
 * @param {number|null} oldKeyAgeMs
 */
function _maybeEmitDeprecationWarning(oldKeyAgeMs) {
  if (oldKeyAgeMs === null) return;
  const windowMs = getRotationWindowDays() * 24 * 60 * 60 * 1000;
  if (oldKeyAgeMs > windowMs) {
    const ageDays = (oldKeyAgeMs / (24 * 60 * 60 * 1000)).toFixed(1);
    const windowDays = getRotationWindowDays();
    console.warn(
      `[encryption] DEPRECATION WARNING: A row is still encrypted with the previous key ` +
      `${ageDays} days after rotation (window: ${windowDays} days). ` +
      'Run scripts/encrypt-existing-rows.js --new-key <hex> --old-key <hex> to migrate all rows, ' +
      'then remove FIELD_ENCRYPTION_KEY_PREVIOUS from the environment.'
    );
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Returns true if the value looks like an AES-256-GCM encrypted blob
 * (base64-encoded, minimum length for iv + tag + 1 byte ciphertext).
 *
 * Minimum blob size: 12 + 16 + 1 = 29 bytes → base64 ceil(29/3)*4 = 40 chars.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isEncrypted(value) {
  if (typeof value !== 'string') return false;
  // Valid base64 and long enough to contain iv + authTag
  return /^[A-Za-z0-9+/]+=*$/.test(value) && value.length >= 40;
}

module.exports = {
  encrypt,
  encryptWithKey,
  decrypt,
  decryptWithKeyInfo,
  isEncrypted,
  loadKey,
  getPrimaryKey,
  getRotationWindowDays,
};
