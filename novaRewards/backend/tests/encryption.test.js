'use strict';

/**
 * Unit tests for field-level AES-256-GCM encryption utility.
 * Requirements: #651
 */

// Set a deterministic test key before requiring the module
const TEST_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
const OLD_KEY  = 'b'.repeat(64);

describe('lib/encryption', () => {
  let encrypt, decrypt, isEncrypted;

  beforeEach(() => {
    jest.resetModules();
    process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;
    delete process.env.FIELD_ENCRYPTION_KEY_PREVIOUS;
    ({ encrypt, decrypt, isEncrypted } = require('../lib/encryption'));
  });

  afterEach(() => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    delete process.env.FIELD_ENCRYPTION_KEY_PREVIOUS;
  });

  // -------------------------------------------------------------------------
  // encrypt / decrypt round-trip
  // -------------------------------------------------------------------------

  test('encrypts and decrypts a string correctly', () => {
    const plaintext = 'alice@example.com';
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  test('produces different ciphertext for the same plaintext (random IV)', () => {
    const plaintext = 'alice@example.com';
    const c1 = encrypt(plaintext);
    const c2 = encrypt(plaintext);
    expect(c1).not.toBe(c2);
    // Both decrypt to the same value
    expect(decrypt(c1)).toBe(plaintext);
    expect(decrypt(c2)).toBe(plaintext);
  });

  test('handles empty string', () => {
    const ciphertext = encrypt('');
    expect(decrypt(ciphertext)).toBe('');
  });

  test('handles strings with special characters', () => {
    const plaintext = 'tëst+user@exämple.co.uk';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  test('handles long strings', () => {
    const plaintext = 'a'.repeat(1000);
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  // -------------------------------------------------------------------------
  // null / undefined passthrough
  // -------------------------------------------------------------------------

  test('encrypt returns null for null input', () => {
    expect(encrypt(null)).toBeNull();
  });

  test('encrypt returns undefined for undefined input', () => {
    expect(encrypt(undefined)).toBeUndefined();
  });

  test('decrypt returns null for null input', () => {
    expect(decrypt(null)).toBeNull();
  });

  test('decrypt returns undefined for undefined input', () => {
    expect(decrypt(undefined)).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Legacy plaintext passthrough (values stored before encryption was enabled)
  // -------------------------------------------------------------------------

  test('decrypt returns plaintext as-is for non-encrypted values (legacy rows)', () => {
    // A short string that cannot be a valid encrypted blob
    expect(decrypt('alice@example.com')).toBe('alice@example.com');
  });

  // -------------------------------------------------------------------------
  // isEncrypted
  // -------------------------------------------------------------------------

  test('isEncrypted returns true for an encrypted blob', () => {
    expect(isEncrypted(encrypt('test'))).toBe(true);
  });

  test('isEncrypted returns false for a plaintext email', () => {
    expect(isEncrypted('alice@example.com')).toBe(false);
  });

  test('isEncrypted returns false for null', () => {
    expect(isEncrypted(null)).toBe(false);
  });

  test('isEncrypted returns false for a short string', () => {
    expect(isEncrypted('short')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Key validation
  // -------------------------------------------------------------------------

  test('throws if FIELD_ENCRYPTION_KEY is missing', () => {
    jest.resetModules();
    delete process.env.FIELD_ENCRYPTION_KEY;
    const { encrypt: enc } = require('../lib/encryption');
    expect(() => enc('test')).toThrow('FIELD_ENCRYPTION_KEY is required');
  });

  test('throws if FIELD_ENCRYPTION_KEY is not 64 hex chars', () => {
    jest.resetModules();
    process.env.FIELD_ENCRYPTION_KEY = 'tooshort';
    const { encrypt: enc } = require('../lib/encryption');
    expect(() => enc('test')).toThrow('must be a 64-character hex string');
  });

  // -------------------------------------------------------------------------
  // Key rotation — fallback to previous key
  // -------------------------------------------------------------------------

  test('decrypts values encrypted with the previous key during rotation', () => {
    // Encrypt with OLD_KEY
    jest.resetModules();
    process.env.FIELD_ENCRYPTION_KEY = OLD_KEY;
    const { encrypt: encOld } = require('../lib/encryption');
    const ciphertext = encOld('rotate-me@example.com');

    // Now switch to new key, set old key as previous
    jest.resetModules();
    process.env.FIELD_ENCRYPTION_KEY          = TEST_KEY;
    process.env.FIELD_ENCRYPTION_KEY_PREVIOUS = OLD_KEY;
    const { decrypt: decNew } = require('../lib/encryption');

    expect(decNew(ciphertext)).toBe('rotate-me@example.com');
  });

  test('throws if neither key can decrypt the value', () => {
    const ciphertext = encrypt('secret');

    jest.resetModules();
    process.env.FIELD_ENCRYPTION_KEY = 'c'.repeat(64); // wrong key, no previous
    const { decrypt: decWrong } = require('../lib/encryption');

    expect(() => decWrong(ciphertext)).toThrow('Failed to decrypt value');
  });

  // -------------------------------------------------------------------------
  // Tamper detection (GCM auth tag)
  // -------------------------------------------------------------------------

  test('throws when ciphertext has been tampered with', () => {
    const ciphertext = encrypt('tamper-test');
    // Flip a byte in the middle of the base64 blob
    const buf = Buffer.from(ciphertext, 'base64');
    buf[20] ^= 0xff;
    const tampered = buf.toString('base64');

    expect(() => decrypt(tampered)).toThrow();
  });
});
