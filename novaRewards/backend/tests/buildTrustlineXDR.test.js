// Feature: nova-rewards — buildTrustlineXDR
// Validates: Requirements 2.1
// Asserts:
//   1. server.loadAccount is mocked to return a mock account object
//   2. The returned XDR is a non-empty string
//   3. The transaction contains a changeTrust operation for the NOVA asset

process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.ISSUER_PUBLIC = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
process.env.STELLAR_NETWORK = 'testnet';

jest.mock('../../blockchain/stellarService', () => {
  const { Asset } = require('stellar-sdk');
  return {
    server: { loadAccount: jest.fn() },
    NOVA: new Asset('NOVA', 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'),
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

    // Decode the XDR envelope and inspect operations
    const envelope = xdr.TransactionEnvelope.fromXDR(xdrResult, 'base64');
    const ops = envelope.v1().tx().operations();

    expect(ops).toHaveLength(1);

    const op = ops[0].body();
    // Operation type must be changeTrust
    expect(op.switch().name).toBe('changeTrust');

    const changeTrustOp = op.changeTrustOp();
    const asset = changeTrustOp.line().toAsset();

    expect(asset.getCode()).toBe('NOVA');
    expect(asset.getIssuer()).toBe(process.env.ISSUER_PUBLIC);
  });
});
