// Feature: nova-rewards, rewards route campaign existence handling
// Validates: clear distinction between missing and inactive/expired campaign

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
const { Keypair } = require('stellar-sdk');
const { query } = require('../db/index');
const { getCampaignById, getActiveCampaign } = require('../db/campaignRepository');
const { distributeRewards } = require('../../blockchain/sendRewards');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/rewards', require('../routes/rewards'));
  return app;
}

function postDistribute(server, body, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/rewards/distribute',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'x-api-key': apiKey,
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

describe('POST /api/rewards/distribute — campaign not found', () => {
  let server;
  const merchant = { id: 1, api_key: 'test-api-key' };

  beforeAll((done) => {
    server = http.createServer(buildApp()).listen(0, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [merchant] });
  });

  test('returns 404 when campaign does not exist', async () => {
    getCampaignById.mockResolvedValue(null);

    const response = await postDistribute(
      server,
      {
        walletAddress: Keypair.random().publicKey(),
        amount: 10,
        campaignId: 999,
      },
      merchant.api_key
    );

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('not_found');
    expect(getActiveCampaign).not.toHaveBeenCalled();
    expect(distributeRewards).not.toHaveBeenCalled();
  });
});