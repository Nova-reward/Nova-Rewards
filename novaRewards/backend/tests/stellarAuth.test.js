/**
 * Tests for Stellar wallet authentication (challenge-response flow).
 *
 * Covers:
 *  - POST /api/auth/challenge  (happy path, validation, nonce generation)
 *  - POST /api/auth/verify     (happy path, expired nonce, invalid signature, replay)
 *  - stellarAuthService internals (nonce storage, signature verification, JWT claims)
 */

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
jest.mock('../lib/redis', () => {
  const store = new Map();
  const expiries = new Map();
  return {
    client: {
      isOpen: true,
      get: jest.fn((key) => {
        if (expiries.has(key) && Date.now() > expiries.get(key)) {
          store.delete(key);
          expiries.delete(key);
          return Promise.resolve(null);
        }
        return Promise.resolve(store.get(key) || null);
      }),
      set: jest.fn((key, value, opts) => {
        store.set(key, value);
        if (opts?.EX) expiries.set(key, Date.now() + opts.EX * 1000);
        return Promise.resolve('OK');
      }),
      del: jest.fn((key) => {
        const had = store.has(key);
        store.delete(key);
        expiries.delete(key);
        return Promise.resolve(had ? 1 : 0);
      }),
    },
    connectRedis: jest.fn(),
  };
});

jest.mock('../db/index', () => ({
  query: jest.fn(),
  pool: { end: jest.fn() },
}));

jest.mock('../middleware/rateLimiter', () => ({
  slidingAuth: (req, res, next) => next(),
  slidingGlobal: (req, res, next) => next(),
}));

const express = require('express');
const request = require('supertest');
const { Keypair } = require('stellar-sdk');
const jwt = require('jsonwebtoken');

const { query } = require('../db/index');
const { client: redisClient } = require('../lib/redis');
const stellarAuthService = require('../services/stellarAuthService');

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/stellarAuth'));
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || 'internal_error',
      message: err.message || 'An unexpected error occurred',
    });
  });
  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-tests';
process.env.JWT_SECRET = JWT_SECRET;

