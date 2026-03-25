// Feature: nova-rewards — POST /api/trustline/verify
// Validates: Requirements 2.3, 2.4
// Covers:
//   1. Valid address — returns { exists: boolean }
//   2. Invalid address — returns 400
//   3. Missing body — returns 400

process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.ISSUER_PUBLIC = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
process.env.STELLAR_NETWORK = 'testnet';

// Mock stellarService — isValidStellarAddress uses real StrKey logic
jest.mock('../../blockchain/stellarService', () => {
  const { StrKey } = require('stellar-sdk');
  return {
    isValidStellarAddress: jest.fn((addr) => {
      if (typeof addr !== 'string') return false;
      try { return StrKey.isValidEd25519PublicKey(addr); } catch { return false; }
    }),
    server: { loadAccount: jest.fn() },
    NOVA: { code: 'NOVA', issuer: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN' },
  };
});

// Mock trustline module — verifyTrustline is controlled per test
jest.mock('../../blockchain/trustline', () => ({
  verifyTrustline: jest.fn(),
  buildTrustlineXDR: jest.fn(),
}));

const express = require('express');
const http = require('http');
const { Keypair } = require('stellar-sdk');
const { verifyTrustline } = require('../../blockchain/trustline');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/trustline', require('../routes/trustline'));
  return app;
}

// Helper: fire a POST request against the running server
function post(server, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
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

describe('POST /api/trustline/verify', () => {
  let server;

  beforeAll((done) => {
    server = http.createServer(buildApp()).listen(0, done);
  });

  afterAll((done) => server.close(done));

  beforeEach(() => jest.clearAllMocks());

  // ── 1. Valid address ────────────────────────────────────────────────────────
  test('returns 200 with { exists: true } for a wallet that has a trustline', async () => {
    verifyTrustline.mockResolvedValue({ exists: true });

    const walletAddress = Keypair.random().publicKey();
    const { status, body } = await post(server, '/api/trustline/verify', { walletAddress });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ exists: true });
    expect(verifyTrustline).toHaveBeenCalledWith(walletAddress);
  });

  test('returns 200 with { exists: false } for a wallet without a trustline', async () => {
    verifyTrustline.mockResolvedValue({ exists: false });

    const walletAddress = Keypair.random().publicKey();
    const { status, body } = await post(server, '/api/trustline/verify', { walletAddress });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ exists: false });
  });

  // ── 2. Invalid address ──────────────────────────────────────────────────────
  test('returns 400 for an invalid Stellar address', async () => {
    const { status, body } = await post(server, '/api/trustline/verify', {
      walletAddress: 'not-a-valid-key',
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('validation_error');
    expect(verifyTrustline).not.toHaveBeenCalled();
  });

  // ── 3. Missing body ─────────────────────────────────────────────────────────
  test('returns 400 when walletAddress is missing from the body', async () => {
    const { status, body } = await post(server, '/api/trustline/verify', {});

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('validation_error');
    expect(verifyTrustline).not.toHaveBeenCalled();
  });

  test('returns 400 when the request body is empty', async () => {
    const { status, body } = await post(server, '/api/trustline/verify', '');

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('validation_error');
    expect(verifyTrustline).not.toHaveBeenCalled();
  });
});
