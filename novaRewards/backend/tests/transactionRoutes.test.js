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
  getReferredUsers: jest.fn(),
  getReferralPointsEarned: jest.fn(),
  hasReferralBonusBeenClaimed: jest.fn(),
  getUnprocessedReferrals: jest.fn(),
  markReferralBonusClaimed: jest.fn(),
}));

jest.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, _res, next) => {
    req.merchant = { id: 1 };
    next();
  },
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

jest.mock('../db/transactionRepository', () => ({
  getMerchantTotals: jest.fn(),
}));

const router = require('../routes/transactions');
const { getMerchantTotals } = require('../db/transactionRepository');
const {
  recordTransaction,
  getMerchantHistory,
  refundTransaction,
  reconcileMerchantTransactions,
  getMerchantTransactionReport,
} = require('../services/transactionService');

function getRouteHandlers(method, path) {
  const layer = router.stack.find(
    (candidate) => candidate.route && candidate.route.path === path && candidate.route.methods[method]
  );

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }

  return layer.route.stack.map((entry) => entry.handle);
}

async function invokeRoute(method, path, { body = {}, query = {}, params = {} } = {}) {
  const handlers = getRouteHandlers(method, path);
  const req = { body, query, params, headers: {} };
  let statusCode = 200;
  let payload;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };

  for (const handler of handlers) {
    let nextCalled = false;
    let nextError;

    await Promise.resolve(handler(req, res, (err) => {
      nextCalled = true;
      nextError = err;
    }));

    if (nextError) {
      throw nextError;
    }

    if (!nextCalled) {
      break;
    }
  }

  return { status: statusCode, body: payload, req };
}

beforeEach(() => jest.clearAllMocks());

describe('transaction routes', () => {
  test('POST /record returns 201 for successful records', async () => {
    recordTransaction.mockResolvedValue({ id: 1, tx_hash: 'abc123' });

    const result = await invokeRoute('post', '/record', {
      body: { txHash: 'abc123', txType: 'distribution', amount: '10' },
    });

    expect(result.status).toBe(201);
    expect(result.body.data.tx_hash).toBe('abc123');
  });

  test('POST /record returns 409 for duplicate transactions', async () => {
    const err = new Error('duplicate');
    err.code = '23505';
    recordTransaction.mockRejectedValue(err);

    const result = await invokeRoute('post', '/record', {
      body: { txHash: 'abc123', txType: 'distribution', amount: '10' },
    });

    expect(result.status).toBe(409);
    expect(result.body.error).toBe('duplicate_transaction');
  });

  test('GET /merchant-totals returns merchant totals', async () => {
    getMerchantTotals.mockResolvedValue({ totalDistributed: '100', totalRedeemed: '20' });

    const result = await invokeRoute('get', '/merchant-totals');

    expect(result.status).toBe(200);
    expect(result.body.data.totalDistributed).toBe('100');
  });

  test('GET /merchant/history returns merchant history', async () => {
    getMerchantHistory.mockResolvedValue({
      data: [{ tx_hash: 'abc123', status: 'completed' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await invokeRoute('get', '/merchant/history', {
      query: { status: 'completed' },
    });

    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(1);
    expect(getMerchantHistory).toHaveBeenCalledWith(1, { status: 'completed' });
  });

  test('POST /refund returns 201 when a refund is processed', async () => {
    refundTransaction.mockResolvedValue({
      originalTransaction: { tx_hash: 'sale-1', status: 'refunded' },
      refundTransaction: { tx_hash: 'refund-1', tx_type: 'refund' },
    });

    const result = await invokeRoute('post', '/refund', {
      body: { txHash: 'sale-1', refundTxHash: 'refund-1', reason: 'Customer request' },
    });

    expect(result.status).toBe(201);
    expect(result.body.data.refundTransaction.tx_hash).toBe('refund-1');
  });

  test('POST /reconcile returns reconciliation details', async () => {
    reconcileMerchantTransactions.mockResolvedValue({
      count: 2,
      totalAmount: '30.0000000',
      transactions: [{ tx_hash: 'one' }, { tx_hash: 'two' }],
    });

    const result = await invokeRoute('post', '/reconcile', {
      body: { startDate: '2026-03-01', endDate: '2026-03-31' },
    });

    expect(result.status).toBe(200);
    expect(result.body.data.count).toBe(2);
  });

  test('GET /report returns merchant reporting data', async () => {
    getMerchantTransactionReport.mockResolvedValue({
      summary: { total_transactions: '2', total_amount: '50.0000000' },
      breakdown: [{ tx_type: 'distribution', status: 'completed', transaction_count: '2' }],
    });

    const result = await invokeRoute('get', '/report', {
      query: { startDate: '2026-03-01', endDate: '2026-03-31' },
    });

    expect(result.status).toBe(200);
    expect(result.body.data.summary.total_transactions).toBe('2');
  });
});
