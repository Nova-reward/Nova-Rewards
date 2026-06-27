'use strict';

/**
 * Tests that webhooks.secret is encrypted at rest and decrypted on read.
 * Requirements: #651
 */

const TEST_KEY = 'a'.repeat(64);

// Mock the pg query so we can inspect what gets written to the DB
const mockQuery = jest.fn();
jest.mock('../db/index', () => ({ query: mockQuery }));

// Provide a real encryption key
process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;

const { encrypt, decrypt, isEncrypted } = require('../lib/encryption');
const {
  createWebhook,
  getWebhookById,
  getActiveWebhooksForEvent,
  getDueRetries,
} = require('../db/webhookRepository');

const PLAINTEXT_SECRET = 'abc123plaintextsecret';

describe('webhookRepository — field-level encryption', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test('createWebhook stores an encrypted secret, not plaintext', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, merchant_id: 1, url: 'https://example.com', events: ['*'], is_active: true, created_at: new Date() }],
    });

    await createWebhook({ merchantId: 1, url: 'https://example.com', secret: PLAINTEXT_SECRET, events: ['*'] });

    const storedSecret = mockQuery.mock.calls[0][1][2]; // 3rd param = secret
    expect(storedSecret).not.toBe(PLAINTEXT_SECRET);
    expect(isEncrypted(storedSecret)).toBe(true);
    expect(decrypt(storedSecret)).toBe(PLAINTEXT_SECRET);
  });

  test('getWebhookById decrypts the secret on read', async () => {
    const encryptedSecret = encrypt(PLAINTEXT_SECRET);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, merchant_id: 1, url: 'https://example.com', secret: encryptedSecret, events: ['*'], is_active: true }],
    });

    const webhook = await getWebhookById(1);
    expect(webhook.secret).toBe(PLAINTEXT_SECRET);
  });

  test('getActiveWebhooksForEvent decrypts secrets on read', async () => {
    const encryptedSecret = encrypt(PLAINTEXT_SECRET);
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, merchant_id: 1, url: 'https://a.com', secret: encryptedSecret, events: ['reward.distributed'], is_active: true },
        { id: 2, merchant_id: 2, url: 'https://b.com', secret: encrypt('other-secret'), events: ['*'], is_active: true },
      ],
    });

    const webhooks = await getActiveWebhooksForEvent('reward.distributed');
    expect(webhooks[0].secret).toBe(PLAINTEXT_SECRET);
    expect(webhooks[1].secret).toBe('other-secret');
  });

  test('getDueRetries decrypts secrets on read', async () => {
    const encryptedSecret = encrypt(PLAINTEXT_SECRET);
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 10, webhook_id: 1, url: 'https://example.com', secret: encryptedSecret, status: 'failed', attempt: 1 },
      ],
    });

    const retries = await getDueRetries(5);
    expect(retries[0].secret).toBe(PLAINTEXT_SECRET);
  });

  test('getWebhooksByMerchant does NOT expose the secret column', async () => {
    // The listing query intentionally omits the secret column
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, merchant_id: 1, url: 'https://example.com', events: ['*'], is_active: true, created_at: new Date(), updated_at: new Date() }],
    });

    const { getWebhooksByMerchant } = require('../db/webhookRepository');
    const webhooks = await getWebhooksByMerchant(1);
    expect(webhooks[0].secret).toBeUndefined();
  });
});
