/**
 * Tests for the Stellar Transaction Submission Service.
 *
 * Covers:
 *  - stellarTransactionService.submit()  (build, sign, submit, fee-bump retry, DB storage)
 *  - stellarTransactionService.submitFeeBump()  (explicit fee-bump from XDR)
 *  - stellarTransactionService.parseTransactionResult()
 *  - stellarTransactionService.extractResultCodes()
 *  - stellarTransactionService.getSequenceNumber()
 *  - Route: POST /api/transactions/submit
 *  - Route: POST /api/transactions/fee-bump
 *  - Route: GET  /api/transactions/sequence/:publicKey
 */

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
jest.mock('../../blockchain/stellarService', () => ({
  server: {
    loadAccount: jest.fn(),
    submitTransaction: jest.fn(),
    transactions: jest.fn(() => ({
      transaction: jest.fn(() => ({
        call: jest.fn(),
      })),
    })),
  },
  NOVA: { code: 'NOVA', issuer: 'GTESTISSUER' },
  isValidStellarAddress: jest.fn((addr) => {
    if (typeof addr !== 'string') return false;
    try {
      const { StrKey } = require('stellar-sdk');
      return StrKey.isValidEd25519PublicKey(addr);
    } catch {
      return false;
    }
  }),
}));

jest.mock('../db/transactionRepository', () => ({
  recordTransaction: jest.fn(),
}));

jest.mock('../lib/redis', () => ({
  client: { isOpen: true, get: jest.fn(), set: jest.fn(), del: jest.fn() },
  connectRedis: jest.fn(),
}));

jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, res, next) => {
    req.user = { id: 1, role: 'user' };
    next();
  },
  requireAdmin: (req, res, next) => next(),
}));

jest.mock('../middleware/rateLimiter', () => ({
  slidingAuth: (req, res, next) => next(),
  slidingGlobal: (req, res, next) => next(),
}));

const express = require('express');
const request = require('supertest');
const {
  Keypair,
  Account,
  Operation,
  Asset,
  TransactionBuilder,
  Networks,
  BASE_FEE,
} = require('stellar-sdk');

const { server } = require('../../blockchain/stellarService');
const { recordTransaction } = require('../db/transactionRepository');
const stellarTxService = require('../services/stellarTransactionService');

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.STELLAR_NETWORK = 'testnet';

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/transactions', require('../routes/stellarTransaction'));
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || 'internal_error',
      message: err.message || 'An unexpected error occurred',
    });
  });
  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockAccount(publicKey, sequence = '12345') {
  return new Account(publicKey, sequence);
}

function buildSignedTx(sourceKeypair, destination, amount = '10') {
  const account = mockAccount(sourceKeypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination,
        asset: Asset.native(),
        amount,
      }),
    )
    .setTimeout(180)
    .build();
  tx.sign(sourceKeypair);
  return tx;
}

// ---------------------------------------------------------------------------
// Tests: stellarTransactionService internals
// ---------------------------------------------------------------------------
describe('stellarTransactionService — parseTransactionResult', () => {
  it('parses a successful result', () => {
    const result = stellarTxService.parseTransactionResult({
      hash: 'abc123',
      ledger: 42,
      successful: true,
      result_xdr: 'AAAAAA==',
    });

    expect(result.txHash).toBe('abc123');
    expect(result.ledger).toBe(42);
    expect(result.status).toBe('completed');
    expect(result.successful).toBe(true);
    expect(result.resultXdr).toBe('AAAAAA==');
  });

  it('parses a failed result', () => {
    const result = stellarTxService.parseTransactionResult({
      hash: 'def456',
      ledger: 99,
      successful: false,
      result_xdr: 'BBBBBB==',
    });

    expect(result.status).toBe('failed');
    expect(result.successful).toBe(false);
  });
});

describe('stellarTransactionService — extractResultCodes', () => {
  it('extracts result codes from Horizon error', () => {
    const err = {
      response: {
        data: {
          extras: {
            result_codes: {
              transaction: ['tx_bad_seq'],
              operations: ['op_no_source_account'],
            },
          },
        },
      },
    };

    const codes = stellarTxService.extractResultCodes(err);
    expect(codes).toContain('tx_bad_seq');
    expect(codes).toContain('op_no_source_account');
  });

  it('returns empty array for errors without extras', () => {
    expect(stellarTxService.extractResultCodes(new Error('network error'))).toEqual([]);
  });
});

describe('stellarTransactionService — getSequenceNumber', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches sequence from Horizon', async () => {
    const kp = Keypair.random();
    server.loadAccount.mockResolvedValue(mockAccount(kp.publicKey(), '98765'));

    const seq = await stellarTxService.getSequenceNumber(kp.publicKey());
    expect(seq).toBe('98765');
    expect(server.loadAccount).toHaveBeenCalledWith(kp.publicKey());
  });
});

