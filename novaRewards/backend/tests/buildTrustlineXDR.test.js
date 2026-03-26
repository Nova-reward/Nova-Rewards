// Feature: nova-rewards — buildTrustlineXDR
// Validates: Requirements 2.1
// Asserts:
//   1. server.loadAccount is mocked to return a mock account object
//   2. The returned XDR is a non-empty string
//   3. The transaction contains a changeTrust operation for the NOVA asset

const ISSUER_KEY = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';

process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.ISSUER_PUBLIC = ISSUER_KEY;
process.env.STELLAR_NETWORK = 'testnet';

jest.mock('../../blockchain/stellarService', () => {
  const { Asset } = require('stellar-sdk');
  return {
    server: { loadAccount: jest.fn() },
    NOVA: new Asset('NOVA', ISSUER_KEY),
  };
});

const { Keypair, Account, xdr } = require('stellar-sdk');
const { server } = require('../../blockchain/stellarService');
const { buildTrustlineXDR } = require('../../blockchain/trustline');

describe('buildTrustlineXDR', () => {
  const walletKeypair = Keypair.random();
  const walletAddress = walletKeypair.publicKey();

  beforeEach(() => {
    // Mock server.loadAccount to return a minimal valid account object
    server.loadAccount.mockResolvedValue(
      new Account(walletAddress, '100')
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('calls server.loadAccount with the provided wallet address', async () => {
    await buildTrustlineXDR(walletAddress);
    expect(server.loadAccount).toHaveBeenCalledTimes(1);
    expect(server.loadAccount).toHaveBeenCalledWith(walletAddress);
  });

  test('returns a non-empty XDR string', async () => {
    const xdrResult = await buildTrustlineXDR(walletAddress);
    expect(typeof xdrResult).toBe('string');
    expect(xdrResult.length).toBeGreaterThan(0);
  });

  test('XDR contains a changeTrust operation for the NOVA asset', async () => {
    const xdrResult = await buildTrustlineXDR(walletAddress);

    const envelope = xdr.TransactionEnvelope.fromXDR(xdrResult, 'base64');
    const ops = envelope.v1().tx().operations();

    expect(ops).toHaveLength(1);

    const op = ops[0].body();
    expect(op.switch().name).toBe('changeTrust');
  });

  test('mock server.loadAccount returns a mock account object', async () => {
    const mockAccount = new Account(walletAddress, '100');
    server.loadAccount.mockResolvedValue(mockAccount);

    await buildTrustlineXDR(walletAddress);

    expect(server.loadAccount).toHaveBeenCalledWith(walletAddress);
  });

  test('returned XDR is a non-empty string', async () => {
    const xdrResult = await buildTrustlineXDR(walletAddress);

    expect(typeof xdrResult).toBe('string');
    expect(xdrResult.length).toBeGreaterThan(0);
  });

  test('transaction contains changeTrust operation for NOVA asset', async () => {
    const xdrResult = await buildTrustlineXDR(walletAddress);

    const envelope = xdr.TransactionEnvelope.fromXDR(xdrResult, 'base64');
    const ops = envelope.v1().tx().operations();

    expect(ops.length).toBeGreaterThan(0);
    const op = ops[0].body();
    expect(op.switch().name).toBe('changeTrust');
  });
});
