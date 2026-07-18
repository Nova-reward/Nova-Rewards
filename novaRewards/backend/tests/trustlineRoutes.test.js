// Coverage tests for trustline routes (build-xdr, build)
const express = require('express');
const request = require('supertest');
const { Keypair } = require('stellar-sdk');

jest.mock('../../blockchain/stellarService', () => ({
  isValidStellarAddress: jest.fn((addr) => {
    try {
      const { StrKey } = require('stellar-sdk');
      return StrKey.isValidEd25519PublicKey(addr);
    } catch { return false; }
  }),
}));

jest.mock('../../blockchain/trustline', () => ({
  verifyTrustline: jest.fn(),
  buildTrustlineXDR: jest.fn(),
}));

const { verifyTrustline, buildTrustlineXDR } = require('../../blockchain/trustline');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/trustline', require('../routes/trustline'));
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({ success: false, error: 'internal_error', message: err.message });
  });
  return app;
}

let app;
beforeAll(() => { app = buildApp(); });
beforeEach(() => jest.clearAllMocks());

describe('POST /api/trustline/build-xdr', () => {
  test('400 - invalid wallet', async () => {
    const res = await request(app).post('/api/trustline/build-xdr').send({ walletAddress: 'bad' });
    expect(res.status).toBe(400);
  });

  test('200 - returns already_exists when trustline exists', async () => {
    verifyTrustline.mockResolvedValue({ exists: true });
    const res = await request(app).post('/api/trustline/build-xdr')
      .send({ walletAddress: Keypair.random().publicKey() });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('already_exists');
  });

  test('200 - returns XDR when trustline does not exist', async () => {
    verifyTrustline.mockResolvedValue({ exists: false });
    buildTrustlineXDR.mockResolvedValue('AAAAAXDR...');
    const res = await request(app).post('/api/trustline/build-xdr')
      .send({ walletAddress: Keypair.random().publicKey() });
    expect(res.status).toBe(200);
    expect(res.body.data.xdr).toBe('AAAAAXDR...');
  });
});

describe('POST /api/trustline/build', () => {
  test('400 - invalid wallet', async () => {
    const res = await request(app).post('/api/trustline/build').send({ walletAddress: 'bad' });
    expect(res.status).toBe(400);
  });

  test('200 - returns XDR', async () => {
    buildTrustlineXDR.mockResolvedValue('AAAAAXDR...');
    const res = await request(app).post('/api/trustline/build')
      .send({ walletAddress: Keypair.random().publicKey() });
    expect(res.status).toBe(200);
    expect(res.body.xdr).toBe('AAAAAXDR...');
  });
});
