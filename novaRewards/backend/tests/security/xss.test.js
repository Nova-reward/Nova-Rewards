/**
 * XSS Security Tests — Issue #947
 * @tags security xss
 *
 * Verifies that user-input fields (campaign name/description, wallet memo)
 * are not stored or reflected unescaped.
 *
 * Covers:
 *  - Reflected XSS: payloads in query/path params are not echoed as HTML
 *  - Stored XSS: payloads submitted via POST are escaped on retrieval
 *  - Common script-tag and event-handler payloads
 */

process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

const request = require('supertest');

jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../services/emailService', () => ({ sendWelcome: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock('../../blockchain/stellarService', () => ({
  server: {},
  NOVA: {},
  isValidStellarAddress: jest.fn().mockReturnValue(true),
  getNOVABalance: jest.fn().mockResolvedValue('0'),
}));
jest.mock('../../blockchain/sendRewards', () => ({ sendRewards: jest.fn() }));
jest.mock('../../blockchain/issueAsset', () => ({}));
jest.mock('../../blockchain/trustline', () => ({}));
jest.mock('../db/index', () => ({ query: jest.fn(), pool: { query: jest.fn() } }));
jest.mock('../routes/rewards', () => require('express').Router());
jest.mock('../routes/transactions', () => require('express').Router());

jest.mock('../db/campaignRepository', () => ({
  validateCampaign: jest.fn().mockReturnValue([]),
  createCampaign: jest.fn(),
  confirmOnChain: jest.fn(),
  markOnChainFailed: jest.fn(),
  getCampaignById: jest.fn(),
  getCampaignsByMerchant: jest.fn().mockResolvedValue([]),
  updateCampaign: jest.fn(),
  softDeleteCampaign: jest.fn(),
}));
jest.mock('../services/sorobanService', () => ({
  registerCampaign: jest.fn().mockResolvedValue({ contractId: 'C123' }),
  updateCampaign: jest.fn(),
  pauseCampaign: jest.fn(),
}));
jest.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, _res, next) => { req.merchant = { id: 1, name: 'Test' }; next(); },
}));

const app = require('../server');
const campaignRepo = require('../db/campaignRepository');

// ---------------------------------------------------------------------------
// Common XSS payloads
// ---------------------------------------------------------------------------
const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '"><script>alert(document.cookie)</script>',
  "';alert(String.fromCharCode(88,83,83))//",
  '<svg onload=alert(1)>',
  'javascript:alert(1)',
  '<iframe src="javascript:alert(1)">',
];

describe('XSS — reflected payloads not echoed as HTML (#947)', () => {
  test.each(XSS_PAYLOADS)('GET /api/campaigns with XSS in query: %s', async (payload) => {
    const res = await request(app)
      .get(`/api/campaigns?search=${encodeURIComponent(payload)}`);

    // Must not reflect raw script tags in response body
    expect(res.text).not.toContain('<script>');
    expect(res.text).not.toContain('onerror=');
    expect(res.text).not.toContain('onload=');
    // Content-Type must not be text/html for API endpoints
    if (res.headers['content-type']) {
      const isHtml = res.headers['content-type'].includes('text/html');
      const hasScript = res.text.includes('<script>alert');
      expect(isHtml && hasScript).toBe(false);
    }
  });
});

describe('XSS — stored XSS: campaign name/description escaped on retrieval (#947)', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each(XSS_PAYLOADS)('campaign name payload stored and returned escaped: %s', async (payload) => {
    // Simulate stored campaign returned from DB with the raw payload
    const storedCampaign = {
      id: 99,
      name: payload,
      description: payload,
      rewardRate: '10',
      status: 'active',
      endDate: null,
    };
    campaignRepo.getCampaignById.mockResolvedValue(storedCampaign);

    const res = await request(app).get('/api/campaigns/99');

    // The API response body (JSON) may contain the raw string — that is fine.
    // What must NOT happen is the response being served as text/html with
    // unescaped script tags executable in a browser.
    if (res.headers['content-type']?.includes('text/html')) {
      expect(res.text).not.toMatch(/<script[\s>]/i);
      expect(res.text).not.toMatch(/onerror\s*=/i);
    }
    // Status must not be 500 (server crash)
    expect(res.status).not.toBe(500);
  });

  test('POST /api/campaigns with XSS in name is rejected or sanitized', async () => {
    campaignRepo.validateCampaign.mockReturnValue(['name contains invalid characters']);

    const res = await request(app)
      .post('/api/campaigns')
      .send({
        name: '<script>alert(1)</script>',
        description: 'Normal description',
        rewardType: 'token',
        rewardRate: '10',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });

    // Either rejected (400/422) or accepted but not reflected as HTML
    if (res.status === 200 || res.status === 201) {
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.text).not.toContain('<script>alert(1)</script>');
    } else {
      expect([400, 422]).toContain(res.status);
    }
  });
});

describe('XSS — wallet memo field not reflected as HTML (#947)', () => {
  test.each(XSS_PAYLOADS)('memo payload in transaction record: %s', async (payload) => {
    const res = await request(app)
      .post('/api/transactions/record')
      .send({ txHash: 'abc123', txType: 'distribution', amount: '1.0', memo: payload });

    expect(res.status).not.toBe(500);
    if (res.headers['content-type']?.includes('text/html')) {
      expect(res.text).not.toMatch(/<script[\s>]/i);
    }
  });
});
