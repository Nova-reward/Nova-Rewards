/**
 * Field-level AES-256-GCM encryption utility.
 *
 * Encrypted values are stored as a single base64 string with the format:
 *   base64(iv[12 bytes] + authTag[16 bytes] + ciphertext)
 *
 * The encryption key is a 32-byte (256-bit) value sourced from the
 * FIELD_ENCRYPTION_KEY environment variable as a 64-character hex string.
 *
 * Key rotation: set FIELD_ENCRYPTION_KEY_PREVIOUS to the old key hex.
 * On decrypt, if the primary key fails the previous key is tried automatically.
 * Re-encrypt all rows with the new key once rotation is complete.
 *
 * Requirements: #651
 */

'use strict';

const crypto = require('crypto');

const ALGORITHM  = 'aes-256-gcm';
const IV_BYTES   = 12;   // 96-bit IV recommended for GCM
const TAG_BYTES  = 16;   // 128-bit auth tag

/**
 * Loads and validates a 32-byte key from a 64-char hex env variable.
 * @param {string} envVar
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
 * Returns the active encryption key (throws if not configured).
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
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param {string} plaintext
 * @returns {string} base64-encoded ciphertext blob (iv + tag + ciphertext)
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;

  const key = getPrimaryKey();
  const iv  = crypto.randomBytes(IV_BYTES);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: iv (12) + authTag (16) + ciphertext
  const blob = Buffer.concat([iv, authTag, encrypted]);
  return blob.toString('base64');
}

/**
 * Decrypts a base64-encoded ciphertext blob produced by `encrypt`.
 * Falls back to FIELD_ENCRYPTION_KEY_PREVIOUS during key rotation.
 *
 * @param {string} ciphertextBase64
 * @returns {string} plaintext
 */
function decrypt(ciphertextBase64) {
  if (ciphertextBase64 === null || ciphertextBase64 === undefined) {
    return ciphertextBase64;
  }

  // If the value doesn't look like a base64 blob it may be a legacy plaintext
  // value that was stored before encryption was enabled. Return as-is so
  // existing rows remain readable until they are re-encrypted.
  if (!isEncrypted(ciphertextBase64)) {
    return ciphertextBase64;
  }

  const keys = [getPrimaryKey()];
  const previousKey = loadKey('FIELD_ENCRYPTION_KEY_PREVIOUS');
  if (previousKey) keys.push(previousKey);

  const blob = Buffer.from(ciphertextBase64, 'base64');
  const iv      = blob.subarray(0, IV_BYTES);
  const authTag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = blob.subarray(IV_BYTES + TAG_BYTES);

  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return plaintext.toString('utf8');
    } catch {
      // Try next key
    }
  }

  throw new Error('[encryption] Failed to decrypt value: authentication tag mismatch. ' +
    'Ensure FIELD_ENCRYPTION_KEY (and FIELD_ENCRYPTION_KEY_PREVIOUS during rotation) are correct.');
}

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

module.exports = { encrypt, decrypt, isEncrypted };
