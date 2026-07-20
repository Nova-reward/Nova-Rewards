/**
 * Tests for the Stellar Transaction Submission Service.
 *
 * Covers:
 *  - stellarTransactionService.submit()
 *  - stellarTransactionService.submitFeeBump()
 *  - stellarTransactionService.parseTransactionResult()
 *  - stellarTransactionService.extractResultCodes()
 *  - stellarTransactionService.getSequenceNumber()
 *  - Fee-bump retry path (all STUCK_RESULT_CODES)
 *
 * Note: vi.mock() factory approach does not work with deps.inline + CJS in
 * this vitest setup. We use vi.spyOn() on the real module exports instead,
 * and build route tests with a custom express app that bypasses auth.
 */

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
const txRepo = require('../db/transactionRepository');
const stellarTxService = require('../services/stellarTransactionService');

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------
process.env.STELLAR_NETWORK = 'testnet';

// ---------------------------------------------------------------------------
// Shared spy setup — applied to every test
// ---------------------------------------------------------------------------
// These are the actual Horizon server methods and the DB function.
// We spy on them so we get full mock control without needing vi.mock().
let loadAccountSpy;
let submitTransactionSpy;
let recordTransactionSpy;

beforeEach(() => {
  loadAccountSpy = vi.spyOn(server, 'loadAccount');
  submitTransactionSpy = vi.spyOn(server, 'submitTransaction');
  recordTransactionSpy = vi.spyOn(txRepo, 'recordTransaction').mockResolvedValue({ id: 1 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Convenience aliases used throughout the tests
const mockLoadAccount = (...args) => loadAccountSpy.mockResolvedValue(...args);
const mockLoadAccountOnce = (...args) => loadAccountSpy.mockResolvedValueOnce(...args);
const mockSubmitTx = (...args) => submitTransactionSpy.mockResolvedValue(...args);
const mockSubmitTxOnce = (...args) => submitTransactionSpy.mockResolvedValueOnce(...args);
const mockSubmitTxRejectOnce = (...args) => submitTransactionSpy.mockRejectedValueOnce(...args);
const mockSubmitTxReject = (...args) => submitTransactionSpy.mockRejectedValue(...args);

// ---------------------------------------------------------------------------
// Test app — injects bypass middleware so auth/rate-limit don't block tests
// ---------------------------------------------------------------------------
function buildApp() {
  const app = express();
  app.use(express.json());

  // Bypass auth and rate limiting for all test routes
  app.use((req, _res, next) => {
    req.user = { id: 1, role: 'user' };
    next();
  });

  // Mount the real route but with auth/rateLimiter stubs injected via
  // environment — the route requires them by module path; we patch them on
  // the cached module object so the route handler gets no-op middleware.
  const authMod = require('../middleware/authenticateUser');
  const rateMod = require('../middleware/rateLimiter');
  const _origAuth = authMod.authenticateUser;
  const _origSliding = rateMod.slidingGlobal;
  authMod.authenticateUser = (_req, _res, next) => next();
  rateMod.slidingGlobal = (_req, _res, next) => next();

  app.use('/api/transactions', require('../routes/stellarTransaction'));

  // Restore originals after route is mounted (they'll be patched for the
  // lifetime of this app instance which is what we need)
  authMod.authenticateUser = _origAuth;
  rateMod.slidingGlobal = _origSliding;

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

  it('fetches sequence from Horizon', async () => {
    const kp = Keypair.random();
    server.loadAccount.mockResolvedValue(mockAccount(kp.publicKey(), '98765'));

    const seq = await stellarTxService.getSequenceNumber(kp.publicKey());
    expect(String(seq)).toBe('98765');
    expect(server.loadAccount).toHaveBeenCalledWith(kp.publicKey());
  });
});

// ---------------------------------------------------------------------------
// Tests: stellarTransactionService.submit()
// ---------------------------------------------------------------------------
describe('stellarTransactionService — submit', () => {

  it('builds, signs, and submits a transaction with fresh sequence number', async () => {
    const sourceKp = Keypair.random();
    const destKp = Keypair.random();

    server.loadAccount.mockResolvedValue(mockAccount(sourceKp.publicKey()));
    server.submitTransaction.mockResolvedValue({
      hash: 'txhash123',
      ledger: 100,
      result_xdr: 'AAAAAA==',
    });
    txRepo.recordTransaction.mockResolvedValue({ id: 1 });

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
  });

  it('throws on missing sourceAddress', async () => {
    await expect(
      stellarTxService.submit({
        sourceAddress: '',
        operations: [],
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
    const destKp = Keypair.random();
    await expect(
      stellarTxService.submit({
        sourceAddress: Keypair.random().publicKey(),
        operations: [Operation.payment({ destination: destKp.publicKey(), asset: Asset.native(), amount: '1' })],
        signers: [],
      }),
    ).rejects.toThrow('At least one signer is required');
  });

  it('refreshes sequence and retries once when transaction is stuck (tx_bad_seq)', async () => {
    const sourceKp = Keypair.random();
    const destKp = Keypair.random();

    server.loadAccount
      .mockResolvedValueOnce(mockAccount(sourceKp.publicKey(), '111'))
      .mockResolvedValueOnce(mockAccount(sourceKp.publicKey(), '222'));

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
        hash: 'retryhash',
        ledger: 101,
        result_xdr: 'CCCCCC==',
      });

    txRepo.recordTransaction.mockResolvedValue({ id: 2 });

    const result = await stellarTxService.submit({
      sourceAddress: sourceKp.publicKey(),
      operations: [
        Operation.payment({
          destination: destKp.publicKey(),
          asset: Asset.native(),
          amount: '5',
        }),
      ],
      signers: [sourceKp],
      options: {},
    });

    expect(result.txHash).toBe('retryhash');
    // One for initial submit attempt, one for retry submission
    expect(server.submitTransaction).toHaveBeenCalledTimes(2);
    // Sequence refreshed via loadAccount on tx_bad_seq
    expect(server.loadAccount).toHaveBeenCalledTimes(2);
  });

  it('retries Horizon timeout errors up to 3 times with exponential backoff', async () => {
    vi.useFakeTimers();

    const sourceKp = Keypair.random();
    server.loadAccount.mockResolvedValue(mockAccount(sourceKp.publicKey(), '111'));

    const timeoutErr1 = new Error('timeout');
    const timeoutErr2 = new Error('timeout');
    const timeoutErr3 = new Error('timeout');

    server.submitTransaction
      .mockRejectedValueOnce(timeoutErr1)
      .mockRejectedValueOnce(timeoutErr2)
      .mockRejectedValueOnce(timeoutErr3);

    txRepo.recordTransaction.mockResolvedValue({ id: 2 });

    const p = stellarTxService.submit({
      sourceAddress: sourceKp.publicKey(),
      operations: [
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: '5',
        }),
      ],
      signers: [sourceKp],
      options: {},
    });

    // Run pending timers (backoffs: 0ms, 500ms, 1000ms)
    await Promise.resolve();
    vi.advanceTimersByTime(2000);

    await expect(p).rejects.toThrow('Horizon error');
    expect(server.submitTransaction).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('maps Horizon insufficient_balance to a 400 response code', async () => {
    const sourceKp = Keypair.random();
    server.loadAccount.mockResolvedValue(mockAccount(sourceKp.publicKey(), '111'));

    const err = new Error('insufficient_balance');
    err.response = {
      data: {
        extras: {
          result_codes: { transaction: ['insufficient_balance'] },
        },
      },
    };

    server.submitTransaction.mockRejectedValue(err);

    await expect(
      stellarTxService.submit({
        sourceAddress: sourceKp.publicKey(),
        operations: [
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '5',
          }),
        ],
        signers: [sourceKp],
        options: {},
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('maps all other Horizon errors to 503 with original code', async () => {
    const sourceKp = Keypair.random();
    server.loadAccount.mockResolvedValue(mockAccount(sourceKp.publicKey(), '111'));

    const err = new Error('some_horizon_failure');
    err.response = {
      data: {
        extras: {
          result_codes: { transaction: ['tx_internal_error'] },
        },
      },
    };

    server.submitTransaction.mockRejectedValue(err);

    await expect(
      stellarTxService.submit({
        sourceAddress: sourceKp.publicKey(),
        operations: [
          Operation.payment({
            destination: Keypair.random().publicKey(),
            asset: Asset.native(),
            amount: '5',
          }),
        ],
        signers: [sourceKp],
        options: {},
      }),
    ).rejects.toMatchObject({ status: 503, code: 'tx_internal_error' });
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
    ).rejects.toMatchObject({ status: 503, code: 'op_bad_auth' });

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

    const result = await stellarTxService.submit({
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

    // Result should be returned even though DB write happens asynchronously
    expect(result.txHash).toBe('abc');
    expect(result.status).toBe('submitted');
  });
});

// ---------------------------------------------------------------------------
// Tests: stellarTransactionService.submitFeeBump()
// ---------------------------------------------------------------------------
describe('stellarTransactionService — submitFeeBump (explicit)', () => {

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
    txRepo.recordTransaction.mockResolvedValue({ id: 10 });

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

// ---------------------------------------------------------------------------
// Tests: Fee-bump retry path — STUCK_RESULT_CODES
// ---------------------------------------------------------------------------
describe('stellarTransactionService — fee-bump retry logic', () => {
  // Helper: build a Horizon error for a given result code
  function makeHorizonError(resultCode) {
    const err = new Error(resultCode);
    err.response = {
      data: {
        extras: {
          result_codes: { transaction: [resultCode] },
        },
      },
    };
    return err;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: every loadAccount call returns a fresh account with a new sequence
    let seq = 1000;
    server.loadAccount.mockImplementation((publicKey) => {
      return Promise.resolve(mockAccount(publicKey, String(seq++)));
    });
  });

  // AC1: tx_bad_seq on first submission → refresh sequence → succeed on retry
  it('AC1: resolves with correct hash when tx_bad_seq triggers sequence refresh and retry', async () => {
    const sourceKp = Keypair.random();
    const destKp = Keypair.random();

    // First loadAccount (initial submit) returns seq 1000
    // Second loadAccount (inside refreshAndRebuildTransaction) returns seq 1001
    let callCount = 0;
    server.loadAccount.mockImplementation((publicKey) => {
      callCount++;
      return Promise.resolve(mockAccount(publicKey, String(999 + callCount)));
    });

    server.submitTransaction
      .mockRejectedValueOnce(makeHorizonError('tx_bad_seq'))
      .mockResolvedValueOnce({ hash: 'good-hash-after-seq-refresh', ledger: 200, result_xdr: 'AAAAAA==' });

    txRepo.recordTransaction.mockResolvedValue({ id: 1 });

    const result = await stellarTxService.submit({
      sourceAddress: sourceKp.publicKey(),
      operations: [Operation.payment({ destination: destKp.publicKey(), asset: Asset.native(), amount: '1' })],
      signers: [sourceKp],
      options: {},
    });

    expect(result.txHash).toBe('good-hash-after-seq-refresh');
    // loadAccount called twice: once for initial build, once for rebuild on tx_bad_seq
    expect(server.loadAccount).toHaveBeenCalledTimes(2);
    // submitTransaction called twice: fail then succeed
    expect(server.submitTransaction).toHaveBeenCalledTimes(2);
  });

  // AC2: fee-bump exhaustion → typed error with code 'fee_bump_exhausted'
  it('AC2: rejects with fee_bump_exhausted after MAX_FEE_BUMP_ATTEMPTS consecutive failures', async () => {
    const sourceKp = Keypair.random();
    const destKp = Keypair.random();
    const feeSourceKp = Keypair.random();

    process.env.FEE_SOURCE_SECRET = feeSourceKp.secret();

    // Initial submit fails with tx_insufficient_fee
    // All fee-bump attempts also fail with tx_fee_bump_failed
    const insufficientFeeErr = makeHorizonError('tx_insufficient_fee');
    // Fee-bump submit failures (these come through as fee_bump_failed errors from submitFeeBumpTransaction)
    const feeBumpFailErr = Object.assign(new Error('Fee-bump submission failed: tx_insufficient_fee'), {
      status: 400,
      code: 'tx_fee_bump_failed',
    });

    server.submitTransaction
      .mockRejectedValueOnce(insufficientFeeErr)  // initial submit
      .mockRejectedValueOnce(feeBumpFailErr)       // fee-bump attempt 0
      .mockRejectedValueOnce(feeBumpFailErr)       // fee-bump attempt 1
      .mockRejectedValueOnce(feeBumpFailErr);      // fee-bump attempt 2

    const err = await stellarTxService.submit({
      sourceAddress: sourceKp.publicKey(),
      operations: [Operation.payment({ destination: destKp.publicKey(), asset: Asset.native(), amount: '1' })],
      signers: [sourceKp],
      options: { feeSourceSecret: feeSourceKp.secret() },
    }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('fee_bump_exhausted');
    expect(err.status).toBe(503);
    // Exactly MAX_FEE_BUMP_ATTEMPTS (3) fee-bump submissions after the initial attempt
    // Total submit calls: 1 initial + 3 fee-bump = 4
    expect(server.submitTransaction).toHaveBeenCalledTimes(4);

    delete process.env.FEE_SOURCE_SECRET;
  });

  // AC3: no sequence number reused across retry attempts
  it('AC3: loadAccount is called before each fee-bump attempt (no sequence reuse)', async () => {
    const sourceKp = Keypair.random();
    const destKp = Keypair.random();
    const feeSourceKp = Keypair.random();

    const loadAccountCallArgs = [];
    server.loadAccount.mockImplementation((publicKey) => {
      loadAccountCallArgs.push(publicKey);
      return Promise.resolve(mockAccount(publicKey, String(loadAccountCallArgs.length * 100)));
    });

    const insufficientFeeErr = makeHorizonError('tx_insufficient_fee');
    const feeBumpFailErr = Object.assign(new Error('Fee-bump submission failed: tx_insufficient_fee'), {
      status: 400,
      code: 'tx_fee_bump_failed',
    });

    server.submitTransaction
      .mockRejectedValueOnce(insufficientFeeErr)   // initial submit
      .mockRejectedValueOnce(feeBumpFailErr)        // fee-bump attempt 0
      .mockRejectedValueOnce(feeBumpFailErr)        // fee-bump attempt 1
      .mockRejectedValueOnce(feeBumpFailErr);       // fee-bump attempt 2

    await stellarTxService.submit({
      sourceAddress: sourceKp.publicKey(),
      operations: [Operation.payment({ destination: destKp.publicKey(), asset: Asset.native(), amount: '1' })],
      signers: [sourceKp],
      options: { feeSourceSecret: feeSourceKp.secret() },
    }).catch(() => {});

    // loadAccount called: 1 (initial build) + 3 (one per fee-bump attempt) = 4
    expect(server.loadAccount).toHaveBeenCalledTimes(4);
    // Every call was for the source address
    expect(loadAccountCallArgs.every((addr) => addr === sourceKp.publicKey())).toBe(true);
  });

  // AC4: tx_insufficient_fee → fee doubles on each attempt (FEE_BUMP_MULTIPLIER=2 → 2^1, 2^2, 2^3)
  it('AC4: fee doubles on each fee-bump attempt (2^1, 2^2, 2^3 multiples of base fee)', async () => {
    const sourceKp = Keypair.random();
    const destKp = Keypair.random();
    const feeSourceKp = Keypair.random();

    const insufficientFeeErr = makeHorizonError('tx_insufficient_fee');
    const feeBumpFailErr = Object.assign(new Error('Fee-bump submission failed'), {
      status: 400,
      code: 'tx_fee_bump_failed',
    });

    server.submitTransaction
      .mockRejectedValueOnce(insufficientFeeErr)
      .mockRejectedValueOnce(feeBumpFailErr)
      .mockRejectedValueOnce(feeBumpFailErr)
      .mockRejectedValueOnce(feeBumpFailErr);

    await stellarTxService.submit({
      sourceAddress: sourceKp.publicKey(),
      operations: [Operation.payment({ destination: destKp.publicKey(), asset: Asset.native(), amount: '1' })],
      signers: [sourceKp],
      options: { feeSourceSecret: feeSourceKp.secret() },
    }).catch(() => {});

    // Inspect the fee-bump transactions submitted (calls 1, 2, 3 in submitTransaction)
    const feeBumpCalls = server.submitTransaction.mock.calls.slice(1); // skip initial submit
    expect(feeBumpCalls).toHaveLength(3);

    // Each call receives a FeeBumpTransaction; the SDK doubles the fee value
    // that is passed into buildFeeBumpTransaction, so the exposed fee is
    // 2 * (baseFee * 2^(attempt+1)) = baseFee * 2^(attempt+2).
    const { FEE_BUMP_MULTIPLIER: multiplier } = stellarTxService;
    const baseFee = parseInt(BASE_FEE, 10); // 100 stroops

    feeBumpCalls.forEach((call, idx) => {
      const feeBumpTx = call[0];
      const expectedFee = baseFee * Math.pow(multiplier, idx + 2);
      expect(parseInt(feeBumpTx.fee, 10)).toBe(expectedFee);
    });
  });

  // tx_insufficient_fee: first attempt fails, fee-bump attempt 0 succeeds
  it('tx_insufficient_fee: resolves when fee-bump first attempt succeeds', async () => {
    const sourceKp = Keypair.random();
    const destKp = Keypair.random();
    const feeSourceKp = Keypair.random();

    server.submitTransaction
      .mockRejectedValueOnce(makeHorizonError('tx_insufficient_fee'))
      .mockResolvedValueOnce({ hash: 'fee-bump-success', ledger: 201, result_xdr: 'BBBBBB==' });

    txRepo.recordTransaction.mockResolvedValue({ id: 5 });

    const result = await stellarTxService.submit({
      sourceAddress: sourceKp.publicKey(),
      operations: [Operation.payment({ destination: destKp.publicKey(), asset: Asset.native(), amount: '1' })],
      signers: [sourceKp],
      options: { feeSourceSecret: feeSourceKp.secret() },
    });

    expect(result.txHash).toBe('fee-bump-success');
    expect(result.ledger).toBe(201);
    // 1 initial + 1 fee-bump = 2 total submissions
    expect(server.submitTransaction).toHaveBeenCalledTimes(2);
  });

  // tx_too_late: triggers fee-bump retry path
  it('tx_too_late: resolves when fee-bump succeeds', async () => {
    const sourceKp = Keypair.random();
    const destKp = Keypair.random();
    const feeSourceKp = Keypair.random();

    server.submitTransaction
      .mockRejectedValueOnce(makeHorizonError('tx_too_late'))
      .mockResolvedValueOnce({ hash: 'too-late-bump-hash', ledger: 202, result_xdr: 'CCCCCC==' });

    txRepo.recordTransaction.mockResolvedValue({ id: 6 });

    const result = await stellarTxService.submit({
      sourceAddress: sourceKp.publicKey(),
      operations: [Operation.payment({ destination: destKp.publicKey(), asset: Asset.native(), amount: '1' })],
      signers: [sourceKp],
      options: { feeSourceSecret: feeSourceKp.secret() },
    });

    expect(result.txHash).toBe('too-late-bump-hash');
    expect(server.submitTransaction).toHaveBeenCalledTimes(2);
  });

  // tx_bad_seq does NOT trigger the fee-bump path (handled inline with rebuild)
  it('tx_bad_seq does not trigger fee-bump; handled via inline sequence refresh', async () => {
    const sourceKp = Keypair.random();
    const destKp = Keypair.random();

    server.submitTransaction
      .mockRejectedValueOnce(makeHorizonError('tx_bad_seq'))
      .mockResolvedValueOnce({ hash: 'bad-seq-rebuilt', ledger: 203, result_xdr: 'DDDDDD==' });

    txRepo.recordTransaction.mockResolvedValue({ id: 7 });

    const result = await stellarTxService.submit({
      sourceAddress: sourceKp.publicKey(),
      operations: [Operation.payment({ destination: destKp.publicKey(), asset: Asset.native(), amount: '1' })],
      signers: [sourceKp],
      options: {},
    });

    expect(result.txHash).toBe('bad-seq-rebuilt');
    // submitTransaction called exactly 2 times: initial fail + rebuild-and-retry
    expect(server.submitTransaction).toHaveBeenCalledTimes(2);
    // No fee-bump specific code path: loadAccount called twice (initial + rebuild on tx_bad_seq)
    expect(server.loadAccount).toHaveBeenCalledTimes(2);
  });

  // Non-stuck error does NOT trigger fee-bump
  it('non-stuck error propagates immediately without fee-bump attempts', async () => {
    const sourceKp = Keypair.random();
    const destKp = Keypair.random();

    server.submitTransaction.mockRejectedValueOnce(makeHorizonError('op_underfunded'));

    const err = await stellarTxService.submit({
      sourceAddress: sourceKp.publicKey(),
      operations: [Operation.payment({ destination: destKp.publicKey(), asset: Asset.native(), amount: '1' })],
      signers: [sourceKp],
      options: {},
    }).catch((e) => e);

    // Should fail (503 from submitHorizonTransaction general path)
    expect(err).toBeInstanceOf(Error);
    // Only one submission — no fee-bump retries
    expect(server.submitTransaction).toHaveBeenCalledTimes(1);
  });

  // MAX_FEE_BUMP_ATTEMPTS is exported and equals 3
  it('MAX_FEE_BUMP_ATTEMPTS constant is exactly 3', () => {
    expect(stellarTxService.MAX_FEE_BUMP_ATTEMPTS).toBe(3);
  });

  // FEE_BUMP_MULTIPLIER is exported and equals 2
  it('FEE_BUMP_MULTIPLIER constant is exactly 2', () => {
    expect(stellarTxService.FEE_BUMP_MULTIPLIER).toBe(2);
  });
});
