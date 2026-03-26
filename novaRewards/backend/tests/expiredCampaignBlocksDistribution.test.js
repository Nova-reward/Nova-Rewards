// Feature: nova-rewards, Property 7: Expired campaigns block distribution
// Validates: Requirements 7.4, 7.5
// Property: For any campaign with end_date in the past, distribution route returns 400 without calling distributeRewards

const fc = require('fast-check');
const { Keypair } = require('stellar-sdk');

process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.ISSUER_PUBLIC = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
process.env.DISTRIBUTION_PUBLIC = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
process.env.STELLAR_NETWORK = 'testnet';

jest.mock('../db/index', () => ({ query: jest.fn() }));
jest.mock('../db/campaignRepository', () => ({
  getCampaignById: jest.fn(),
  getActiveCampaign: jest.fn(),
}));
jest.mock('../db/transactionRepository', () => ({
  recordTransaction: jest.fn(),
}));
jest.mock('../../blockchain/sendRewards', () => ({
  distributeRewards: jest.fn(),
}));
jest.mock('../../blockchain/stellarService', () => ({
  isValidStellarAddress: jest.fn((addr) => {
    try {
      const { StrKey } = require('stellar-sdk');
      return StrKey.isValidEd25519PublicKey(addr);
    } catch {
      return false;
    }
  }),
}));

const express = require('express');
const http = require('http');
const { getCampaignById, getActiveCampaign } = require('../db/campaignRepository');
const { distributeRewards } = require('../../blockchain/sendRewards');
const { query } = require('../db/index');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/rewards', require('../routes/rewards'));
  return app;
}

const pastDateArb = fc
  .date({
    min: new Date('2000-01-01'),
    max: new Date(Date.now() - 86_400_000),
  })
  .map((d) => d.toISOString().slice(0, 10));

describe('POST /api/rewards/distribute — expired campaign (Property 7)', () => {
  let app;
  const VALID_API_KEY = 'test-api-key';
  const MERCHANT = { id: 1, api_key: VALID_API_KEY };

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [MERCHANT] });
  });

  test('returns 400 and never calls distributeRewards for any past end_date', async () => {
    await fc.assert(
      fc.asyncProperty(
        pastDateArb,
        fc.integer({ min: 1, max: 999 }),
        async (endDate, campaignId) => {
          getCampaignById.mockResolvedValue({
            id: campaignId,
            merchant_id: MERCHANT.id,
            end_date: endDate,
            is_active: false,
          });
          getActiveCampaign.mockResolvedValue(null);

          const customerWallet = Keypair.random().publicKey();
          const server = http.createServer(app);
          await new Promise((resolve) => server.listen(0, resolve));
          const port = server.address().port;

          let statusCode;
          let body;

          await new Promise((resolve, reject) => {
            const payload = JSON.stringify({ customerWallet, amount: 10, campaignId });
            const req = http.request(
              {
                hostname: '127.0.0.1',
                port,
                path: '/api/rewards/distribute',
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(payload),
                  'x-api-key': VALID_API_KEY,
                },
              },
              (res) => {
                statusCode = res.statusCode;
                let raw = '';
                res.on('data', (chunk) => { raw += chunk; });
                res.on('end', () => {
                  body = JSON.parse(raw);
                  resolve();
                });
              }
            );
            req.on('error', reject);
            req.write(payload);
            req.end();
          });

          await new Promise((resolve) => server.close(resolve));

          expect(statusCode).toBe(400);
          expect(body.success).toBe(false);
          expect(body.error).toBe('invalid_campaign');
          expect(distributeRewards).not.toHaveBeenCalled();

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
