// Feature: transaction history endpoint
// Validates: Requirements #180

// Must be set before requiring server.js
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

const request = require('supertest');

// Stub validateEnv so server.js does not halt on missing env vars
jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));

// Mock the db layer
jest.mock('../db/transactionRepository', () => ({
  getTransactionsByUser: jest.fn(),
}));

jest.mock('../db/userRepository', () => ({
  getUserByWallet: jest.fn(),
}));

const app = require('../server');
const { getTransactionsByUser } = require('../db/transactionRepository');
const { getUserByWallet } = require('../db/userRepository');

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// GET /api/transactions/user/history
// ---------------------------------------------------------------------------
describe('GET /api/transactions/user/history', () => {
  test('200 - returns paginated transactions for valid user', async () => {
    const mockUser = { id: 1, wallet_address: 'GABC123' };
    const mockResult = {
      data: [
        { id: 1, tx_type: 'distribution', amount: '100', created_at: '2026-03-27T10:00:00Z' },
        { id: 2, tx_type: 'redemption', amount: '50', created_at: '2026-03-26T10:00:00Z' },
      ],
      total: 2,
      page: 1,
      limit: 20,
    };

    getUserByWallet.mockResolvedValue(mockUser);
    getTransactionsByUser.mockResolvedValue(mockResult);

    const res = await request(app)
      .get('/api/transactions/user/history')
      .query({ userId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(getTransactionsByUser).toHaveBeenCalledWith(1, {
      type: undefined,
      startDate: undefined,
      endDate: undefined,
      page: 1,
      limit: 20,
    });
  });

  test('200 - returns empty result for user with no transactions', async () => {
    const mockUser = { id: 1, wallet_address: 'GABC123' };
    const mockResult = {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    };

    getUserByWallet.mockResolvedValue(mockUser);
    getTransactionsByUser.mockResolvedValue(mockResult);

    const res = await request(app)
      .get('/api/transactions/user/history')
      .query({ userId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  test('200 - returns last page with fewer results', async () => {
    const mockUser = { id: 1, wallet_address: 'GABC123' };
    const mockResult = {
      data: [{ id: 1, tx_type: 'distribution', amount: '100' }],
      total: 21,
      page: 2,
      limit: 20,
    };

    getUserByWallet.mockResolvedValue(mockUser);
    getTransactionsByUser.mockResolvedValue(mockResult);

    const res = await request(app)
      .get('/api/transactions/user/history')
      .query({ userId: 1, page: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(21);
    expect(res.body.page).toBe(2);
  });

  test('200 - returns empty result for out-of-range page', async () => {
    const mockUser = { id: 1, wallet_address: 'GABC123' };
    const mockResult = {
      data: [],
      total: 10,
      page: 10,
      limit: 20,
    };

    getUserByWallet.mockResolvedValue(mockUser);
    getTransactionsByUser.mockResolvedValue(mockResult);

    const res = await request(app)
      .get('/api/transactions/user/history')
      .query({ userId: 1, page: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(10);
    expect(res.body.page).toBe(10);
  });

  test('200 - filters by transaction type', async () => {
    const mockUser = { id: 1, wallet_address: 'GABC123' };
    const mockResult = {
      data: [{ id: 1, tx_type: 'distribution', amount: '100' }],
      total: 1,
      page: 1,
      limit: 20,
    };

    getUserByWallet.mockResolvedValue(mockUser);
    getTransactionsByUser.mockResolvedValue(mockResult);

    const res = await request(app)
      .get('/api/transactions/user/history')
      .query({ userId: 1, type: 'distribution' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getTransactionsByUser).toHaveBeenCalledWith(1, {
      type: 'distribution',
      startDate: undefined,
      endDate: undefined,
      page: 1,
      limit: 20,
    });
  });

  test('200 - filters by date range', async () => {
    const mockUser = { id: 1, wallet_address: 'GABC123' };
    const mockResult = {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    };

    getUserByWallet.mockResolvedValue(mockUser);
    getTransactionsByUser.mockResolvedValue(mockResult);

    const res = await request(app)
      .get('/api/transactions/user/history')
      .query({
        userId: 1,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getTransactionsByUser).toHaveBeenCalledWith(1, {
      type: undefined,
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      page: 1,
      limit: 20,
    });
  });

  test('400 - rejects when userId is missing', async () => {
    const res = await request(app)
      .get('/api/transactions/user/history');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/userId/i);
  });

  test('400 - rejects when userId is invalid', async () => {
    const res = await request(app)
      .get('/api/transactions/user/history')
      .query({ userId: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/userId/i);
  });

  test('400 - rejects when page is invalid', async () => {
    const res = await request(app)
      .get('/api/transactions/user/history')
      .query({ userId: 1, page: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/page/i);
  });

  test('400 - rejects when limit exceeds maximum', async () => {
    const res = await request(app)
      .get('/api/transactions/user/history')
      .query({ userId: 1, limit: 150 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/limit/i);
  });

  test('400 - rejects when type is invalid', async () => {
    const res = await request(app)
      .get('/api/transactions/user/history')
      .query({ userId: 1, type: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/type/i);
  });

  test('400 - rejects when startDate is invalid', async () => {
    const res = await request(app)
      .get('/api/transactions/user/history')
      .query({ userId: 1, startDate: 'invalid-date' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/startDate/i);
  });

  test('404 - returns not found for non-existent user', async () => {
    getUserByWallet.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/transactions/user/history')
      .query({ userId: 999 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('not_found');
    expect(res.body.message).toMatch(/User not found/i);
  });
});
