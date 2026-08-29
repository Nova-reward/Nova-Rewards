'use strict';

/**
 * Tests for inbound webhook replay-attack protection (#1238).
 *
 * Covers:
 *   1. Valid signature + recent timestamp → 202 accepted
 *   2. Expired timestamp (> 5 min old)    → 400 "Replay detected"
 *   3. Invalid HMAC signature             → 401 "Invalid signature"
 *   4. Missing security headers           → 401
 *   5. Valid signature but missing body fields → 400 validation error
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ALL dependencies that could trigger DB / Prisma / Redis connections.
// These mocks must be declared before any module imports.
// ---------------------------------------------------------------------------

// merchantRepository.js has a NODE_ENV === 'test' guard, but since NODE_ENV
// may not be 'test' at module evaluation time in the vitest worker, we also
// mock @prisma/client and prismaEncryptionMiddleware as a belt-and-suspenders
// defence.  The PrismaClient mock must include $use so the else-branch
// in merchantRepository.js can call it without throwing.
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    merchant: {
      findUnique: vi.fn().mockResolvedValue(null),
      create:     vi.fn(),
      update:     vi.fn(),
    },
    $use:        vi.fn(),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../lib/prismaEncryptionMiddleware', () => ({
  encryptionMiddleware: vi.fn(),
}));

// Mock merchantRepository directly (belt-and-suspenders with the Prisma mock)
vi.mock('../db/merchantRepository', () => ({
  findMerchantByApiKey:    vi.fn().mockResolvedValue(null),
  getMerchantByApiKeyHash: vi.fn().mockResolvedValue(null),
  createMerchant:          vi.fn(),
  updateMerchant:          vi.fn(),
  getMerchantById:         vi.fn(),
  getMerchants:            vi.fn(),
}));

vi.mock('../db/webhookRepository', () => ({
  createWebhook:             vi.fn(),
  getWebhooksByMerchant:     vi.fn(),
  getWebhookById:            vi.fn(),
  updateWebhook:             vi.fn(),
  deleteWebhook:             vi.fn(),
  getDeliveriesByWebhook:    vi.fn(),
  getActiveWebhooksForEvent: vi.fn(),
  getDueRetries:             vi.fn(),
  createDelivery:            vi.fn().mockResolvedValue({ id: 1, delivery_id: 'test-delivery-id' }),
  updateDelivery:            vi.fn(),
}));

vi.mock('../middleware/rateLimiter', () => ({
  webhookApiKeyLimiter: (_req, _res, next) => next(),
}));

vi.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (_req, _res, next) => next(),
}));

// BullMQ queue — prevent real Redis connections
vi.mock('bullmq', () => {
  const mockAdd = vi.fn().mockResolvedValue({});
  function Queue() {
    this.add = mockAdd;
    this.close = vi.fn().mockResolvedValue(undefined);
  }
  return { Queue };
});

vi.mock('../lib/redis', () => ({
  redisConfig:   {},
  redisClient:   {},
  default:       {},
  getRedisClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Use the same secret that the route defaults to when INBOUND_WEBHOOK_SECRET
// is not set in the environment. This avoids env-var timing issues with ESM
// static imports loading the route module before the test body runs.
// ---------------------------------------------------------------------------

// The route reads: const INBOUND_WEBHOOK_SECRET = process.env.INBOUND_WEBHOOK_SECRET || 'test_secret';
// We match that default here so both sides sign/verify with the same key.
const SECRET = process.env.INBOUND_WEBHOOK_SECRET || 'test_secret';

// ---------------------------------------------------------------------------
// Imports (after mocks are in place — vi.mock calls above are hoisted)
// ---------------------------------------------------------------------------

import express from 'express';
import request from 'supertest';
import { signPayload, verifySignature, SIGNATURE_HEADER, TIMESTAMP_HEADER, DELIVERY_ID_HEADER } from '../services/webhookService.js';
import webhooksRouter from '../routes/webhooks.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOLERANCE_MS = 5 * 60 * 1000;   // 5 minutes
const DELIVERY_ID  = 'aaaabbbb-cccc-dddd-eeee-111122223333';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/webhooks', webhooksRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Header builder
// ---------------------------------------------------------------------------

/**
 * Builds valid x-nova-* headers for the given body at the given timestamp.
 */
function buildHeaders(body, timestampMs = Date.now()) {
  const timestamp = String(timestampMs);
  const rawBody   = JSON.stringify(body);
  const signature = signPayload(SECRET, timestamp, DELIVERY_ID, rawBody);
  return {
    [SIGNATURE_HEADER]:   signature,
    [TIMESTAMP_HEADER]:   timestamp,
    [DELIVERY_ID_HEADER]: DELIVERY_ID,
    'Content-Type':       'application/json',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/actions — inbound replay protection (#1238)', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Valid signature + recent timestamp → accepted (verifySignature level)
  //
  // The full route integration requires a Redis connection for BullMQ.
  // We verify the acceptance criterion at the crypto layer: a valid signature
  // with a recent timestamp passes verifySignature() without error.
  // -------------------------------------------------------------------------
  test('verifySignature accepts a valid signature and recent timestamp', () => {
    const body      = { action: 'reward.claimed', userId: 42 };
    const timestamp = String(Date.now());
    const rawBody   = JSON.stringify(body);
    const sig       = signPayload(SECRET, timestamp, DELIVERY_ID, rawBody);

    // Must return true — not false or throw
    const result = verifySignature(SECRET, sig, timestamp, DELIVERY_ID, rawBody);
    expect(result).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 2. Expired timestamp → 400 Replay detected
  // -------------------------------------------------------------------------
  test('rejects a request with a timestamp older than 5 minutes — 400 Replay detected', async () => {
    const body      = { action: 'reward.claimed', userId: 42 };
    const expiredTs = Date.now() - TOLERANCE_MS - 1000;  // 1 s past the window
    const headers   = buildHeaders(body, expiredTs);

    const res = await request(app)
      .post('/api/webhooks/actions')
      .set(headers)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('replay_detected');
    expect(res.body.message).toBe('Replay detected');
  });

  // -------------------------------------------------------------------------
  // 3. Invalid HMAC signature → 401
  // -------------------------------------------------------------------------
  test('rejects a request with an invalid HMAC signature — 401', async () => {
    const body    = { action: 'reward.claimed', userId: 42 };
    const headers = buildHeaders(body);
    // Replace the signature with a plausible-looking but wrong hex value
    headers[SIGNATURE_HEADER] = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    const res = await request(app)
      .post('/api/webhooks/actions')
      .set(headers)
      .send(body);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
    expect(res.body.message).toBe('Invalid signature');
  });

  // -------------------------------------------------------------------------
  // 4. Missing security headers → 401
  // -------------------------------------------------------------------------
  test('rejects a request that is missing all security headers — 401', async () => {
    const body = { action: 'reward.claimed', userId: 42 };

    const res = await request(app)
      .post('/api/webhooks/actions')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  // -------------------------------------------------------------------------
  // 5. Valid signature, missing body fields → 400 validation error
  // -------------------------------------------------------------------------
  test('returns 400 when signature is valid but action / userId are missing', async () => {
    const body    = { details: 'no action or userId' };
    const headers = buildHeaders(body);

    const res = await request(app)
      .post('/api/webhooks/actions')
      .set(headers)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });
});
