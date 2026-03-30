// Feature: nova-rewards, Property 2: Trustline verification is idempotent
// Validates: Requirements 2.3, 2.4
//
// Property under test:
//   For ANY valid Stellar wallet address, calling verifyTrustline three times
//   in parallel must always return identical results — the function has no
//   side-effects and its output depends solely on the mocked Horizon state.

const fc = require('fast-check');
const { Keypair } = require('stellar-sdk');

process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.ISSUER_PUBLIC = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
process.env.STELLAR_NETWORK = 'testnet';

// ---------------------------------------------------------------------------
// Mock the Horizon server — tests must never hit the real network
// ---------------------------------------------------------------------------
jest.mock('../../blockchain/stellarService', () => {
  return {
    server: {
      loadAccount: jest.fn(),
    },
    NOVA: { code: 'NOVA', issuer: process.env.ISSUER_PUBLIC },
    isValidStellarAddress: jest.fn((addr) => {
      try {
        const { StrKey } = require('stellar-sdk');
        return StrKey.isValidEd25519PublicKey(addr);
      } catch { return false; }
    }),
    getNOVABalance: jest.fn(),
  };
});

const { server } = require('../../blockchain/stellarService');
const { verifyTrustline } = require('../../blockchain/trustline');

// ---------------------------------------------------------------------------
// Arbitrary: generates a valid Stellar Ed25519 public key on each run
// ---------------------------------------------------------------------------
const stellarPublicKey = () =>
  fc.constant(null).map(() => Keypair.random().publicKey());

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Property 2 — idempotence
// ---------------------------------------------------------------------------
describe('verifyTrustline - idempotence (Property 2)', () => {
  test('returns the same result on repeated calls for a wallet WITH a trustline', async () => {
    await fc.assert(
      fc.asyncProperty(stellarPublicKey(), async (wallet) => {
        server.loadAccount.mockResolvedValue({
          balances: [
            {
              asset_type: 'credit_alphanum4',
              asset_code: 'NOVA',
              asset_issuer: process.env.ISSUER_PUBLIC,
              balance: '100.0000000',
            },
          ],
        });

        const results = await Promise.all([
          verifyTrustline(wallet),
          verifyTrustline(wallet),
          verifyTrustline(wallet),
        ]);

        // All three parallel calls must be structurally identical
        expect(results[0]).toEqual(results[1]);
        expect(results[1]).toEqual(results[2]);
        // And the value must be correct for this scenario
        expect(results[0].exists).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('returns the same result on repeated calls for a wallet WITHOUT a trustline', async () => {
    await fc.assert(
      fc.asyncProperty(stellarPublicKey(), async (wallet) => {
        server.loadAccount.mockResolvedValue({
          balances: [{ asset_type: 'native', balance: '10.0000000' }],
        });

        const results = await Promise.all([
          verifyTrustline(wallet),
          verifyTrustline(wallet),
          verifyTrustline(wallet),
        ]);

        expect(results[0]).toEqual(results[1]);
        expect(results[1]).toEqual(results[2]);
        expect(results[0].exists).toBe(false);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('returns { exists: false } for a 404 account without throwing', async () => {
    await fc.assert(
      fc.asyncProperty(stellarPublicKey(), async (wallet) => {
        const notFoundErr = new Error('Not Found');
        notFoundErr.response = { status: 404 };
        server.loadAccount.mockRejectedValue(notFoundErr);

        const result = await verifyTrustline(wallet);
        expect(result).toEqual({ exists: false });
        return true;
      }),
      { numRuns: 50 }
    );
  });
});
