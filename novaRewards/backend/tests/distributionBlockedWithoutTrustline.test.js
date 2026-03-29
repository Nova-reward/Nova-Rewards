// Feature: nova-rewards, Property 8: Distribution is blocked for any wallet without a trustline
// Validates: Requirements 3.2, 3.3, 3.6
//
// Property under test:
//   For ALL valid Stellar recipient addresses where verifyTrustline returns { exists: false },
//   distributeRewards MUST:
//     1. Throw an error with code === 'no_trustline'
//     2. Never call server.loadAccount  (no Horizon account load attempted)
//     3. Never call server.submitTransaction (no on-chain tx submitted)
//
//   And at the HTTP layer (POST /api/rewards/distribute), the route MUST:
//     1. Return HTTP 400
//     2. Return body.error === 'no_trustline'
//     3. Never call recordTransaction (no DB write attempted)

const fc = require('fast-check');
const { Keypair } = require('stellar-sdk');

// ── env setup ─────────────────────────────────────────────────────────────────
const ISSUER_KEY  = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
const DIST_SECRET = 'SDCAOELAD27GUNRPWJ2QXINWREZVTMOQF4UXIYVBHJSYLU6V4KKJJTJA';

process.env.HORIZON_URL         = 'https://horizon-testnet.stellar.org';
process.env.ISSUER_PUBLIC       = ISSUER_KEY;
process.env.DISTRIBUTION_PUBLIC = Keypair.fromSecret(DIST_SECRET).publicKey();
process.env.DISTRIBUTION_SECRET = DIST_SECRET;
process.env.STELLAR_NETWORK     = 'testnet';

// ── mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../blockchain/stellarService', () => {
  const { Asset } = require('stellar-sdk');
  return {
    server: {
      loadAccount:       jest.fn(),
      submitTransaction: jest.fn(),
    },
    NOVA: new Asset('NOVA', 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K'),
    isValidStellarAddress: jest.fn((addr) => {
      try {
        const { StrKey } = require('stellar-sdk');
        return StrKey.isValidEd25519PublicKey(addr);
      } catch { return false; }
    }),
  };
});

jest.mock('../../blockchain/trustline', () => ({
  verifyTrustline: jest.fn(),
}));

jest.mock('../db/index', () => ({ query: jest.fn() }));

jest.mock('../db/campaignRepository', () => ({
  getActiveCampaign: jest.fn(),
  getCampaignById: jest.fn(),
}));

jest.mock('../db/transactionRepository', () => ({
  recordTransaction: jest.fn(),
}));

// ── imports (after mocks) ─────────────────────────────────────────────────────
const http    = require('http');
const express = require('express');

const { server: horizonServer } = require('../../blockchain/stellarService');
const { verifyTrustline }       = require('../../blockchain/trustline');
const { distributeRewards }     = require('../../blockchain/sendRewards');
const { getActiveCampaign, getCampaignById } = require('../db/campaignRepository');
const { recordTransaction }     = require('../db/transactionRepository');
const { query }                 = require('../db/index');

// ── helpers ───────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/rewards', require('../routes/rewards'));
  // Global error handler — returns JSON instead of HTML
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || 'internal_error',
      message: err.message || 'An unexpected error occurred',
    });
  });
  return app;
}

