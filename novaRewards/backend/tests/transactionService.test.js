process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

jest.mock('../../blockchain/stellarService', () => ({
  server: {
    transactions: jest.fn(),
    payments: jest.fn(),
  },
  NOVA: {
    code: 'NOVA',
    issuer: 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K',
  },
  isValidStellarAddress: jest.fn((value) => typeof value === 'string' && value.startsWith('G')),
}));

jest.mock('../db/transactionRepository', () => ({
  recordTransaction: jest.fn(),
  getTransactionByHash: jest.fn(),
  getTransactionsByUser: jest.fn(),
  getTransactionHistory: jest.fn(),
  processRefund: jest.fn(),
  reconcileTransactions: jest.fn(),
  getTransactionReport: jest.fn(),
}));

jest.mock('../db/index', () => ({
  query: jest.fn(),
}));

jest.mock('../db/userRepository', () => ({
  getUserById: jest.fn(),
}));

const { server } = require('../../blockchain/stellarService');
const repository = require('../db/transactionRepository');
const { query } = require('../db/index');
const { getUserById } = require('../db/userRepository');
const service = require('../services/transactionService');

beforeEach(() => jest.clearAllMocks());

describe('transactionService.recordTransaction', () => {
  test('validates and records a Stellar-backed transaction', async () => {
    server.transactions.mockReturnValue({
      transaction: jest.fn().mockReturnValue({
        call: jest.fn().mockResolvedValue({ ledger_attr: 12345 }),
      }),
    });
    repository.recordTransaction.mockResolvedValue({ id: 1, tx_hash: 'abc123' });

    const result = await service.recordTransaction({
      txHash: 'abc123',
      txType: 'distribution',
      amount: '10.0000000',
      fromWallet: 'GFROM',
      toWallet: 'GTO',
      merchantId: 1,
      userId: 2,
      metadata: { channel: 'pos' },
    });

    expect(result.tx_hash).toBe('abc123');
    expect(repository.recordTransaction).toHaveBeenCalledWith(expect.objectContaining({
      txHash: 'abc123',
      txType: 'distribution',
      stellarLedger: 12345,
      metadata: { channel: 'pos' },
    }));
  });

  test('rejects invalid amount values', async () => {
    await expect(service.recordTransaction({
      txHash: 'abc123',
      txType: 'distribution',
      amount: '-1',
    })).rejects.toMatchObject({
      status: 400,
      code: 'validation_error',
    });
  });
});

describe('transactionService.getUserHistory', () => {
  test('loads user history with validated filters', async () => {
    getUserById.mockResolvedValue({ id: 1 });
    repository.getTransactionsByUser.mockResolvedValue({
      data: [{ tx_hash: 'abc123' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await service.getUserHistory({
      userId: '1',
      status: 'completed',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    expect(result.total).toBe(1);
    expect(repository.getTransactionsByUser).toHaveBeenCalledWith(1, expect.objectContaining({
      status: 'completed',
      page: 1,
      limit: 20,
    }));
  });

  test('rejects reversed date ranges', async () => {
    await expect(service.getUserHistory({
      userId: '1',
      startDate: '2026-03-31',
      endDate: '2026-03-01',
    })).rejects.toMatchObject({
      status: 400,
      code: 'validation_error',
    });
  });
});

describe('transactionService.getWalletHistory', () => {
  test('falls back to PostgreSQL when Horizon is unavailable', async () => {
    server.payments.mockReturnValue({
      forAccount: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            call: jest.fn().mockRejectedValue(new Error('network error')),
          }),
        }),
      }),
    });
    query.mockResolvedValue({ rows: [{ tx_hash: 'db-only' }] });

    const result = await service.getWalletHistory('GWALLET');

    expect(result.source).toBe('database');
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('transactionService.refundTransaction', () => {
  test('validates ownership and creates a refund record', async () => {
    repository.getTransactionByHash.mockResolvedValue({
      tx_hash: 'sale-1',
      tx_type: 'distribution',
      merchant_id: 9,
      status: 'completed',
      amount: '10.0000000',
    });
    server.transactions.mockReturnValue({
      transaction: jest.fn().mockReturnValue({
        call: jest.fn().mockResolvedValue({ ledger_attr: 4321 }),
      }),
    });
    repository.processRefund.mockResolvedValue({
      originalTransaction: { tx_hash: 'sale-1', status: 'refunded' },
      refundTransaction: { tx_hash: 'refund-1', tx_type: 'refund' },
    });

    const result = await service.refundTransaction(9, {
      txHash: 'sale-1',
      refundTxHash: 'refund-1',
      reason: 'Customer request',
    });

    expect(result.refundTransaction.tx_hash).toBe('refund-1');
    expect(repository.processRefund).toHaveBeenCalledWith(expect.objectContaining({
      txHash: 'sale-1',
      refundTxHash: 'refund-1',
      refundReason: 'Customer request',
      stellarLedger: 4321,
    }));
  });
});

describe('transactionService merchant lifecycle helpers', () => {
  test('reconciles merchant transactions', async () => {
    repository.reconcileTransactions.mockResolvedValue({
      count: 2,
      totalAmount: '20.0000000',
      transactions: [],
    });

    const result = await service.reconcileMerchantTransactions(4, {
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      status: 'completed',
    });

    expect(result.count).toBe(2);
    expect(repository.reconcileTransactions).toHaveBeenCalledWith(expect.objectContaining({
      merchantId: 4,
      status: 'completed',
    }));
  });

  test('builds merchant transaction reports', async () => {
    repository.getTransactionReport.mockResolvedValue({
      summary: { total_transactions: '4' },
      breakdown: [],
    });

    const result = await service.getMerchantTransactionReport(7, {
      reconciled: 'false',
      type: 'distribution',
    });

    expect(result.summary.total_transactions).toBe('4');
    expect(repository.getTransactionReport).toHaveBeenCalledWith(expect.objectContaining({
      merchantId: 7,
      type: 'distribution',
      reconciled: false,
    }));
  });
});