function signChallenge(keypair, message) {
  const msgBytes = Buffer.from(message, 'utf-8');
  const sig = keypair.sign(msgBytes);
  return sig.toString('base64');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Stellar Auth — POST /api/auth/challenge', () => {
  const app = buildApp();

  it('returns a nonce tied to the wallet address', async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();

    const res = await request(app)
      .post('/api/auth/challenge')
      .send({ walletAddress: wallet });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.walletAddress).toBe(wallet);
    expect(res.body.data.nonce).toBeDefined();
    expect(typeof res.body.data.nonce).toBe('string');
    expect(res.body.data.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(res.body.data.message).toContain(wallet);
    expect(res.body.data.message).toContain(res.body.data.nonce);
  });

  it('returns 400 when walletAddress is missing', async () => {
    const res = await request(app)
      .post('/api/auth/challenge')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns 400 for an invalid Stellar address', async () => {
    const res = await request(app)
      .post('/api/auth/challenge')
      .send({ walletAddress: 'not-a-valid-key' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('overwrites previous nonce for the same wallet', async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();

    const res1 = await request(app)
      .post('/api/auth/challenge')
      .send({ walletAddress: wallet });

    const res2 = await request(app)
      .post('/api/auth/challenge')
      .send({ walletAddress: wallet });

    expect(res2.status).toBe(200);
    // Nonces should differ (UUID v4)
    expect(res2.body.data.nonce).not.toBe(res1.body.data.nonce);
  });
});

describe('Stellar Auth — POST /api/auth/verify', () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: user not found → auto-create
    query.mockReset();
    query.mockResolvedValue({
      rows: [{ id: 1, wallet_address: 'auto', role: 'user' }],
    });
  });

  it('issues a JWT on valid signature', async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();

    // Step 1: get challenge
    const challengeRes = await request(app)
      .post('/api/auth/challenge')
      .send({ walletAddress: wallet });

    const { nonce, message } = challengeRes.body.data;

    // Step 2: sign the challenge message
    const signedChallenge = signChallenge(kp, message);

    // Step 3: verify
    const verifyRes = await request(app)
      .post('/api/auth/verify')
      .send({ walletAddress: wallet, signedChallenge });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.accessToken).toBeDefined();
    expect(verifyRes.body.data.refreshToken).toBeDefined();
    expect(verifyRes.body.data.user.walletAddress).toBe(wallet);
    expect(verifyRes.body.data.user.role).toBe('user');

    // Verify JWT claims
    const decoded = jwt.verify(verifyRes.body.data.accessToken, JWT_SECRET);
    expect(decoded.walletAddress).toBe(wallet);
    expect(decoded.role).toBe('user');
    expect(decoded.userId).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('returns 401 for expired or missing nonce', async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();

    // No challenge was requested
    const message = stellarAuthService._buildChallengeMessage(wallet, 'fake-nonce');
    const signedChallenge = signChallenge(kp, message);

    const res = await request(app)
      .post('/api/auth/verify')
      .send({ walletAddress: wallet, signedChallenge });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('challenge_expired');
  });

  it('returns 401 for an invalid signature', async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();

    // Get a valid challenge
    const challengeRes = await request(app)
      .post('/api/auth/challenge')
      .send({ walletAddress: wallet });

    // Sign with a different keypair
    const wrongKp = Keypair.random();
    const signedChallenge = signChallenge(wrongKp, challengeRes.body.data.message);

    const res = await request(app)
      .post('/api/auth/verify')
      .send({ walletAddress: wallet, signedChallenge });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_signature');
  });

  it('prevents replay attacks — nonce is single-use', async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();

    const challengeRes = await request(app)
      .post('/api/auth/challenge')
      .send({ walletAddress: wallet });

    const message = challengeRes.body.data.message;
    const signedChallenge = signChallenge(kp, message);

    // First verification succeeds
    const res1 = await request(app)
      .post('/api/auth/verify')
      .send({ walletAddress: wallet, signedChallenge });
    expect(res1.status).toBe(200);

    // Replay the same signature → should fail
    const res2 = await request(app)
      .post('/api/auth/verify')
      .send({ walletAddress: wallet, signedChallenge });
    expect(res2.status).toBe(401);
    expect(res2.body.error).toBe('challenge_expired');
  });

  it('returns 400 when walletAddress is missing', async () => {
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ signedChallenge: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns 400 when signedChallenge is missing', async () => {
    const kp = Keypair.random();
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ walletAddress: kp.publicKey() });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns 400 for an invalid wallet address', async () => {
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ walletAddress: 'invalid', signedChallenge: 'abc' });

    expect(res.status).toBe(400);
  });

  it('uses existing user role when user already exists', async () => {
    const kp = Keypair.random();
    const wallet = kp.publicKey();

    // Mock: user already exists with admin role
    query.mockResolvedValueOnce({
      rows: [{ id: 42, wallet_address: wallet, role: 'admin' }],
    });

    const challengeRes = await request(app)
      .post('/api/auth/challenge')
      .send({ walletAddress: wallet });

    const message = challengeRes.body.data.message;
    const signedChallenge = signChallenge(kp, message);

    const verifyRes = await request(app)
      .post('/api/auth/verify')
      .send({ walletAddress: wallet, signedChallenge });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.user.role).toBe('admin');

    const decoded = jwt.verify(verifyRes.body.data.accessToken, JWT_SECRET);
    expect(decoded.role).toBe('admin');
  });
});

describe('stellarAuthService internals', () => {
  describe('_buildChallengeMessage', () => {
    it('produces a deterministic message with wallet and nonce', () => {
      const msg = stellarAuthService._buildChallengeMessage(
        'GABC123',
        'nonce-xyz',
      );
      expect(msg).toBe('NovaRewards Auth\nWallet: GABC123\nNonce: nonce-xyz');
    });
  });

  describe('_isValidWallet', () => {
    it('accepts valid Ed25519 public keys', () => {
      const kp = Keypair.random();
      expect(stellarAuthService._isValidWallet(kp.publicKey())).toBe(true);
    });

    it('rejects invalid strings', () => {
      expect(stellarAuthService._isValidWallet('not-a-key')).toBe(false);
      expect(stellarAuthService._isValidWallet('')).toBe(false);
      expect(stellarAuthService._isValidWallet(null)).toBe(false);
      expect(stellarAuthService._isValidWallet(undefined)).toBe(false);
      expect(stellarAuthService._isValidWallet(123)).toBe(false);
    });
  });

  describe('_verifyStellarSignature', () => {
    it('returns true for a valid signature', () => {
      const kp = Keypair.random();
      const message = 'test message';
      const sig = signChallenge(kp, message);

      expect(
        stellarAuthService._verifyStellarSignature(kp.publicKey(), message, sig),
      ).toBe(true);
    });

    it('returns false for a signature from a different key', () => {
      const kp1 = Keypair.random();
      const kp2 = Keypair.random();
      const message = 'test message';
      const sig = signChallenge(kp1, message);

      expect(
        stellarAuthService._verifyStellarSignature(kp2.publicKey(), message, sig),
      ).toBe(false);
    });

    it('returns false for malformed signature', () => {
      const kp = Keypair.random();
      expect(
        stellarAuthService._verifyStellarSignature(kp.publicKey(), 'msg', 'not-base64!!!'),
      ).toBe(false);
    });
  });
});
