// Feature: nova-rewards — GET /api/transactions/:walletAddress Horizon fallback
// Validates: Requirements 6.1, 6.4, 6.5
// #96: Unit Tests for transaction history route with Horizon fallback
// Covers:
//   1. Mock Horizon to throw a network error
//   2. Assert the route falls back to the PostgreSQL query
//   3. Assert response returns { source: 'database', data: [...] }

process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.ISSUER_PUBLIC = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
process.env.STELLAR_NETWORK = 'testnet';

// Mock stellarService — server.payments() chain throws a network error
jest.mock('../../blockchain/stellarService', () => {
  const { StrKey } = require('stellar-sdk');
  return {
    isValidStellarAddress: jest.fn((addr) => {
      if (typeof addr !== 'string') return false;
      try { return StrKey.isValidEd25519PublicKey(addr); } catch { return false; }
    }),
    server: {
      payments: jest.fn(),
      transactions: jest.fn(),
    },
    NOVA: { code: 'NOVA', issuer: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN' },
  };
});

// Mock DB query
jest.mock('../db/index', () => ({ query: jest.fn() }));

// Mock transactionRepository (not used by this route directly but imported)
jest.mock('../db/transactionRepository', () => ({
  recordTransaction: jest.fn(),
  getTransactionsByMerchant: jest.fn(),
  getMerchantTotals: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { Keypair } = require('stellar-sdk');
const { server } = require('../../blockchain/stellarService');
const { query } = require('../db/index');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/transactions', require('../routes/transactions'));
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || 'internal_error',
      message: err.message,
    });
  });
  return app;
}

describe('GET /api/transactions/:walletAddress — Horizon fallback', () => {
  let app;
  const walletAddress = Keypair.random().publicKey();

  const mockTxRows = [
    { id: 1, tx_hash: 'abc123', tx_type: 'distribution', amount: '10', to_wallet: walletAddress },
    { id: 2, tx_hash: 'def456', tx_type: 'redemption',   amount: '5',  from_wallet: walletAddress },
  ];

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Horizon throws a network error
    const networkError = new Error('Network Error');
    server.payments.mockReturnValue({
      forAccount: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            call: jest.fn().mockRejectedValue(networkError),
          }),
        }),
      }),
    });

    // DB returns mock rows
    query.mockResolvedValue({ rows: mockTxRows });
  });

  test('falls back to PostgreSQL and returns source: database when Horizon throws', async () => {
    const { status, body } = await request(app).get(`/api/transactions/${walletAddress}`);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.source).toBe('database');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(mockTxRows.length);
  });

  test('queries PostgreSQL with the correct wallet address on fallback', async () => {
    await request(app).get(`/api/transactions/${walletAddress}`);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toContain(walletAddress);
  });

  test('returns the exact rows from PostgreSQL in data array', async () => {
    const { body } = await request(app).get(`/api/transactions/${walletAddress}`);

    expect(body.data[0].tx_hash).toBe('abc123');
    expect(body.data[1].tx_hash).toBe('def456');
  });

  test('returns 400 for an invalid wallet address without hitting Horizon or DB', async () => {
    const { status, body } = await request(app).get('/api/transactions/not-a-valid-key');

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('validation_error');
    expect(query).not.toHaveBeenCalled();
    expect(server.payments).not.toHaveBeenCalled();
  });
});
