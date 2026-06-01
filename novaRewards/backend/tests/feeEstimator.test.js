'use strict';

/**
 * Unit tests for lib/feeEstimator.js
 *
 * All Stellar RPC calls are mocked via the _rpcOverride injection parameter.
 * No real network calls are made.
 *
 * Covers:
 *  - estimate_fee() happy path: correct fee breakdown returned
 *  - estimate_fee() with custom inclusionFee
 *  - estimate_fee() when minResourceFee is missing (defaults to '0')
 *  - estimate_fee() when simulation returns an error response
 *  - estimate_fee() when the RPC call itself throws
 *  - estimate_fee() input validation (missing contractId, functionName, bad args)
 *  - totalFee = resourceFee + inclusionFee arithmetic
 */

// ---------------------------------------------------------------------------
// Env — must be set before any module that calls getRequiredConfig
// ---------------------------------------------------------------------------
process.env.STELLAR_NETWORK = 'testnet';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// sorobanRpcService is the real dependency; we override it per-test via
// _rpcOverride so we don't need to mock the module globally.
jest.mock('../services/sorobanRpcService', () => ({
  simulateTransaction: jest.fn(),
}));

jest.mock('../cache/redisClient', () => ({
  getRedisClient: jest.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------
const { estimate_fee } = require('../lib/feeEstimator');
const { SorobanRpc } = require('stellar-sdk');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
const VALID_FUNCTION = 'issue_reward';

/**
 * Builds a mock successful simulation response.
 * minResourceFee is a string in stroops, matching the real RPC shape.
 */
function makeSimSuccess(minResourceFee = '5000') {
  return {
    minResourceFee,
    results: [{ xdr: 'AAAA' }],
    cost: { cpuInsns: '1000', memBytes: '512' },
    latestLedger: 100,
  };
}

/**
 * Builds a mock simulation error response.
 */
function makeSimError(message = 'contract panic: out of gas') {
  return { error: message, events: [] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('estimate_fee — happy path', () => {
  beforeEach(() => {
    jest.spyOn(SorobanRpc.Api, 'isSimulationError').mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns correct fee breakdown with default inclusionFee (100 stroops)', async () => {
    const mockRpc = jest.fn().mockResolvedValue(makeSimSuccess('5000'));

    const result = await estimate_fee({
      contractId: VALID_CONTRACT_ID,
      functionName: VALID_FUNCTION,
      args: [],
      _rpcOverride: mockRpc,
    });

    expect(result).toEqual({
      resourceFee: '5000',
      inclusionFee: '100',
      totalFee: '5100',
      contractId: VALID_CONTRACT_ID,
      functionName: VALID_FUNCTION,
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  test('returns correct fee breakdown with custom inclusionFee', async () => {
    const mockRpc = jest.fn().mockResolvedValue(makeSimSuccess('12345'));

    const result = await estimate_fee({
      contractId: VALID_CONTRACT_ID,
      functionName: VALID_FUNCTION,
      args: [],
      inclusionFee: '500',
      _rpcOverride: mockRpc,
    });

    expect(result.resourceFee).toBe('12345');
    expect(result.inclusionFee).toBe('500');
    expect(result.totalFee).toBe('12845');
  });

  test('handles zero resourceFee gracefully', async () => {
    const mockRpc = jest.fn().mockResolvedValue(makeSimSuccess('0'));

    const result = await estimate_fee({
      contractId: VALID_CONTRACT_ID,
      functionName: VALID_FUNCTION,
      _rpcOverride: mockRpc,
    });

    expect(result.resourceFee).toBe('0');
    expect(result.totalFee).toBe('100'); // 0 + 100 default inclusion
  });

  test('defaults resourceFee to 0 when minResourceFee is absent', async () => {
    // Some RPC implementations may omit minResourceFee
    const simResult = { results: [{ xdr: 'AAAA' }], latestLedger: 100 };
    const mockRpc = jest.fn().mockResolvedValue(simResult);

    const result = await estimate_fee({
      contractId: VALID_CONTRACT_ID,
      functionName: VALID_FUNCTION,
      _rpcOverride: mockRpc,
    });

    expect(result.resourceFee).toBe('0');
    expect(result.totalFee).toBe('100');
  });

  test('passes args to the transaction builder (smoke test)', async () => {
    const mockRpc = jest.fn().mockResolvedValue(makeSimSuccess('999'));

    // Passing native JS values — encodeArg should handle them
    const result = await estimate_fee({
      contractId: VALID_CONTRACT_ID,
      functionName: 'redeem',
      args: ['GABC123', BigInt(1000)],
      _rpcOverride: mockRpc,
    });

    expect(result.functionName).toBe('redeem');
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  test('totalFee is always resourceFee + inclusionFee', async () => {
    const cases = [
      { resource: '0', inclusion: '100' },
      { resource: '99999', inclusion: '200' },
      { resource: '1', inclusion: '1' },
    ];

    for (const { resource, inclusion } of cases) {
      jest.spyOn(SorobanRpc.Api, 'isSimulationError').mockReturnValue(false);
      const mockRpc = jest.fn().mockResolvedValue(makeSimSuccess(resource));

      const result = await estimate_fee({
        contractId: VALID_CONTRACT_ID,
        functionName: VALID_FUNCTION,
        inclusionFee: inclusion,
        _rpcOverride: mockRpc,
      });

      const expected = (BigInt(resource) + BigInt(inclusion)).toString();
      expect(result.totalFee).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------

describe('estimate_fee — simulation errors', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('throws simulation_error when RPC returns an error response', async () => {
    jest.spyOn(SorobanRpc.Api, 'isSimulationError').mockReturnValue(true);
    const mockRpc = jest.fn().mockResolvedValue(makeSimError('contract panic'));

    await expect(
      estimate_fee({
        contractId: VALID_CONTRACT_ID,
        functionName: VALID_FUNCTION,
        _rpcOverride: mockRpc,
      }),
    ).rejects.toMatchObject({
      code: 'simulation_error',
      status: 502,
      message: expect.stringContaining('contract panic'),
    });
  });

  test('propagates network errors from the RPC call', async () => {
    jest.spyOn(SorobanRpc.Api, 'isSimulationError').mockReturnValue(false);
    const networkErr = new Error('ECONNREFUSED');
    const mockRpc = jest.fn().mockRejectedValue(networkErr);

    await expect(
      estimate_fee({
        contractId: VALID_CONTRACT_ID,
        functionName: VALID_FUNCTION,
        _rpcOverride: mockRpc,
      }),
    ).rejects.toThrow('ECONNREFUSED');
  });
});

// ---------------------------------------------------------------------------

describe('estimate_fee — input validation', () => {
  test('throws validation_error when contractId is missing', async () => {
    await expect(
      estimate_fee({ contractId: '', functionName: VALID_FUNCTION }),
    ).rejects.toMatchObject({ code: 'validation_error', status: 400 });
  });

  test('throws validation_error when contractId is not a string', async () => {
    await expect(
      estimate_fee({ contractId: 123, functionName: VALID_FUNCTION }),
    ).rejects.toMatchObject({ code: 'validation_error', status: 400 });
  });

  test('throws validation_error when functionName is missing', async () => {
    await expect(
      estimate_fee({ contractId: VALID_CONTRACT_ID, functionName: '' }),
    ).rejects.toMatchObject({ code: 'validation_error', status: 400 });
  });

  test('throws validation_error when args is not an array', async () => {
    await expect(
      estimate_fee({
        contractId: VALID_CONTRACT_ID,
        functionName: VALID_FUNCTION,
        args: 'not-an-array',
      }),
    ).rejects.toMatchObject({ code: 'validation_error', status: 400 });
  });
});
