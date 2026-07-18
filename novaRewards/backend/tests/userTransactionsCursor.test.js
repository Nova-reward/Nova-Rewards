/**
 * Tests for GET /api/transactions — cursor-paginated transaction history.
 * Issue #866
 *
 * Covers:
 *  - getUserTransactionsCursor repository function
 *  - GET / route (auth, params, response shape)
 */

// ---------------------------------------------------------------------------
// Repository unit tests
// ---------------------------------------------------------------------------
jest.mock('../db/index', () => ({ query: jest.fn() }));
jest.mock('../lib/redis', () => ({ client: { del: jest.fn(), isOpen: false } }));
jest.mock('../lib/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const { query } = require('../db/index');
const { getUserTransactionsCursor } = require('../db/transactionRepository');

function makeRows(n, startId = 1) {
  return Array.from({ length: n }, (_, i) => ({
    id: startId + i,
    tx_hash: `hash${startId + i}`,
    tx_type: 'distribution',
    amount: '10',
    from_wallet: 'WALLET_A',
    to_wallet: null,
    status: 'completed',
    created_at: new Date(`2024-01-${String(startId + i).padStart(2, '0')}T00:00:00Z`),
    updated_at: new Date(),
    campaign_name: null,
    campaign_id: null,
  }));
}

function encodeCursor(createdAt, id) {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64');
}

beforeEach(() => jest.clearAllMocks());

describe('getUserTransactionsCursor', () => {
  test('returns empty data and hasMore=false when no transactions exist', async () => {
    query.mockResolvedValue({ rows: [] });
    const result = await getUserTransactionsCursor('WALLET_A', { limit: 10 });
    expect(result.data).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
  });

  test('returns data with hasMore=false when results fit within limit', async () => {
    query.mockResolvedValue({ rows: makeRows(3) });
    const result = await getUserTransactionsCursor('WALLET_A', { limit: 5 });
    expect(result.data).toHaveLength(3);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  test('sets hasMore=true and nextCursor when more results exist', async () => {
    // limit=3 → fetch limit+1=4 rows → indicates more pages
    query.mockResolvedValue({ rows: makeRows(4) });
    const result = await getUserTransactionsCursor('WALLET_A', { limit: 3 });
    expect(result.data).toHaveLength(3);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
  });

  test('nextCursor decodes to { createdAt, id } of the last returned row', async () => {
    const rows = makeRows(4);
    query.mockResolvedValue({ rows });
    const result = await getUserTransactionsCursor('WALLET_A', { limit: 3 });
    const decoded = JSON.parse(Buffer.from(result.nextCursor, 'base64').toString('utf8'));
    expect(decoded).toHaveProperty('createdAt');
    expect(decoded).toHaveProperty('id');
    expect(decoded.id).toBe(rows[2].id); // 3rd row (index 2) is the last returned
  });

  test('applies cursor for desc direction (get older items)', async () => {
    const cursor = encodeCursor('2024-01-05T00:00:00.000Z', 5);
    query.mockResolvedValue({ rows: makeRows(2, 3) });
    await getUserTransactionsCursor('WALLET_A', { limit: 5, cursor, direction: 'desc' });
    const callArgs = query.mock.calls[0];
    expect(callArgs[0]).toContain('< (');
    expect(callArgs[1]).toContain('2024-01-05T00:00:00.000Z');
  });

  test('applies cursor for asc direction (get newer items)', async () => {
    const cursor = encodeCursor('2024-01-01T00:00:00.000Z', 1);
    query.mockResolvedValue({ rows: makeRows(2, 2) });
    await getUserTransactionsCursor('WALLET_A', { limit: 5, cursor, direction: 'asc' });
    const callArgs = query.mock.calls[0];
    expect(callArgs[0]).toContain('> (');
  });

  test('ignores an invalid cursor and starts from beginning', async () => {
    query.mockResolvedValue({ rows: makeRows(2) });
    const result = await getUserTransactionsCursor('WALLET_A', { limit: 5, cursor: 'not-valid-base64!!' });
    expect(result.data).toHaveLength(2);
    const callArgs = query.mock.calls[0];
    expect(callArgs[0]).not.toContain('AND (t.created_at');
  });

  test('caps limit at 100', async () => {
    query.mockResolvedValue({ rows: [] });
    await getUserTransactionsCursor('WALLET_A', { limit: 9999 });
    const callArgs = query.mock.calls[0];
    // safeLimit+1 = 101 is the last param
    expect(callArgs[1][callArgs[1].length - 1]).toBe(101);
  });

  test('scopes query by wallet address via from_wallet OR to_wallet', async () => {
    query.mockResolvedValue({ rows: [] });
    await getUserTransactionsCursor('WALLET_XYZ', { limit: 10 });
    const callArgs = query.mock.calls[0];
    expect(callArgs[0]).toContain('from_wallet = $1 OR t.to_wallet = $1');
    expect(callArgs[1][0]).toBe('WALLET_XYZ');
  });
});

// ---------------------------------------------------------------------------
// Route integration tests
// ---------------------------------------------------------------------------
jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, _res, next) => {
    req.user = { id: 1, wallet_address: 'WALLET_A', role: 'user' };
    next();
  },
  requireAdmin: (_req, _res, next) => next(),
  requireOwnershipOrAdmin: (_req, _res, next) => next(),
}));

