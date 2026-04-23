'use strict';

// ── env vars must be set before any module that calls getRequiredConfig ──────
const ISSUER_KEY  = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
const DIST_SECRET = 'SDCAOELAD27GUNRPWJ2QXINWREZVTMOQF4UXIYVBHJSYLU6V4KKJJTJA';

process.env.HORIZON_URL      = 'https://horizon-testnet.stellar.org';
process.env.ISSUER_PUBLIC    = ISSUER_KEY;
process.env.STELLAR_NETWORK  = 'testnet';
process.env.SOROBAN_RPC_URL  = 'https://soroban-testnet.stellar.org';

// ── Mock stellarService so no real HTTP calls are made ───────────────────────
jest.mock('../../blockchain/stellarService', () => {
  const path = require('path');
  const sdkPath = require.resolve('stellar-sdk', {
    paths: [path.resolve(__dirname, '../../blockchain')],
  });
  const { Asset, Networks } = require(sdkPath);
  return {
    server: {
      loadAccount:       jest.fn(),
      submitTransaction: jest.fn(),
      transactions:      jest.fn(),
    },
    NOVA: new Asset('NOVA', 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K'),
    NETWORK_PASSPHRASE: Networks.TESTNET,
    isValidStellarAddress: jest.fn(() => true),
    getNOVABalance: jest.fn(),
  };
});

// ── Resolve stellar-sdk from the blockchain package ──────────────────────────
const path = require('path');
const blockchainSdkPath = require.resolve('stellar-sdk', {
  paths: [path.resolve(__dirname, '../../blockchain')],
});
const { Keypair, Account, Asset, Transaction, SorobanRpc } = require(blockchainSdkPath);

const { server } = require('../../blockchain/stellarService');
const {
  buildAssetTransfer,
  buildFeeBump,
  buildContractInvocation,
  submitWithPolling,
} = require('../../blockchain/transactionBuilder');

// ── Helpers ──────────────────────────────────────────────────────────────────
const NOVA = new Asset('NOVA', ISSUER_KEY);
const distKeypair = Keypair.fromSecret(DIST_SECRET);
const recipientKey = Keypair.random().publicKey();

function makeAccount(publicKey, sequence = '100') {
  return new Account(publicKey, sequence);
}

// ── buildAssetTransfer ────────────────────────────────────────────────────────
describe('buildAssetTransfer', () => {
  test('returns a signed Transaction', async () => {
    const account = makeAccount(distKeypair.publicKey());
    const tx = await buildAssetTransfer({
      sourceKeypair: distKeypair,
      destination: recipientKey,
      asset: NOVA,
      amount: '10',
      account,
    });
    expect(tx).toBeInstanceOf(Transaction);
    expect(tx.signatures.length).toBeGreaterThan(0);
  });

  test('fetches account from Horizon when account not provided', async () => {
    server.loadAccount.mockResolvedValue(makeAccount(distKeypair.publicKey()));
    await buildAssetTransfer({
      sourceKeypair: distKeypair,
      destination: recipientKey,
      asset: NOVA,
      amount: '5',
    });
    expect(server.loadAccount).toHaveBeenCalledWith(distKeypair.publicKey());
  });

  test('transaction contains a payment operation for the correct destination', async () => {
    const account = makeAccount(distKeypair.publicKey());
    const tx = await buildAssetTransfer({
      sourceKeypair: distKeypair,
      destination: recipientKey,
      asset: NOVA,
      amount: '25',
      account,
    });
    const ops = tx.operations;
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('payment');
    expect(ops[0].destination).toBe(recipientKey);
    // Stellar normalises amounts to 7 decimal places
    expect(ops[0].amount).toBe('25.0000000');
  });
});

// ── buildFeeBump ──────────────────────────────────────────────────────────────
describe('buildFeeBump', () => {
  test('wraps inner transaction and returns a signed fee-bump', async () => {
    const account = makeAccount(distKeypair.publicKey());
    const innerTx = await buildAssetTransfer({
      sourceKeypair: distKeypair,
      destination: recipientKey,
      asset: NOVA,
      amount: '1',
      account,
    });

    const feeSourceKeypair = Keypair.random();
    const feeBump = buildFeeBump({ feeSourceKeypair, innerTx, baseFee: '200' });

    expect(feeBump.signatures.length).toBeGreaterThan(0);
    expect(feeBump.innerTransaction.hash().toString('hex')).toBe(
      innerTx.hash().toString('hex'),
    );
  });
});

// ── buildContractInvocation ───────────────────────────────────────────────────
// Uses the rpcServer injection parameter to avoid cross-package module mocking issues.
describe('buildContractInvocation', () => {
  const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';

  test('throws when Soroban simulation returns an error', async () => {
    const mockRpc = {
      simulateTransaction: jest.fn().mockResolvedValue({ error: 'contract panic', events: [] }),
    };
    jest.spyOn(SorobanRpc.Api, 'isSimulationError').mockReturnValue(true);

    const account = makeAccount(distKeypair.publicKey());
    await expect(
      buildContractInvocation({
        contractId: CONTRACT_ID,
        method: 'register_campaign',
        args: [],
        sourceKeypair: distKeypair,
        account,
        rpcServer: mockRpc,
      }),
    ).rejects.toThrow('Soroban simulation failed');
    expect(mockRpc.simulateTransaction).toHaveBeenCalledTimes(1);
  });

  test('calls simulateTransaction and assembleTransaction on success', async () => {
    jest.spyOn(SorobanRpc.Api, 'isSimulationError').mockReturnValue(false);

    // Build a real inner tx to return from assembleTransaction mock
    const dummyTx = await buildAssetTransfer({
      sourceKeypair: distKeypair,
      destination: recipientKey,
      asset: NOVA,
      amount: '1',
      account: makeAccount(distKeypair.publicKey()),
    });

    const mockRpc = {
      simulateTransaction: jest.fn().mockResolvedValue({ results: [{ xdr: 'AAAA' }] }),
    };
    const mockAssemble = jest.fn().mockReturnValue({ build: () => dummyTx });

    const account = makeAccount(distKeypair.publicKey());
    const result = await buildContractInvocation({
      contractId: CONTRACT_ID,
      method: 'register_campaign',
      args: [],
      sourceKeypair: distKeypair,
      account,
      rpcServer: mockRpc,
      assembleFn: mockAssemble,
    });

    expect(mockRpc.simulateTransaction).toHaveBeenCalledTimes(1);
    expect(mockAssemble).toHaveBeenCalledTimes(1);
    expect(result).toBeTruthy();
  });
});

// ── submitWithPolling ─────────────────────────────────────────────────────────
describe('submitWithPolling', () => {
  const TX_HASH = 'deadbeefdeadbeef';

  async function makeTx() {
    return buildAssetTransfer({
      sourceKeypair: distKeypair,
      destination: recipientKey,
      asset: NOVA,
      amount: '1',
      account: makeAccount(distKeypair.publicKey()),
    });
  }

  test('resolves with txHash and ledger when transaction confirms on first poll', async () => {
    server.submitTransaction.mockResolvedValue({ hash: TX_HASH });
    server.transactions.mockReturnValue({
      transaction: () => ({ call: jest.fn().mockResolvedValue({ successful: true, ledger: 42 }) }),
    });

    const tx = await makeTx();
    const result = await submitWithPolling(tx, { pollIntervalMs: 1, maxAttempts: 5 });
    expect(result).toEqual({ txHash: TX_HASH, ledger: 42 });
  });

  test('retries on 404 and eventually confirms', async () => {
    server.submitTransaction.mockResolvedValue({ hash: TX_HASH });

    const notFound = new Error('Not Found');
    notFound.response = { status: 404 };

    const txCallMock = jest.fn()
      .mockRejectedValueOnce(notFound)
      .mockRejectedValueOnce(notFound)
      .mockResolvedValue({ successful: true, ledger: 55 });

    server.transactions.mockReturnValue({ transaction: () => ({ call: txCallMock }) });

    const tx = await makeTx();
    const result = await submitWithPolling(tx, { pollIntervalMs: 1, maxAttempts: 5 });

    expect(result.txHash).toBe(TX_HASH);
    expect(result.ledger).toBe(55);
    expect(txCallMock).toHaveBeenCalledTimes(3);
  });

  test('throws tx_timeout when max attempts exceeded', async () => {
    server.submitTransaction.mockResolvedValue({ hash: TX_HASH });

    const notFound = new Error('Not Found');
    notFound.response = { status: 404 };
    server.transactions.mockReturnValue({
      transaction: () => ({ call: jest.fn().mockRejectedValue(notFound) }),
    });

    const tx = await makeTx();
    await expect(
      submitWithPolling(tx, { pollIntervalMs: 1, maxAttempts: 3 }),
    ).rejects.toMatchObject({ code: 'tx_timeout', txHash: TX_HASH });
  });

  test('throws tx_failed when transaction is found but unsuccessful', async () => {
    server.submitTransaction.mockResolvedValue({ hash: TX_HASH });
    server.transactions.mockReturnValue({
      transaction: () => ({
        call: jest.fn().mockResolvedValue({ successful: false, ledger: 10, result_xdr: 'AAAA' }),
      }),
    });

    const tx = await makeTx();
    await expect(
      submitWithPolling(tx, { pollIntervalMs: 1, maxAttempts: 3 }),
    ).rejects.toMatchObject({ code: 'tx_failed' });
  });

  test('propagates unexpected Horizon errors immediately', async () => {
    server.submitTransaction.mockResolvedValue({ hash: TX_HASH });

    const horizonErr = new Error('Horizon 500');
    horizonErr.response = { status: 500 };
    server.transactions.mockReturnValue({
      transaction: () => ({ call: jest.fn().mockRejectedValue(horizonErr) }),
    });

    const tx = await makeTx();
    await expect(
      submitWithPolling(tx, { pollIntervalMs: 1, maxAttempts: 3 }),
    ).rejects.toThrow('Horizon 500');
  });
});