function post(srv, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: srv.address().port,
        path,
        method: 'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── arbitraries ───────────────────────────────────────────────────────────────

/** Any valid Stellar public key — same shape as a real customer wallet. */
const validStellarAddressArb = fc.nat().map(() => Keypair.random().publicKey());

/** Positive integer amount as string. */
const positiveAmountArb = fc.integer({ min: 1, max: 1000 }).map(String);

/** Campaign id. */
const campaignIdArb = fc.integer({ min: 1, max: 9999 });

// ── unit-level property tests (distributeRewards directly) ────────────────────

describe('distributeRewards — no trustline blocks distribution (unit, Property 8)', () => {
  beforeEach(() => jest.clearAllMocks());

  test(
    'throws no_trustline for ANY valid recipient address when trustline is absent',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          validStellarAddressArb,
          positiveAmountArb,
          async (toWallet, amount) => {
            verifyTrustline.mockResolvedValue({ exists: false });

            await expect(
              distributeRewards({ toWallet, amount })
            ).rejects.toMatchObject({
              code: 'no_trustline',
              message: expect.stringContaining('trustline'),
            });

            expect(verifyTrustline).toHaveBeenCalledWith(toWallet);
            expect(horizonServer.loadAccount).not.toHaveBeenCalled();
            expect(horizonServer.submitTransaction).not.toHaveBeenCalled();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  test(
    'error code is exactly "no_trustline" (not a generic error) for any wallet',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          validStellarAddressArb,
          async (toWallet) => {
            verifyTrustline.mockResolvedValue({ exists: false });

            let thrownError;
            try {
              await distributeRewards({ toWallet, amount: '10' });
            } catch (err) {
              thrownError = err;
            }

            expect(thrownError).toBeDefined();
            expect(thrownError.code).toBe('no_trustline');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  test(
    'no_trustline is thrown regardless of the requested amount',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          validStellarAddressArb,
          fc.oneof(
            fc.integer({ min: 1, max: 1_000_000 }).map(String),
            fc
              .double({ min: 0.0000001, max: 999999.9, noNaN: true, noDefaultInfinity: true })
              .map((n) => n.toFixed(7))
          ),
          async (toWallet, amount) => {
            verifyTrustline.mockResolvedValue({ exists: false });

            await expect(
              distributeRewards({ toWallet, amount })
            ).rejects.toMatchObject({ code: 'no_trustline' });

            expect(horizonServer.submitTransaction).not.toHaveBeenCalled();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ── HTTP-layer property tests (POST /api/rewards/distribute) ──────────────────

describe('POST /api/rewards/distribute — no trustline blocked at route (integration, Property 8)', () => {
  const VALID_API_KEY = 'test-api-key-prop8';
  const MERCHANT      = { id: 42, api_key: VALID_API_KEY };
  const CAMPAIGN      = { id: 7, merchant_id: MERCHANT.id, status: 'active' };

  let srv;

  beforeAll((done) => {
    srv = http.createServer(buildApp()).listen(0, done);
  });

  afterAll((done) => { srv.close(done); });

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [MERCHANT] });
    getCampaignById.mockResolvedValue(CAMPAIGN);
    getActiveCampaign.mockResolvedValue(CAMPAIGN);
  });

  test(
    'returns 400 with error "no_trustline" for ANY wallet that has no trustline',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          validStellarAddressArb,
          positiveAmountArb,
          campaignIdArb,
          async (customerWallet, amount, campaignId) => {
            verifyTrustline.mockResolvedValue({ exists: false });

            const { status, body } = await post(
              srv,
              '/api/rewards/distribute',
              { walletAddress: customerWallet, amount, campaignId },
              { 'x-api-key': VALID_API_KEY }
            );

            expect(status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error).toBe('no_trustline');
            expect(body.message).toEqual(expect.stringContaining('trustline'));
            expect(recordTransaction).not.toHaveBeenCalled();
            expect(horizonServer.submitTransaction).not.toHaveBeenCalled();

            return true;
          }
        ),
        { numRuns: 50 }
      );
    }
  );

  test(
    'no_trustline response is consistent regardless of the amount requested',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          validStellarAddressArb,
          fc.integer({ min: 1, max: 100_000 }).map(String),
          async (customerWallet, amount) => {
            verifyTrustline.mockResolvedValue({ exists: false });

            const { status, body } = await post(
              srv,
              '/api/rewards/distribute',
              { walletAddress: customerWallet, amount, campaignId: CAMPAIGN.id },
              { 'x-api-key': VALID_API_KEY }
            );

            expect(status).toBe(400);
            expect(body.error).toBe('no_trustline');
            expect(recordTransaction).not.toHaveBeenCalled();

            return true;
          }
        ),
        { numRuns: 50 }
      );
    }
  );

  test(
    'wallets WITH a trustline are NOT blocked — distribution proceeds past the trustline gate',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          validStellarAddressArb,
          async (customerWallet) => {
            // Trustline exists — gate is cleared, but loadAccount throws to stop further execution
            verifyTrustline.mockResolvedValue({ exists: true });
            horizonServer.loadAccount.mockRejectedValue(new Error('Horizon error'));

            const { body } = await post(
              srv,
              '/api/rewards/distribute',
              { walletAddress: customerWallet, amount: '10', campaignId: CAMPAIGN.id },
              { 'x-api-key': VALID_API_KEY }
            );

            // The trustline gate was passed — error must NOT be no_trustline
            expect(body.error).not.toBe('no_trustline');

            return true;
          }
        ),
        { numRuns: 30 }
      );
    }
  );
});
