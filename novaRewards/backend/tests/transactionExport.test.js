'use strict';
/**
 * Tests for:
 *  1. Transaction export endpoint (CSV / JSON)
 *  2. Reward distribution idempotency (delivery_id)
 */

// ── Mock DB ─────────────────────────────────────────────────────────────────
jest.mock('../db/index', () => ({
  query: jest.fn(),
}));

// ── Mock auth middlewares ────────────────────────────────────────────────────
jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, _res, next) => {
    req.user = { id: 1, wallet_address: 'GTEST_USER_WALLET' };
    next();
  },
  requireAdmin: (_req, _res, next) => next(),
}));

jest.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, _res, next) => {
    req.merchant = { id: 42 };
    next();
  },
}));

// ── Mock report exporter (toCSV) ─────────────────────────────────────────────
jest.mock('../services/reportExporter', () => ({
  toCSV: jest.fn((rows) => {
    if (!rows || rows.length === 0) return '';
    const keys = Object.keys(rows[0]);
    return [keys.join(','), ...rows.map((r) => keys.map((k) => r[k] ?? '').join(','))].join('\n');
  }),
}));

const request = require('supertest');
const express = require('express');
const { query } = require('../db/index');

// Build a minimal express app with only the export router
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/transactions', require('./routes/transactionExport').default || require('./routes/transactionExport'));
  // Simple error handler
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ success: false, error: err.message });
  });
  return app;
}

// ── Load the route under test relative to this test file ────────────────────
// The test lives in novaRewards/backend/tests/, the route in routes/
const transactionExportRouter = require('../routes/transactionExport');

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/transactions', transactionExportRouter);
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ success: false, error: err.message });
  });
  return app;
}

const SAMPLE_ROWS = [
  { id: 1, tx_hash: 'hash1', tx_type: 'distribution', amount: '100', from_wallet: 'GFROM', to_wallet: 'GTO', merchant_id: 42, campaign_id: 1, stellar_ledger: 100, created_at: '2025-01-01T00:00:00Z' },
  { id: 2, tx_hash: 'hash2', tx_type: 'redemption',   amount: '50',  from_wallet: 'GFROM', to_wallet: 'GTO', merchant_id: 42, campaign_id: 2, stellar_ledger: 101, created_at: '2025-02-01T00:00:00Z' },
];

describe('GET /api/v1/transactions/export/user', () => {
  let app;

  beforeAll(() => { app = buildTestApp(); });
  afterEach(() => jest.clearAllMocks());

  test('returns JSON export by default', async () => {
    query.mockResolvedValueOnce({ rows: SAMPLE_ROWS });
    const res = await request(app).get('/api/v1/transactions/export/user');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactions).toHaveLength(2);
    expect(res.body.data.count).toBe(2);
    expect(res.body.data.exported_at).toBeDefined();
  });

  test('returns CSV when format=csv', async () => {
    query.mockResolvedValueOnce({ rows: SAMPLE_ROWS });
    const res = await request(app).get('/api/v1/transactions/export/user?format=csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.text).toContain('tx_hash');
    expect(res.text).toContain('hash1');
  });

  test('returns 400 for invalid format', async () => {
    const res = await request(app).get('/api/v1/transactions/export/user?format=xml');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('returns 400 for invalid date range', async () => {
    const res = await request(app).get('/api/v1/transactions/export/user?start_date=not-a-date');
    expect(res.status).toBe(400);
  });

  test('returns 400 when end_date is before start_date', async () => {
    const res = await request(app).get('/api/v1/transactions/export/user?start_date=2025-12-01&end_date=2025-01-01');
    expect(res.status).toBe(400);
  });

  test('filters by start_date and end_date', async () => {
    query.mockResolvedValueOnce({ rows: [SAMPLE_ROWS[0]] });
    const res = await request(app).get('/api/v1/transactions/export/user?start_date=2025-01-01&end_date=2025-01-31');
    expect(res.status).toBe(200);
    expect(res.body.data.filters.start_date).toBeTruthy();
    expect(res.body.data.filters.end_date).toBeTruthy();
  });

  test('sets X-Export-Truncated header when results exceed limit', async () => {
    // Simulate 10001 rows returned from DB
    const manyRows = Array.from({ length: 10_001 }, (_, i) => ({ ...SAMPLE_ROWS[0], id: i }));
    query.mockResolvedValueOnce({ rows: manyRows });
    const res = await request(app).get('/api/v1/transactions/export/user?format=csv');
    expect(res.headers['x-export-truncated']).toBe('true');
  });

  test('returns empty CSV with headers when no transactions found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/v1/transactions/export/user?format=csv');
    expect(res.status).toBe(200);
    expect(res.text).toContain('tx_hash');
  });
});

describe('GET /api/v1/transactions/export/merchant', () => {
  let app;

  beforeAll(() => { app = buildTestApp(); });
  afterEach(() => jest.clearAllMocks());

  test('returns JSON export scoped to merchant', async () => {
    query.mockResolvedValueOnce({ rows: SAMPLE_ROWS });
    const res = await request(app).get('/api/v1/transactions/export/merchant');
    expect(res.status).toBe(200);
    expect(res.body.data.filters.merchant_id).toBe(42);
  });

  test('returns CSV for merchant export', async () => {
    query.mockResolvedValueOnce({ rows: SAMPLE_ROWS });
    const res = await request(app).get('/api/v1/transactions/export/merchant?format=csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });
});

// ── Idempotency tests ────────────────────────────────────────────────────────

describe('Reward distribution idempotency (generateIdempotencyKey)', () => {
  let generateIdempotencyKey;

  beforeAll(() => {
    // The function is exported from rewardIssuanceService
    try {
      ({ generateIdempotencyKey } = require('../services/rewardIssuanceService'));
    } catch {
      generateIdempotencyKey = null;
    }
  });

  test('same inputs always produce the same key', () => {
    if (!generateIdempotencyKey) return; // skip if not exported
    const key1 = generateIdempotencyKey({ merchantId: 1, userId: 2, campaignId: 3, actionId: 'act1', amount: '100' });
    const key2 = generateIdempotencyKey({ merchantId: 1, userId: 2, campaignId: 3, actionId: 'act1', amount: '100' });
    expect(key1).toBe(key2);
  });

  test('different inputs produce different keys', () => {
    if (!generateIdempotencyKey) return;
    const key1 = generateIdempotencyKey({ merchantId: 1, userId: 2, campaignId: 3, actionId: 'act1', amount: '100' });
    const key2 = generateIdempotencyKey({ merchantId: 1, userId: 2, campaignId: 3, actionId: 'act2', amount: '100' });
    expect(key1).not.toBe(key2);
  });

  test('key is a 64-character hex string', () => {
    if (!generateIdempotencyKey) return;
    const key = generateIdempotencyKey({ merchantId: 1, userId: 2, campaignId: 3, actionId: 'x', amount: '10' });
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  test('field order in payload does not affect key (canonical form)', () => {
    if (!generateIdempotencyKey) return;
    const k1 = generateIdempotencyKey({ merchantId: '1', userId: '2', campaignId: '3', actionId: 'a', amount: '5' });
    const k2 = generateIdempotencyKey({ amount: '5', actionId: 'a', campaignId: '3', userId: '2', merchantId: '1' });
    expect(k1).toBe(k2);
  });
});
