// Coverage tests for transaction routes (record, wallet history, merchant-totals)
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../services/emailService', () => ({ sendWelcome: jest.fn() }));
jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, res, next) => { req.user = { id: 1, role: 'user' }; next(); },
  requireAdmin: (req, res, next) => next(),
  requireOwnershipOrAdmin: (req, res, next) => next(),
}));

jest.mock('../db/transactionRepository', () => ({
  recordTransaction: jest.fn(),
  getTransactionsByUser: jest.fn(),
  getTransactionsByMerchant: jest.fn(),
  getMerchantTotals: jest.fn(),
}));

jest.mock('../db/userRepository', () => ({
  getUserByWallet: jest.fn(),
  getUserById: jest.fn(),
  createUser: jest.fn(),
  exists: jest.fn(),
  getPublicProfile: jest.fn(),
  getPrivateProfile: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  isAdmin: jest.fn(),
  findById: jest.fn(),
  findByWalletAddress: jest.fn(),
  getPublicProfile: jest.fn(),
  getPrivateProfile: jest.fn(),
  getReferredUsers: jest.fn(),
  getReferralPointsEarned: jest.fn(),
  hasReferralBonusBeenClaimed: jest.fn(),
  getUnprocessedReferrals: jest.fn(),
  markReferralBonusClaimed: jest.fn(),
}));

jest.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, res, next) => {
    req.merchant = { id: 1 };
    next();
  },
}));

jest.mock('../../blockchain/stellarService', () => ({
  server: { transactions: jest.fn(), payments: jest.fn() },
  NOVA: { code: 'NOVA', issuer: 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K' },
  isValidStellarAddress: jest.fn((addr) => {
    try {
      const { StrKey } = require('stellar-sdk');
      return StrKey.isValidEd25519PublicKey(addr);
    } catch { return false; }
  }),
}));

const request = require('supertest');
const { Keypair } = require('stellar-sdk');
const app = require('../server');
const { recordTransaction, getMerchantTotals } = require('../db/transactionRepository');
const { server: stellarServer } = require('../../blockchain/stellarService');

beforeEach(() => jest.clearAllMocks());

describe('POST /api/transactions/record', () => {
  test('400 - missing txHash', async () => {
    const res = await request(app).post('/api/transactions/record').send({ txType: 'distribution' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('400 - invalid txType', async () => {
    const res = await request(app).post('/api/transactions/record').send({ txHash: 'abc', txType: 'invalid' });
    expect(res.status).toBe(400);
  });

  test('400 - invalid fromWallet', async () => {
    const res = await request(app).post('/api/transactions/record').send({
      txHash: 'abc', txType: 'distribution', fromWallet: 'bad-wallet',
    });
    expect(res.status).toBe(400);
  });

  test('400 - tx not found on Horizon', async () => {
    stellarServer.transactions.mockReturnValue({
      transaction: jest.fn().mockReturnValue({
        call: jest.fn().mockRejectedValue(new Error('not found')),
      }),
    });
    const res = await request(app).post('/api/transactions/record').send({
      txHash: 'abc123', txType: 'distribution',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('tx_not_found');
  });

  test('201 - records transaction successfully', async () => {
    stellarServer.transactions.mockReturnValue({
      transaction: jest.fn().mockReturnValue({
        call: jest.fn().mockResolvedValue({ ledger_attr: 12345 }),
      }),
    });
    recordTransaction.mockResolvedValue({ id: 1, tx_hash: 'abc123' });

    const res = await request(app).post('/api/transactions/record').send({
      txHash: 'abc123', txType: 'distribution', amount: '10',
      fromWallet: Keypair.random().publicKey(),
      toWallet: Keypair.random().publicKey(),
    });
    expect(res.status).toBe(201);
  });

  test('409 - duplicate transaction', async () => {
    stellarServer.transactions.mockReturnValue({
      transaction: jest.fn().mockReturnValue({
        call: jest.fn().mockResolvedValue({ ledger_attr: 12345 }),
      }),
    });
    const err = new Error('duplicate');
    err.code = '23505';
    recordTransaction.mockRejectedValue(err);

    const res = await request(app).post('/api/transactions/record').send({
      txHash: 'abc123', txType: 'distribution',
    });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/transactions/merchant-totals', () => {
  test('200 - returns merchant totals', async () => {
    getMerchantTotals.mockResolvedValue({ totalDistributed: '100', totalRedeemed: '20' });
    const res = await request(app).get('/api/transactions/merchant-totals');
    expect(res.status).toBe(200);
    expect(res.body.data.totalDistributed).toBe('100');
  });
});