// ---------------------------------------------------------------------------
// Tests: stellarTransactionService.submit()
// ---------------------------------------------------------------------------
describe('stellarTransactionService — submit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds, signs, and submits a transaction with fresh sequence number', async () => {
    const sourceKp = Keypair.random();
    const destKp = Keypair.random();

    server.loadAccount.mockResolvedValue(mockAccount(sourceKp.publicKey()));
    server.submitTransaction.mockResolvedValue({
      hash: 'txhash123',
      ledger: 100,
      result_xdr: 'AAAAAA==',
    });
    recordTransaction.mockResolvedValue({ id: 1 });

    const result = await stellarTxService.submit({
      sourceAddress: sourceKp.publicKey(),
      operations: [
        Operation.payment({
          destination: destKp.publicKey(),
          asset: Asset.native(),
          amount: '10',
        }),
      ],
      signers: [sourceKp],
      options: { txType: 'transfer', amount: '10' },
    });

    expect(result.txHash).toBe('txhash123');
    expect(result.ledger).toBe(100);
    expect(result.status).toBe('submitted');

    // Sequence number fetched fresh
    expect(server.loadAccount).toHaveBeenCalledWith(sourceKp.publicKey());

    // Transaction was submitted
    expect(server.submitTransaction).toHaveBeenCalledTimes(1);

    // Result stored in DB
    expect(recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        txHash: 'txhash123',
        txType: 'transfer',
        amount: '10',
        stellarLedger: 100,
      }),
    );
  });

  it('throws on missing sourceAddress', async () => {
    await expect(
      stellarTxService.submit({
        sourceAddress: '',
        operations: [Operation.payment({ destination: 'G', asset: Asset.native(), amount: '1' })],
        signers: [Keypair.random()],
      }),
    ).rejects.toThrow('sourceAddress is required');
  });

  it('throws on missing operations', async () => {
    await expect(
      stellarTxService.submit({
        sourceAddress: Keypair.random().publicKey(),
        operations: [],
        signers: [Keypair.random()],
      }),
    ).rejects.toThrow('At least one operation is required');
  });

  it('throws on missing signers', async () => {
    await expect(
      stellarTxService.submit({
        sourceAddress: Keypair.random().publicKey(),
        operations: [Operation.payment({ destination: 'G', asset: Asset.native(), amount: '1' })],
        signers: [],
      }),
    ).rejects.toThrow('At least one signer is required');
  });

  it('attempts fee-bump retry when transaction is stuck (tx_bad_seq)', async () => {
    const sourceKp = Keypair.random();
    const feeSourceKp = Keypair.random();
    process.env.FEE_SOURCE_SECRET = feeSourceKp.secret();

    server.loadAccount.mockResolvedValue(mockAccount(sourceKp.publicKey()));

    // First submission fails with tx_bad_seq
    const stuckError = new Error('tx_bad_seq');
    stuckError.response = {
      data: {
        extras: {
          result_codes: { transaction: ['tx_bad_seq'] },
        },
      },
    };
    server.submitTransaction
      .mockRejectedValueOnce(stuckError)
      .mockResolvedValueOnce({
        hash: 'feebumphash',
        ledger: 101,
        result_xdr: 'CCCCCC==',
      });

    recordTransaction.mockResolvedValue({ id: 2 });

    const result = await stellarTxService.submit({
      sourceAddress: sourceKp.publicKey(),
      operations: [
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: '5',
        }),
      ],
      signers: [sourceKp],
      options: { feeSourceSecret: feeSourceKp.secret() },
    });

    expect(result.txHash).toBe('feebumphash');
    expect(server.submitTransaction).toHaveBeenCalledTimes(2);

    delete process.env.FEE_SOURCE_SECRET;
  });

  it('does not retry fee-bump for non-stuck errors', async () => {
    const sourceKp = Keypair.random();
    server.loadAccount.mockResolvedValue(mockAccount(sourceKp.publicKey()));

    const otherError = new Error('op_bad_auth');
    otherError.response = {
      data: {
        extras: {
          result_codes: { transaction: ['op_bad_auth'] },
        },
      },
    };
    server.submitTransaction.mockRejectedValue(otherError);

    await expect(
      stellarTxService.submit({
        sourceAddress: sourceKp.publicKey(),
        operations: [
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '1',
          }),
        ],
        signers: [sourceKp],
      }),
    ).rejects.toThrow('Transaction submission failed');

    // Only one submission attempt (no retry)
    expect(server.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('stores result in DB even with default status mapping', async () => {
    const sourceKp = Keypair.random();
    server.loadAccount.mockResolvedValue(mockAccount(sourceKp.publicKey()));
    server.submitTransaction.mockResolvedValue({
      hash: 'abc',
      ledger: 50,
      result_xdr: null,
    });
    recordTransaction.mockResolvedValue({ id: 3 });

    await stellarTxService.submit({
      sourceAddress: sourceKp.publicKey(),
      operations: [
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: '1',
        }),
      ],
      signers: [sourceKp],
    });

    expect(recordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: stellarTransactionService.submitFeeBump()
// ---------------------------------------------------------------------------
describe('stellarTransactionService — submitFeeBump (explicit)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws on missing innerTxXDR', async () => {
    await expect(
      stellarTxService.submitFeeBump({ innerTxXDR: '', feeSourceSecret: 'S...' }),
    ).rejects.toThrow('innerTxXDR is required');
  });

  it('throws on missing feeSourceSecret', async () => {
    await expect(
      stellarTxService.submitFeeBump({ innerTxXDR: 'abc', feeSourceSecret: '' }),
    ).rejects.toThrow('feeSourceSecret is required');
  });

  it('builds and submits a fee-bump transaction', async () => {
    const sourceKp = Keypair.random();
    const feeSourceKp = Keypair.random();
    const innerTx = buildSignedTx(sourceKp, Keypair.random().publicKey());

    server.submitTransaction.mockResolvedValue({
      hash: 'bump123',
      ledger: 200,
      result_xdr: 'DDDDDD==',
    });

    const result = await stellarTxService.submitFeeBump({
      innerTxXDR: innerTx.toXDR(),
      feeSourceSecret: feeSourceKp.secret(),
    });

    expect(result.txHash).toBe('bump123');
    expect(result.ledger).toBe(200);
    expect(server.submitTransaction).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: Routes
// ---------------------------------------------------------------------------
describe('Route: POST /api/transactions/submit', () => {
  const app = buildApp();

  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when sourceAddress is missing', async () => {
    const res = await request(app)
      .post('/api/transactions/submit')
      .send({ signerSecret: 'S...', operations: [{ type: 'payment' }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns 400 when signerSecret is missing', async () => {
    const kp = Keypair.random();
    const res = await request(app)
      .post('/api/transactions/submit')
      .send({ sourceAddress: kp.publicKey(), operations: [{ type: 'payment' }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns 400 when operations is empty', async () => {
    const kp = Keypair.random();
    const res = await request(app)
      .post('/api/transactions/submit')
      .send({ sourceAddress: kp.publicKey(), signerSecret: kp.secret(), operations: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns 400 for unsupported operation type', async () => {
    const kp = Keypair.random();
    server.loadAccount.mockResolvedValue(mockAccount(kp.publicKey()));

    const res = await request(app)
      .post('/api/transactions/submit')
      .send({
        sourceAddress: kp.publicKey(),
        signerSecret: kp.secret(),
        operations: [{ type: 'bogus_op' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Unsupported operation type');
  });

  it('successfully submits a payment transaction', async () => {
    const sourceKp = Keypair.random();
    const destKp = Keypair.random();

    server.loadAccount.mockResolvedValue(mockAccount(sourceKp.publicKey()));
    server.submitTransaction.mockResolvedValue({
      hash: 'routetx123',
      ledger: 300,
      result_xdr: 'EEEEEE==',
    });
    recordTransaction.mockResolvedValue({ id: 10 });

    const res = await request(app)
      .post('/api/transactions/submit')
      .send({
        sourceAddress: sourceKp.publicKey(),
        signerSecret: sourceKp.secret(),
        operations: [
          {
            type: 'payment',
            destination: destKp.publicKey(),
            assetCode: 'XLM',
            amount: '25',
          },
        ],
        txType: 'distribution',
        amount: '25',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.txHash).toBe('routetx123');
    expect(res.body.data.ledger).toBe(300);
  });
});

describe('Route: POST /api/transactions/fee-bump', () => {
  const app = buildApp();

  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when innerTxXDR is missing', async () => {
    const res = await request(app)
      .post('/api/transactions/fee-bump')
      .send({ feeSourceSecret: 'S...' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns 400 when feeSourceSecret is missing', async () => {
    const res = await request(app)
      .post('/api/transactions/fee-bump')
      .send({ innerTxXDR: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });
});

describe('Route: GET /api/transactions/sequence/:publicKey', () => {
  const app = buildApp();

  beforeEach(() => jest.clearAllMocks());

  it('returns the current sequence number', async () => {
    const kp = Keypair.random();
    server.loadAccount.mockResolvedValue(mockAccount(kp.publicKey(), '55555'));

    const res = await request(app)
      .get(`/api/transactions/sequence/${kp.publicKey()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sequence).toBe('55555');
  });

  it('returns 404 for non-existent account', async () => {
    const kp = Keypair.random();
    const err = new Error('Not found');
    err.response = { status: 404 };
    server.loadAccount.mockRejectedValue(err);

    const res = await request(app)
      .get(`/api/transactions/sequence/${kp.publicKey()}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('account_not_found');
  });
});
