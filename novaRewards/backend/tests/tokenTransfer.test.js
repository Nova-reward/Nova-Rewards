'use strict';

/**
 * Unit tests for transactionService.js — token transfer business logic.
 * Closes #939
 *
 * All Stellar SDK calls and DB calls are mocked — no network, no DB.
 * Target: 90%+ line coverage on transactionService.
 */

// ── Mock dependencies ─────────────────────────────────────────────────────
jest.mock('../../../blockchain/stellarService', () => ({
  server: {
    transactions: jest.fn(),
    payments: jest.fn(),
  },
  NOVA: { code: 'NOVA', issuer: 'GISSUER' },
  isValidStellarAddress: jest.fn((addr) => /^G[A-Z0-9]{55}$/.test(addr)),
}));

jest.mock('../../db/transactionRepository', () => ({
  recordTransaction:         jest.fn(),
  getTransactionByHash:      jest.fn(),
  getTransactionsByUser:     jest.fn(),
  getTransactionHistory:     jest.fn(),
  processRefund:             jest.fn(),
  reconcileTransactions:     jest.fn(),
  getTransactionReport:      jest.fn(),
}));

jest.mock('../../db/userRepository', () => ({
  getUserById: jest.fn(),
}));

jest.mock('../../db/index', () => ({
  query: jest.fn(),
}));

const VALID_WALLET = 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGH';
const VALID_WALLET_2 = 'GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGH';

const {
  recordTransaction,
  getWalletHistory,
  getUserHistory,
  getMerchantHistory,
  refundTransaction,
  reconcileMerchantTransactions,
  getMerchantTransactionReport,
  TRANSACTION_TYPES,
  REPORTABLE_STATUSES,
} = require('../../services/transactionService');

const stellarService = require('../../../blockchain/stellarService');
const txRepo         = require('../../db/transactionRepository');
const userRepo       = require('../../db/userRepository');
const db             = require('../../db/index');

// ── Helpers ───────────────────────────────────────────────────────────────

function mockStellarTx(ledger = 12345) {
  stellarService.server.transactions.mockReturnValue({
    transaction: jest.fn().mockReturnValue({
      call: jest.fn().mockResolvedValue({ ledger_attr: ledger }),
    }),
  });
}

// ── recordTransaction ─────────────────────────────────────────────────────

