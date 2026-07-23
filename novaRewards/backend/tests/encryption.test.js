'use strict';

/**
 * Unit tests for field-level AES-256-GCM encryption and dual-key rotation.
 *
 * Covers:
 *   1. encrypt / decrypt round-trips
 *   2. null / undefined passthrough
 *   3. Legacy plaintext passthrough (values stored before encryption was on)
 *   4. isEncrypted detection
 *   5. Key validation
 *   6. Dual-key read: fallback to previous key during rotation
 *   7. Transparent re-encryption after one read cycle (acceptance criterion)
 *   8. Deprecation warning when rotation window has elapsed
 *   9. getRotationWindowDays
 *  10. encryptWithKey with explicit key buffer
 *  11. Prisma middleware — write-path encryption
 *  12. Prisma middleware — read-path decryption
 *  13. Prisma middleware — transparent re-encryption on fallback key read
 *  14. Prisma middleware — re-encryption update failure is silent
 *  15. Tamper detection (GCM auth tag)
 *
 * Requirements: #651
 */

// ---------------------------------------------------------------------------
// Key constants shared across suites
// ---------------------------------------------------------------------------
const NEW_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
const OLD_KEY = 'b'.repeat(64);
const BAD_KEY = 'c'.repeat(64);

// ---------------------------------------------------------------------------
// Helper: fresh module load with controlled env vars
// ---------------------------------------------------------------------------
function loadEncryption(newKey, oldKey = null, rotatedAt = null, windowDays = null) {
  vi.resetModules();
  if (newKey)           process.env.FIELD_ENCRYPTION_KEY          = newKey;
  else                  delete process.env.FIELD_ENCRYPTION_KEY;
  if (oldKey)           process.env.FIELD_ENCRYPTION_KEY_PREVIOUS = oldKey;
  else                  delete process.env.FIELD_ENCRYPTION_KEY_PREVIOUS;
  if (rotatedAt)        process.env.FIELD_ENCRYPTION_KEY_ROTATED_AT = rotatedAt;
  else                  delete process.env.FIELD_ENCRYPTION_KEY_ROTATED_AT;
  if (windowDays !== null) process.env.KEY_ROTATION_WINDOW_DAYS = String(windowDays);
  else                     delete process.env.KEY_ROTATION_WINDOW_DAYS;

  return require('../lib/encryption');
}

// ---------------------------------------------------------------------------
// Cleanup after each test
// ---------------------------------------------------------------------------
afterEach(() => {
  vi.resetModules();
  delete process.env.FIELD_ENCRYPTION_KEY;
  delete process.env.FIELD_ENCRYPTION_KEY_PREVIOUS;
  delete process.env.FIELD_ENCRYPTION_KEY_ROTATED_AT;
  delete process.env.KEY_ROTATION_WINDOW_DAYS;
});