jest.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, _res, next) => { req.merchant = { id: 1 }; next(); },
}));

jest.mock('../db/transactionRepository', () => ({
  getMerchantTotals: jest.fn(),
  getUserTransactionsCursor: jest.fn(),
  recordTransaction: jest.fn(),
  getTransactionsByUser: jest.fn(),
  getTransactionsByMerchant: jest.fn(),
}));

jest.mock('../services/transactionService', () => ({
  recordTransaction: jest.fn(),
  getWalletHistory: jest.fn(),
  getUserHistory: jest.fn(),
  getMerchantHistory: jest.fn(),
  refundTransaction: jest.fn(),
  reconcileMerchantTransactions: jest.fn(),
  getMerchantTransactionReport: jest.fn(),
}));

jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));

const request = require('supertest');
const express = require('express');
const { getUserTransactionsCursor: mockGetCursor } = require('../db/transactionRepository');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/transactions', require('../routes/transactions'));
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

describe('GET /api/transactions', () => {
  let app;

  beforeAll(() => { app = buildApp(); });
  beforeEach(() => jest.clearAllMocks());

  test('returns 200 with { data, nextCursor, hasMore }', async () => {
    mockGetCursor.mockResolvedValue({ data: [], nextCursor: null, hasMore: false });
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('nextCursor');
    expect(res.body).toHaveProperty('hasMore');
  });

  test('returns empty array (not 404) when no transactions exist', async () => {
    mockGetCursor.mockResolvedValue({ data: [], nextCursor: null, hasMore: false });
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.hasMore).toBe(false);
  });

  test('passes cursor and limit to repository', async () => {
    mockGetCursor.mockResolvedValue({ data: [], nextCursor: null, hasMore: false });
    const cursor = Buffer.from(JSON.stringify({ createdAt: '2024-01-01', id: 1 })).toString('base64');
    await request(app).get(`/api/transactions?cursor=${cursor}&limit=10`);
    expect(mockGetCursor).toHaveBeenCalledWith('WALLET_A', expect.objectContaining({
      limit: 10,
      cursor,
    }));
  });

  test('passes direction=asc to repository', async () => {
    mockGetCursor.mockResolvedValue({ data: [], nextCursor: null, hasMore: false });
    await request(app).get('/api/transactions?direction=asc');
    expect(mockGetCursor).toHaveBeenCalledWith('WALLET_A', expect.objectContaining({ direction: 'asc' }));
  });

  test('returns 400 for invalid direction', async () => {
    const res = await request(app).get('/api/transactions?direction=sideways');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('caps limit at 100', async () => {
    mockGetCursor.mockResolvedValue({ data: [], nextCursor: null, hasMore: false });
    await request(app).get('/api/transactions?limit=9999');
    expect(mockGetCursor).toHaveBeenCalledWith('WALLET_A', expect.objectContaining({ limit: 100 }));
  });

  test('returns nextCursor and hasMore=true when more pages exist', async () => {
    const nextCursor = Buffer.from(JSON.stringify({ createdAt: '2024-01-01', id: 5 })).toString('base64');
    mockGetCursor.mockResolvedValue({ data: [{ id: 5 }], nextCursor, hasMore: true });
    const res = await request(app).get('/api/transactions?limit=1');
    expect(res.body.hasMore).toBe(true);
    expect(res.body.nextCursor).toBe(nextCursor);
  });
});