describe('recordTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStellarTx();
    txRepo.recordTransaction.mockResolvedValue({ id: 1, tx_hash: 'abc123' });
  });

  it('successful transfer — calls Stellar and inserts DB record', async () => {
    const result = await recordTransaction({
      txHash:     'abc123',
      txType:     'transfer',
      amount:     '10.5',
      fromWallet: VALID_WALLET,
      toWallet:   VALID_WALLET_2,
    });
    expect(result).toMatchObject({ id: 1, tx_hash: 'abc123' });
    expect(txRepo.recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ txHash: 'abc123', amount: '10.5', stellarLedger: 12345 })
    );
  });

  it('throws 400 when txHash is missing', async () => {
    await expect(recordTransaction({ txType: 'transfer', amount: '1' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when amount is zero', async () => {
    await expect(recordTransaction({ txHash: 'abc', txType: 'transfer', amount: '0' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when amount is negative', async () => {
    await expect(recordTransaction({ txHash: 'abc', txType: 'transfer', amount: '-5' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when amount has too many decimal places', async () => {
    await expect(recordTransaction({ txHash: 'abc', txType: 'transfer', amount: '1.12345678' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when amount is missing', async () => {
    await expect(recordTransaction({ txHash: 'abc', txType: 'transfer' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 for invalid fromWallet address', async () => {
    await expect(recordTransaction({
      txHash: 'abc', txType: 'transfer', amount: '1', fromWallet: 'INVALID',
    })).rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 for invalid toWallet address', async () => {
    await expect(recordTransaction({
      txHash: 'abc', txType: 'transfer', amount: '1', toWallet: 'INVALID',
    })).rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 for invalid txType', async () => {
    await expect(recordTransaction({ txHash: 'abc', txType: 'unknown', amount: '1' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 for refund without referenceTxHash', async () => {
    await expect(recordTransaction({ txHash: 'abc', txType: 'refund', amount: '1' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('accepts refund with referenceTxHash', async () => {
    await expect(recordTransaction({
      txHash: 'abc', txType: 'refund', amount: '1', referenceTxHash: 'orig-hash',
    })).resolves.toBeDefined();
  });

  it('throws 400 when Stellar transaction not found', async () => {
    stellarService.server.transactions.mockReturnValue({
      transaction: jest.fn().mockReturnValue({
        call: jest.fn().mockRejectedValue(new Error('not found')),
      }),
    });
    await expect(recordTransaction({ txHash: 'missing', txType: 'transfer', amount: '1' }))
      .rejects.toMatchObject({ status: 400, code: 'tx_not_found' });
  });

  it('throws 400 for invalid metadata (array)', async () => {
    await expect(recordTransaction({
      txHash: 'abc', txType: 'transfer', amount: '1', metadata: [1, 2],
    })).rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('accepts valid metadata object', async () => {
    await expect(recordTransaction({
      txHash: 'abc', txType: 'transfer', amount: '1', metadata: { note: 'test' },
    })).resolves.toBeDefined();
  });

  it('defaults status to "completed" when not provided', async () => {
    await recordTransaction({ txHash: 'abc', txType: 'transfer', amount: '1' });
    expect(txRepo.recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });

  it('accepts all valid transaction types', async () => {
    for (const type of TRANSACTION_TYPES) {
      jest.clearAllMocks();
      mockStellarTx();
      txRepo.recordTransaction.mockResolvedValue({ id: 1 });
      const payload = { txHash: 'abc', txType: type, amount: '1' };
      if (type === 'refund') payload.referenceTxHash = 'orig';
      await expect(recordTransaction(payload)).resolves.toBeDefined();
    }
  });
});

// ── getWalletHistory ──────────────────────────────────────────────────────

describe('getWalletHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws 400 for invalid wallet address', async () => {
    await expect(getWalletHistory('INVALID'))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when wallet address is missing', async () => {
    await expect(getWalletHistory(undefined))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('returns Horizon data on success', async () => {
    const mockRecords = [{ type: 'payment', asset_code: 'NOVA', asset_issuer: 'GISSUER', amount: '5' }];
    stellarService.server.payments.mockReturnValue({
      forAccount: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            call: jest.fn().mockResolvedValue({ records: mockRecords, next: jest.fn().mockResolvedValue({ records: [] }) }),
          }),
        }),
      }),
    });
    const result = await getWalletHistory(VALID_WALLET);
    expect(result.source).toBe('horizon');
    expect(result.data).toHaveLength(1);
  });

  it('falls back to DB when Horizon fails', async () => {
    stellarService.server.payments.mockReturnValue({
      forAccount: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            call: jest.fn().mockRejectedValue(new Error('Horizon down')),
          }),
        }),
      }),
    });
    db.query.mockResolvedValue({ rows: [{ id: 1 }] });
    const result = await getWalletHistory(VALID_WALLET);
    expect(result.source).toBe('database');
    expect(result.data).toHaveLength(1);
  });
});

// ── getUserHistory ────────────────────────────────────────────────────────

describe('getUserHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws 400 when userId is missing', async () => {
    await expect(getUserHistory({}))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when userId is not a positive integer', async () => {
    await expect(getUserHistory({ userId: '-1' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 404 when user does not exist', async () => {
    userRepo.getUserById.mockResolvedValue(null);
    await expect(getUserHistory({ userId: '999' }))
      .rejects.toMatchObject({ status: 404, code: 'not_found' });
  });

  it('returns transactions for valid user', async () => {
    userRepo.getUserById.mockResolvedValue({ id: 1 });
    txRepo.getTransactionsByUser.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    const result = await getUserHistory({ userId: '1' });
    expect(result).toMatchObject({ total: 0 });
  });

  it('throws 400 for invalid type filter', async () => {
    userRepo.getUserById.mockResolvedValue({ id: 1 });
    await expect(getUserHistory({ userId: '1', type: 'invalid' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when limit exceeds 100', async () => {
    userRepo.getUserById.mockResolvedValue({ id: 1 });
    await expect(getUserHistory({ userId: '1', limit: '200' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when startDate is after endDate', async () => {
    userRepo.getUserById.mockResolvedValue({ id: 1 });
    await expect(getUserHistory({ userId: '1', startDate: '2025-12-01', endDate: '2025-01-01' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });
});

// ── refundTransaction ─────────────────────────────────────────────────────

describe('refundTransaction', () => {
  const merchantId = 1;
  const existingTx = {
    id: 10,
    tx_hash: 'orig-hash',
    merchant_id: merchantId,
    status: 'completed',
    amount: '5',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStellarTx();
    txRepo.getTransactionByHash.mockResolvedValue(existingTx);
    txRepo.processRefund.mockResolvedValue({ originalTransaction: existingTx, refundTransaction: { id: 11 } });
  });

  it('successful refund returns original and refund transactions', async () => {
    const result = await refundTransaction(merchantId, {
      txHash: 'orig-hash',
      refundTxHash: 'refund-hash',
      reason: 'Customer request',
    });
    expect(result).toMatchObject({ originalTransaction: existingTx });
  });

  it('throws 400 when txHash is missing', async () => {
    await expect(refundTransaction(merchantId, { refundTxHash: 'r', reason: 'x' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when refundTxHash is missing', async () => {
    await expect(refundTransaction(merchantId, { txHash: 'orig', reason: 'x' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when reason is missing', async () => {
    await expect(refundTransaction(merchantId, { txHash: 'orig', refundTxHash: 'r' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 400 when txHash equals refundTxHash', async () => {
    await expect(refundTransaction(merchantId, { txHash: 'same', refundTxHash: 'same', reason: 'x' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('throws 404 when original transaction not found', async () => {
    txRepo.getTransactionByHash.mockResolvedValue(null);
    await expect(refundTransaction(merchantId, { txHash: 'missing', refundTxHash: 'r', reason: 'x' }))
      .rejects.toMatchObject({ status: 404, code: 'not_found' });
  });

  it('throws 403 when transaction belongs to different merchant', async () => {
    txRepo.getTransactionByHash.mockResolvedValue({ ...existingTx, merchant_id: 999 });
    await expect(refundTransaction(merchantId, { txHash: 'orig-hash', refundTxHash: 'r', reason: 'x' }))
      .rejects.toMatchObject({ status: 403, code: 'forbidden' });
  });

  it('throws 409 when transaction status is not refundable', async () => {
    txRepo.getTransactionByHash.mockResolvedValue({ ...existingTx, status: 'pending' });
    await expect(refundTransaction(merchantId, { txHash: 'orig-hash', refundTxHash: 'r', reason: 'x' }))
      .rejects.toMatchObject({ status: 409, code: 'invalid_transaction_status' });
  });

  it('allows refund of reconciled transactions', async () => {
    txRepo.getTransactionByHash.mockResolvedValue({ ...existingTx, status: 'reconciled' });
    await expect(refundTransaction(merchantId, { txHash: 'orig-hash', refundTxHash: 'r', reason: 'x' }))
      .resolves.toBeDefined();
  });
});

// ── reconcileMerchantTransactions ─────────────────────────────────────────

describe('reconcileMerchantTransactions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls reconcileTransactions with valid params', async () => {
    txRepo.reconcileTransactions.mockResolvedValue({ count: 3, totalAmount: '15', transactions: [] });
    const result = await reconcileMerchantTransactions(1, {});
    expect(result.count).toBe(3);
  });

  it('throws 400 for invalid date range', async () => {
    await expect(reconcileMerchantTransactions(1, { startDate: '2025-12-01', endDate: '2025-01-01' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });
});

// ── getMerchantHistory ────────────────────────────────────────────────────

describe('getMerchantHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns paginated history', async () => {
    txRepo.getTransactionHistory.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    const result = await getMerchantHistory(1, {});
    expect(result).toMatchObject({ total: 0 });
  });

  it('throws 400 for invalid status filter', async () => {
    await expect(getMerchantHistory(1, { status: 'invalid' }))
      .rejects.toMatchObject({ status: 400, code: 'validation_error' });
  });
});

// ── getMerchantTransactionReport ──────────────────────────────────────────

describe('getMerchantTransactionReport', () => {
  it('returns report data', async () => {
    txRepo.getTransactionReport.mockResolvedValue({ total: 100, count: 5 });
    const result = await getMerchantTransactionReport(1, {});
    expect(result).toMatchObject({ total: 100 });
  });
});

// ── Constants ─────────────────────────────────────────────────────────────

describe('module constants', () => {
  it('TRANSACTION_TYPES includes expected types', () => {
    expect(TRANSACTION_TYPES).toEqual(expect.arrayContaining(['distribution', 'redemption', 'transfer', 'refund']));
  });

  it('REPORTABLE_STATUSES includes expected statuses', () => {
    expect(REPORTABLE_STATUSES).toEqual(expect.arrayContaining(['pending', 'completed', 'failed', 'refunded']));
  });
});
