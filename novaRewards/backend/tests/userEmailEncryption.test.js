'use strict';

/**
 * Tests that users.email is encrypted at rest and decrypted on read.
 * Requirements: #651
 */

const TEST_KEY = 'a'.repeat(64);
process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;

const mockQuery = jest.fn();
jest.mock('../db/index', () => ({ query: mockQuery }));

const { encrypt, decrypt, isEncrypted } = require('../lib/encryption');

describe('auth route — email field-level encryption', () => {
  let app;

  beforeAll(() => {
    // Minimal env required by server bootstrap
    process.env.ISSUER_PUBLIC       = 'G' + 'A'.repeat(55);
    process.env.ISSUER_SECRET       = 'S' + 'A'.repeat(55);
    process.env.DISTRIBUTION_PUBLIC = 'G' + 'A'.repeat(55);
    process.env.DISTRIBUTION_SECRET = 'S' + 'A'.repeat(55);
    process.env.STELLAR_NETWORK     = 'testnet';
    process.env.HORIZON_URL         = 'https://horizon-testnet.stellar.org';
    process.env.DATABASE_URL        = 'postgresql://test:test@localhost/test';
    process.env.REDIS_URL           = 'redis://localhost:6379';
    process.env.JWT_SECRET          = 'test-jwt-secret';
    process.env.NODE_ENV            = 'test';
  });

  beforeEach(() => {
    mockQuery.mockReset();
    jest.resetModules();
    process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;
  });

  test('encrypt() produces a value that isEncrypted() recognises', () => {
    const blob = encrypt('alice@example.com');
    expect(isEncrypted(blob)).toBe(true);
  });

  test('email round-trip: encrypt then decrypt returns original', () => {
    const email = 'alice@example.com';
    expect(decrypt(encrypt(email))).toBe(email);
  });

  test('two encryptions of the same email produce different blobs (random IV)', () => {
    const email = 'alice@example.com';
    expect(encrypt(email)).not.toBe(encrypt(email));
  });

  test('legacy plaintext email passes through decrypt unchanged', () => {
    // Simulates a row written before encryption was enabled
    expect(decrypt('alice@example.com')).toBe('alice@example.com');
  });
});

describe('userRepository — listUsers does not expose encrypted email in search', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    jest.resetModules();
    process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;
  });

  test('listUsers decrypts email on returned rows', async () => {
    const { encrypt: enc, decrypt: dec } = require('../lib/encryption');
    const encryptedEmail = enc('bob@example.com');

    // First call: SELECT rows; second call: COUNT
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 2, email: encryptedEmail, first_name: 'Bob', last_name: 'Smith', wallet_address: 'G123', role: 'user', created_at: new Date(), updated_at: new Date() }],
      })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] });

    const { listUsers } = require('../db/userRepository');
    const { users } = await listUsers({ search: 'Bob' });

    expect(users[0].email).toBe('bob@example.com');
  });

  test('listUsers search query does NOT include email ILIKE (encrypted email is unsearchable)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const { listUsers } = require('../db/userRepository');
    await listUsers({ search: 'test' });

    const sql = mockQuery.mock.calls[0][0];
    // The search query should not attempt ILIKE on the encrypted email column
    expect(sql).not.toMatch(/email ILIKE/i);
  });
});