// ===========================================================================
// 1. encrypt / decrypt — round-trips
// ===========================================================================
describe('encrypt / decrypt round-trips', () => {
  test('encrypts and decrypts a string correctly', () => {
    const { encrypt, decrypt } = loadEncryption(NEW_KEY);
    const plaintext = 'alice@example.com';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  test('produces different ciphertext for the same plaintext (random IV)', () => {
    const { encrypt, decrypt } = loadEncryption(NEW_KEY);
    const plaintext = 'alice@example.com';
    const c1 = encrypt(plaintext);
    const c2 = encrypt(plaintext);
    expect(c1).not.toBe(c2);
    expect(decrypt(c1)).toBe(plaintext);
    expect(decrypt(c2)).toBe(plaintext);
  });

  test('handles empty string', () => {
    const { encrypt, decrypt } = loadEncryption(NEW_KEY);
    expect(decrypt(encrypt(''))).toBe('');
  });

  test('handles strings with special/unicode characters', () => {
    const { encrypt, decrypt } = loadEncryption(NEW_KEY);
    const plaintext = 'tëst+user@exämple.co.uk 😀';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  test('handles long strings (1 000 chars)', () => {
    const { encrypt, decrypt } = loadEncryption(NEW_KEY);
    const plaintext = 'x'.repeat(1000);
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });
});

// ===========================================================================
// 2. null / undefined passthrough
// ===========================================================================
describe('null / undefined passthrough', () => {
  test('encrypt returns null for null input', () => {
    const { encrypt } = loadEncryption(NEW_KEY);
    expect(encrypt(null)).toBeNull();
  });

  test('encrypt returns undefined for undefined input', () => {
    const { encrypt } = loadEncryption(NEW_KEY);
    expect(encrypt(undefined)).toBeUndefined();
  });

  test('decrypt returns null for null input', () => {
    const { decrypt } = loadEncryption(NEW_KEY);
    expect(decrypt(null)).toBeNull();
  });

  test('decrypt returns undefined for undefined input', () => {
    const { decrypt } = loadEncryption(NEW_KEY);
    expect(decrypt(undefined)).toBeUndefined();
  });

  test('decryptWithKeyInfo returns correct structure for null', () => {
    const { decryptWithKeyInfo } = loadEncryption(NEW_KEY);
    const result = decryptWithKeyInfo(null);
    expect(result).toEqual({ plaintext: null, usedFallbackKey: false, oldKeyAgeMs: null });
  });
});

// ===========================================================================
// 3. Legacy plaintext passthrough
// ===========================================================================
describe('legacy plaintext passthrough', () => {
  test('decrypt returns short plaintext as-is', () => {
    const { decrypt } = loadEncryption(NEW_KEY);
    expect(decrypt('alice@example.com')).toBe('alice@example.com');
  });

  test('decryptWithKeyInfo marks legacy rows as not needing rekey', () => {
    const { decryptWithKeyInfo } = loadEncryption(NEW_KEY);
    const result = decryptWithKeyInfo('alice@example.com');
    expect(result.plaintext).toBe('alice@example.com');
    expect(result.usedFallbackKey).toBe(false);
  });
});

// ===========================================================================
// 4. isEncrypted
// ===========================================================================
describe('isEncrypted', () => {
  test('returns true for an encrypted blob', () => {
    const { encrypt, isEncrypted } = loadEncryption(NEW_KEY);
    expect(isEncrypted(encrypt('test'))).toBe(true);
  });

  test('returns false for a plaintext email', () => {
    const { isEncrypted } = loadEncryption(NEW_KEY);
    expect(isEncrypted('alice@example.com')).toBe(false);
  });

  test('returns false for null', () => {
    const { isEncrypted } = loadEncryption(NEW_KEY);
    expect(isEncrypted(null)).toBe(false);
  });

  test('returns false for a short string', () => {
    const { isEncrypted } = loadEncryption(NEW_KEY);
    expect(isEncrypted('short')).toBe(false);
  });

  test('returns false for a number', () => {
    const { isEncrypted } = loadEncryption(NEW_KEY);
    expect(isEncrypted(42)).toBe(false);
  });
});

// ===========================================================================
// 5. Key validation
// ===========================================================================
describe('key validation', () => {
  test('throws if FIELD_ENCRYPTION_KEY is missing', () => {
    const { encrypt } = loadEncryption(null);
    expect(() => encrypt('test')).toThrow('FIELD_ENCRYPTION_KEY is required');
  });

  test('throws if FIELD_ENCRYPTION_KEY is not 64 hex chars', () => {
    vi.resetModules();
    process.env.FIELD_ENCRYPTION_KEY = 'tooshort';
    const { encrypt } = require('../lib/encryption');
    expect(() => encrypt('test')).toThrow('must be a 64-character hex string');
  });

  test('throws if FIELD_ENCRYPTION_KEY contains non-hex chars', () => {
    vi.resetModules();
    process.env.FIELD_ENCRYPTION_KEY = 'z'.repeat(64);
    const { encrypt } = require('../lib/encryption');
    expect(() => encrypt('test')).toThrow('must be a 64-character hex string');
  });
});

// ===========================================================================
// 6. Dual-key read — fallback to previous key
// ===========================================================================
describe('dual-key read — fallback to previous key', () => {
  test('decrypts values encrypted with the previous key during rotation', () => {
    const { encrypt: encOld } = loadEncryption(OLD_KEY);
    const ciphertext = encOld('rotate-me@example.com');

    const { decrypt: decNew } = loadEncryption(NEW_KEY, OLD_KEY);
    expect(decNew(ciphertext)).toBe('rotate-me@example.com');
  });

  test('decryptWithKeyInfo sets usedFallbackKey=true for old-key ciphertext', () => {
    const { encrypt: encOld } = loadEncryption(OLD_KEY);
    const ciphertext = encOld('fallback-test@example.com');

    const { decryptWithKeyInfo } = loadEncryption(NEW_KEY, OLD_KEY);
    const result = decryptWithKeyInfo(ciphertext);

    expect(result.plaintext).toBe('fallback-test@example.com');
    expect(result.usedFallbackKey).toBe(true);
  });

  test('decryptWithKeyInfo sets usedFallbackKey=false when primary key succeeds', () => {
    const { encrypt, decryptWithKeyInfo } = loadEncryption(NEW_KEY, OLD_KEY);
    const ciphertext = encrypt('already-new-key@example.com');
    const result = decryptWithKeyInfo(ciphertext);

    expect(result.plaintext).toBe('already-new-key@example.com');
    expect(result.usedFallbackKey).toBe(false);
  });

  test('throws if neither key can decrypt the value', () => {
    const { encrypt } = loadEncryption(OLD_KEY);
    const ciphertext = encrypt('secret');

    const { decrypt: decWrong } = loadEncryption(BAD_KEY); // no previous key
    expect(() => decWrong(ciphertext)).toThrow('Failed to decrypt value');
  });

  test('throws when only an unrelated previous key is set', () => {
    const { encrypt } = loadEncryption(OLD_KEY);
    const ciphertext = encrypt('secret');

    const { decrypt: decWrong } = loadEncryption(BAD_KEY, NEW_KEY); // neither matches
    expect(() => decWrong(ciphertext)).toThrow('Failed to decrypt value');
  });
});

// ===========================================================================
// 7. Transparent re-encryption after one read cycle  ← ACCEPTANCE CRITERION
// ===========================================================================
describe('transparent re-encryption after one read cycle', () => {
  test('a row encrypted with the old key is readable AND re-encrypted after one read', async () => {
    // ── Step 1: encrypt a value with the OLD key ──────────────────────────
    const { encrypt: encOld } = loadEncryption(OLD_KEY);
    const plaintext     = 'user@example.com';
    const oldCiphertext = encOld(plaintext);

    // ── Step 2: set up middleware with a mock Prisma client ───────────────
    process.env.FIELD_ENCRYPTION_KEY          = NEW_KEY;
    process.env.FIELD_ENCRYPTION_KEY_PREVIOUS = OLD_KEY;
    vi.resetModules();
    const { createEncryptionMiddleware } = require('../lib/prismaEncryptionMiddleware');

    // The mock Prisma client records what was written during re-encryption
    const updatedRows = [];
    const mockPrisma = {
      webhooks: {
        update: vi.fn(({ where, data }) => {
          updatedRows.push({ id: where.id, data });
          return Promise.resolve({ id: where.id, secret: data.secret });
        }),
      },
    };

    const middleware = createEncryptionMiddleware(mockPrisma);

    // ── Step 3: simulate a findUnique read returning the old-encrypted row
    const params = {
      model:  'Webhooks',
      action: 'findUnique',
      args:   { where: { id: 42 } },
    };
    const next = vi.fn().mockResolvedValue({ id: 42, secret: oldCiphertext });

    const result = await middleware(params, next);

    // ── Step 4: read path returns plaintext ──────────────────────────────
    expect(result.secret).toBe(plaintext);

    // ── Step 5: allow the background re-key promise to settle ────────────
    await new Promise(setImmediate);

    // ── Step 6: the Prisma update was called with a NEW-KEY ciphertext ────
    expect(mockPrisma.webhooks.update).toHaveBeenCalledTimes(1);

    const updateCall = mockPrisma.webhooks.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: 42 });

    const newCiphertext = updateCall.data.secret;
    // The new ciphertext must differ from the old one (random IV + new key)
    expect(newCiphertext).not.toBe(oldCiphertext);

    // ── Step 7: the new ciphertext decrypts correctly with only the new key
    vi.resetModules();
    process.env.FIELD_ENCRYPTION_KEY = NEW_KEY;
    delete process.env.FIELD_ENCRYPTION_KEY_PREVIOUS;
    const { decrypt: decNew } = require('../lib/encryption');
    expect(decNew(newCiphertext)).toBe(plaintext);
  });

  test('rows already encrypted with the new key are NOT re-encrypted', async () => {
    process.env.FIELD_ENCRYPTION_KEY          = NEW_KEY;
    process.env.FIELD_ENCRYPTION_KEY_PREVIOUS = OLD_KEY;
    vi.resetModules();
    const { encrypt }                    = require('../lib/encryption');
    const { createEncryptionMiddleware } = require('../lib/prismaEncryptionMiddleware');

    const newCiphertext = encrypt('already-rotated@example.com');

    const mockPrisma = { webhooks: { update: vi.fn() } };
    const middleware = createEncryptionMiddleware(mockPrisma);

    const params = { model: 'Webhooks', action: 'findUnique', args: {} };
    const next   = vi.fn().mockResolvedValue({ id: 99, secret: newCiphertext });

    const result = await middleware(params, next);

    expect(result.secret).toBe('already-rotated@example.com');
    await new Promise(setImmediate);
    expect(mockPrisma.webhooks.update).not.toHaveBeenCalled();
  });

  test('re-encryption is performed for every old-key row in a findMany result', async () => {
    const { encrypt: encOld } = loadEncryption(OLD_KEY);
    const rows = [
      { id: 1, secret: encOld('secret-one') },
      { id: 2, secret: encOld('secret-two') },
    ];

    process.env.FIELD_ENCRYPTION_KEY          = NEW_KEY;
    process.env.FIELD_ENCRYPTION_KEY_PREVIOUS = OLD_KEY;
    vi.resetModules();
    const { createEncryptionMiddleware } = require('../lib/prismaEncryptionMiddleware');

    const mockPrisma = { webhooks: { update: vi.fn().mockResolvedValue({}) } };
    const middleware = createEncryptionMiddleware(mockPrisma);

    const params = { model: 'Webhooks', action: 'findMany', args: {} };
    const next   = vi.fn().mockResolvedValue(rows);

    const result = await middleware(params, next);

    expect(result[0].secret).toBe('secret-one');
    expect(result[1].secret).toBe('secret-two');

    await new Promise(setImmediate);
    expect(mockPrisma.webhooks.update).toHaveBeenCalledTimes(2);
  });
});

// ===========================================================================
// 8. Deprecation warning when rotation window has elapsed
// ===========================================================================
describe('deprecation warning — rotation window', () => {
  test('emits a console.warn when window has elapsed', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const { encrypt: encOld }    = loadEncryption(OLD_KEY);
    const ciphertext = encOld('warning-test@example.com');

    const { decryptWithKeyInfo } = loadEncryption(NEW_KEY, OLD_KEY, tenDaysAgo, 7);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    decryptWithKeyInfo(ciphertext);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/DEPRECATION WARNING/)
    );
    warnSpy.mockRestore();
  });

  test('does NOT emit a warning when within the rotation window', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { encrypt: encOld } = loadEncryption(OLD_KEY);
    const ciphertext = encOld('no-warning@example.com');

    const { decryptWithKeyInfo } = loadEncryption(NEW_KEY, OLD_KEY, threeDaysAgo, 7);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    decryptWithKeyInfo(ciphertext);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('does NOT emit a warning when FIELD_ENCRYPTION_KEY_ROTATED_AT is not set', () => {
    const { encrypt: encOld } = loadEncryption(OLD_KEY);
    const ciphertext = encOld('no-timestamp@example.com');

    const { decryptWithKeyInfo } = loadEncryption(NEW_KEY, OLD_KEY); // no rotatedAt

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    decryptWithKeyInfo(ciphertext);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('oldKeyAgeMs is returned in decryptWithKeyInfo when rotatedAt is set', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { encrypt: encOld } = loadEncryption(OLD_KEY);
    const ciphertext = encOld('age-test@example.com');

    const { decryptWithKeyInfo } = loadEncryption(NEW_KEY, OLD_KEY, fiveDaysAgo, 7);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = decryptWithKeyInfo(ciphertext);

    expect(result.oldKeyAgeMs).toBeGreaterThan(0);
    expect(result.oldKeyAgeMs).toBeLessThan(6 * 24 * 60 * 60 * 1000);
    vi.restoreAllMocks();
  });
});

// ===========================================================================
// 9. getRotationWindowDays
// ===========================================================================
describe('getRotationWindowDays', () => {
  test('defaults to 7 days', () => {
    const { getRotationWindowDays } = loadEncryption(NEW_KEY);
    expect(getRotationWindowDays()).toBe(7);
  });

  test('reads from KEY_ROTATION_WINDOW_DAYS env var', () => {
    const { getRotationWindowDays } = loadEncryption(NEW_KEY, null, null, 14);
    expect(getRotationWindowDays()).toBe(14);
  });

  test('throws for non-positive value', () => {
    const { getRotationWindowDays } = loadEncryption(NEW_KEY, null, null, -1);
    expect(() => getRotationWindowDays()).toThrow('must be a positive number');
  });

  test('throws for non-numeric value', () => {
    vi.resetModules();
    process.env.FIELD_ENCRYPTION_KEY    = NEW_KEY;
    process.env.KEY_ROTATION_WINDOW_DAYS = 'seven';
    const { getRotationWindowDays } = require('../lib/encryption');
    expect(() => getRotationWindowDays()).toThrow('must be a positive number');
  });
});

// ===========================================================================
// 10. encryptWithKey with explicit key buffer
// ===========================================================================
describe('encryptWithKey', () => {
  test('encrypts and decrypts with an explicit key buffer', () => {
    const { encryptWithKey, decrypt } = loadEncryption(NEW_KEY);
    const keyBuf     = Buffer.from(NEW_KEY, 'hex');
    const ciphertext = encryptWithKey('explicit-key-test', keyBuf);
    expect(decrypt(ciphertext)).toBe('explicit-key-test');
  });

  test('throws for a key buffer of wrong length', () => {
    const { encryptWithKey } = loadEncryption(NEW_KEY);
    expect(() => encryptWithKey('test', Buffer.alloc(16))).toThrow(
      'keyBuffer must be a 32-byte Buffer'
    );
  });

  test('throws for a non-Buffer key', () => {
    const { encryptWithKey } = loadEncryption(NEW_KEY);
    expect(() => encryptWithKey('test', 'not-a-buffer')).toThrow(
      'keyBuffer must be a 32-byte Buffer'
    );
  });
});

// ===========================================================================
// 11. Prisma middleware — write-path encryption
// ===========================================================================
describe('Prisma middleware — write-path encryption', () => {
  async function runMiddleware(params, returnValue = null) {
    process.env.FIELD_ENCRYPTION_KEY = NEW_KEY;
    vi.resetModules();
    const { encryptionMiddleware } = require('../lib/prismaEncryptionMiddleware');
    const next = vi.fn().mockResolvedValue(returnValue);
    const result = await encryptionMiddleware(params, next);
    return { result, next };
  }

  test('encrypts a write field on create', async () => {
    const params = {
      model:  'Webhooks',
      action: 'create',
      args:   { data: { secret: 'my-hmac-secret' } },
    };
    const { next } = await runMiddleware(params);
    const written = next.mock.calls[0][0].args.data.secret;

    vi.resetModules();
    process.env.FIELD_ENCRYPTION_KEY = NEW_KEY;
    const { isEncrypted } = require('../lib/encryption');
    expect(isEncrypted(written)).toBe(true);
  });

  test('does not encrypt fields for unknown models', async () => {
    const params = {
      model:  'Users',
      action: 'create',
      args:   { data: { name: 'Alice' } },
    };
    const { next } = await runMiddleware(params);
    expect(next.mock.calls[0][0].args.data.name).toBe('Alice');
  });
});

// ===========================================================================
// 12. Prisma middleware — read-path decryption
// ===========================================================================
describe('Prisma middleware — read-path decryption', () => {
  test('decrypts a field on findUnique result', async () => {
    process.env.FIELD_ENCRYPTION_KEY = NEW_KEY;
    vi.resetModules();
    const { encrypt }              = require('../lib/encryption');
    const { encryptionMiddleware } = require('../lib/prismaEncryptionMiddleware');

    const ciphertext = encrypt('decrypted-secret');
    const params = { model: 'Webhooks', action: 'findUnique', args: {} };
    const next   = vi.fn().mockResolvedValue({ id: 1, secret: ciphertext });

    const result = await encryptionMiddleware(params, next);
    expect(result.secret).toBe('decrypted-secret');
  });

  test('decrypts all items in a findMany result', async () => {
    process.env.FIELD_ENCRYPTION_KEY = NEW_KEY;
    vi.resetModules();
    const { encrypt }              = require('../lib/encryption');
    const { encryptionMiddleware } = require('../lib/prismaEncryptionMiddleware');

    const params = { model: 'Webhooks', action: 'findMany', args: {} };
    const next   = vi.fn().mockResolvedValue([
      { id: 1, secret: encrypt('s1') },
      { id: 2, secret: encrypt('s2') },
    ]);

    const result = await encryptionMiddleware(params, next);
    expect(result[0].secret).toBe('s1');
    expect(result[1].secret).toBe('s2');
  });

  test('passes through null results unchanged', async () => {
    process.env.FIELD_ENCRYPTION_KEY = NEW_KEY;
    vi.resetModules();
    const { encryptionMiddleware } = require('../lib/prismaEncryptionMiddleware');
    const params = { model: 'Webhooks', action: 'findFirst', args: {} };
    const next   = vi.fn().mockResolvedValue(null);

    const result = await encryptionMiddleware(params, next);
    expect(result).toBeNull();
  });
});

// ===========================================================================
// 13. Prisma middleware — re-key failure is silent
// ===========================================================================
describe('Prisma middleware — re-key failure is silent', () => {
  test('does not throw when the re-encryption UPDATE fails', async () => {
    const { encrypt: encOld } = loadEncryption(OLD_KEY);
    const ciphertext = encOld('silent-fail@example.com');

    process.env.FIELD_ENCRYPTION_KEY          = NEW_KEY;
    process.env.FIELD_ENCRYPTION_KEY_PREVIOUS = OLD_KEY;
    vi.resetModules();
    const { createEncryptionMiddleware } = require('../lib/prismaEncryptionMiddleware');

    const mockPrisma = {
      webhooks: {
        update: vi.fn().mockRejectedValue(new Error('DB connection lost')),
      },
    };

    // Spy on console.error — override the global suppress so we can assert
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const middleware = createEncryptionMiddleware(mockPrisma);
    const params = { model: 'Webhooks', action: 'findUnique', args: {} };
    const next   = vi.fn().mockResolvedValue({ id: 7, secret: ciphertext });

    // The read succeeds even though the background re-encrypt UPDATE will fail
    await expect(middleware(params, next)).resolves.toMatchObject({
      secret: 'silent-fail@example.com',
    });

    // Allow the background update to reject
    await new Promise(setImmediate);

    // Error is logged, not thrown
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Failed to re-encrypt/),
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});

// ===========================================================================
// 14. Tamper detection (GCM auth tag)
// ===========================================================================
describe('tamper detection', () => {
  test('throws when ciphertext has been tampered with (auth tag region)', () => {
    const { encrypt, decrypt } = loadEncryption(NEW_KEY);
    const ciphertext = encrypt('tamper-test');
    const buf = Buffer.from(ciphertext, 'base64');
    buf[20] ^= 0xff; // flip a byte in the auth-tag region
    expect(() => decrypt(buf.toString('base64'))).toThrow();
  });

  test('throws when IV has been tampered with', () => {
    const { encrypt, decrypt } = loadEncryption(NEW_KEY);
    const ciphertext = encrypt('tamper-iv');
    const buf = Buffer.from(ciphertext, 'base64');
    buf[0] ^= 0xff; // flip a byte in the IV region
    expect(() => decrypt(buf.toString('base64'))).toThrow();
  });
});
