/**
 * Comprehensive API Integration Tests — Nova Rewards Backend
 *
 * Covers:
 *  - Auth:        POST /auth/register, POST /auth/login, POST /auth/refresh, POST /auth/logout
 *  - Users:       POST /users, GET /users/:id, PATCH /users/:id, DELETE /users/:id,
 *                 GET /users/:id/referrals, GET /users/:walletAddress/points
 *  - Campaigns:   POST /campaigns, GET /campaigns, GET /campaigns/:id,
 *                 PATCH /campaigns/:id, DELETE /campaigns/:id
 *  - Rewards:     POST /rewards/issue, POST /rewards/distribute
 *  - Transactions: GET /transactions/merchant-totals, GET /transactions/:walletAddress,
 *                  GET /transactions/user/history, GET /transactions/merchant/history
 *  - Wallets:     GET /wallet/supported, POST /wallet/verify, POST /wallet/validate,
 *                 GET /wallet/balances/:publicKey, GET /wallet/history/:publicKey,
 *                 GET /wallet/status/:publicKey, GET /wallet/balance,
 *                 POST /wallet/submit, POST /wallet/trustline,
 *                 POST /wallet/activity, POST /wallet/disconnect
 *  - Admin:       GET /admin/stats, GET /admin/users, POST /admin/rewards,
 *                 PATCH /admin/rewards/:id, DELETE /admin/rewards/:id,
 *                 GET /admin/metrics, POST /admin/campaigns/:id/pause,
 *                 GET /admin/audit-logs, DELETE /admin/abuse/unblock/:identifier
 *  - Redemptions: POST /redemptions, GET /redemptions, GET /redemptions/:id
 *  - Error handling: validation, auth, authorization, edge cases
 */

const express = require('express');
const request = require('supertest');

// ── Environment setup ─────────────────────────────────────────────────────
process.env.ISSUER_PUBLIC = 'GBMPE4IA36LQV7BEDJHW4M2Y2B27X2OPUO5EFCCKUDHSLVXCJPSNFNSU';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars!!';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// ── DB mock ───────────────────────────────────────────────────────────────
const mockQuery = vi.fn();
vi.mock('../db/index', () => ({ query: (...args) => mockQuery(...args), pool: { query: (...args) => mockQuery(...args) } }));

// ── Service mocks (must be before module requires) ────────────────────────
vi.mock('../services/tokenService', () => ({
  signAccessToken: vi.fn(() => 'mock.access.token'),
  signRefreshToken: vi.fn(() => 'mock.refresh.token'),
  verifyToken: vi.fn(),
  isRevoked: vi.fn().mockResolvedValue(false),
  consumeRefreshJti: vi.fn().mockResolvedValue('wallet_addr'),
  storeRefreshJti: vi.fn(),
  revokeToken: vi.fn(),
}));

vi.mock('../services/emailService', () => ({ sendWelcome: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock('../services/referralService', () => ({
  getUserReferralStats: vi.fn().mockResolvedValue({ total_referrals: 0, total_bonus_earned: 0 }),
  processReferralBonus: vi.fn(),
}));
vi.mock('../services/rewardIssuanceService', () => ({ enqueueRewardIssuance: vi.fn() }));
vi.mock('../services/transactionService', () => ({
  recordTransaction: vi.fn(),
  getWalletHistory: vi.fn(),
  getUserHistory: vi.fn(),
  getMerchantHistory: vi.fn(),
  refundTransaction: vi.fn(),
  reconcileMerchantTransactions: vi.fn(),
  getMerchantTransactionReport: vi.fn(),
}));
vi.mock('../services/auditService', () => ({ log: vi.fn(), getLogs: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/securityAlertService', () => ({ send: vi.fn() }));
vi.mock('../services/walletService', () => ({
  getSupportedWallets: vi.fn().mockReturnValue([{ id: 'freighter', name: 'Freighter' }, { id: 'lobstr', name: 'LOBSTR' }]),
  verifyWalletConnection: vi.fn(),
  getBalances: vi.fn(),
  submitTransaction: vi.fn(),
  getTransactionHistory: vi.fn(),
  createTrustlineTransaction: vi.fn(),
  getConnectionStatus: vi.fn(),
  updateActivity: vi.fn(),
  disconnectWallet: vi.fn(),
  validateAddress: vi.fn(),
}));
vi.mock('../services/eventEmitter', () => ({ emit: vi.fn() }));
vi.mock('../services/backupService', () => ({ buildRecoveryPlan: vi.fn(), listBackups: vi.fn() }));

// ── Blockchain mocks ──────────────────────────────────────────────────────
vi.mock('../../blockchain/stellarService', () => ({
  server: {}, NOVA: {},
  isValidStellarAddress: vi.fn().mockReturnValue(true),
  getNOVABalance: vi.fn().mockResolvedValue('0'),
}));
vi.mock('../../blockchain/sendRewards', () => ({ sendRewards: vi.fn() }));
vi.mock('../../blockchain/issueAsset', () => ({}));
vi.mock('../../blockchain/trustline', () => ({ verifyTrustline: vi.fn().mockResolvedValue({ exists: true }) }));

// ── Cache/Redis mocks ─────────────────────────────────────────────────────
vi.mock('../lib/redis', () => ({
  client: { isOpen: false, get: vi.fn(), setEx: vi.fn() },
  connectRedis: vi.fn(),
}));
vi.mock('../cache/redisClient', () => ({ getRedisClient: vi.fn(() => null) }));
vi.mock('../services/circuitBreakerService', () => ({ execute: vi.fn((_name, fn) => fn()) }));

// ── Repository mocks ──────────────────────────────────────────────────────
vi.mock('../db/userRepository', () => ({
  getUserByWallet: vi.fn(), getUserById: vi.fn(), createUser: vi.fn(),
  exists: vi.fn(), update: vi.fn(), softDelete: vi.fn(),
  getPrivateProfile: vi.fn(), getPublicProfile: vi.fn(),
}));

vi.mock('../db/campaignRepository', () => {
  const actual = vi.requireActual('../db/campaignRepository');
  return {
    ...actual,
    createCampaign: vi.fn(), confirmOnChain: vi.fn(), markOnChainFailed: vi.fn(),
    getCampaignById: vi.fn(), getCampaignsByMerchant: vi.fn(),
    updateCampaign: vi.fn(), softDeleteCampaign: vi.fn(), getActiveCampaign: vi.fn(),
  };
});

vi.mock('../db/adminRepository', () => ({
  getStats: vi.fn(), listUsers: vi.fn(), createReward: vi.fn(),
  updateReward: vi.fn(), deleteReward: vi.fn(), getRewardById: vi.fn(),
}));

vi.mock('../db/pointTransactionRepository', () => ({
  getUserBalance: vi.fn().mockResolvedValue(0), getUserTotalPoints: vi.fn().mockResolvedValue(0),
  getUserReferralPoints: vi.fn().mockResolvedValue(0),
}));

vi.mock('../db/redemptionRepository', () => ({
  redeemReward: vi.fn(), getRedemptionById: vi.fn(), getUserRedemptions: vi.fn(),
}));

vi.mock('../db/transactionRepository', () => ({
  getTransactionsByUser: vi.fn().mockResolvedValue([]),
  getRewardsHistoryCursor: vi.fn().mockResolvedValue({ data: [], nextCursor: null }),
  getMerchantTotals: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    constructor() {
      this.merchant = {
        findFirst: () => Promise.resolve(null),
        create: () => Promise.resolve({}),
        update: () => Promise.resolve({}),
      };
      this.$use = () => {};
      this.$connect = () => Promise.resolve();
      this.$disconnect = () => Promise.resolve();
    }
  },
}));
vi.mock('../lib/prismaEncryptionMiddleware', () => ({ encryptionMiddleware: () => {} }));
vi.mock('../db/merchantRepository', () => ({ getMerchantByApiKeyHash: () => Promise.resolve({ id: 1, name: 'Test Merchant' }) }));
vi.mock('../db/auditLogRepository', () => ({ logAudit: vi.fn() }));

// ── Soroban mock ──────────────────────────────────────────────────────────
vi.mock('../services/sorobanService', () => ({
  registerCampaign: vi.fn(), updateCampaign: vi.fn(), pauseCampaign: vi.fn(),
}));

// ── DTO mocks ─────────────────────────────────────────────────────────────
vi.mock('../dtos/registerDto', () => ({
  validateRegisterDto: (body) => {
    const errors = [];
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.push('email is required and must be valid');
    if (!body.password || body.password.length < 8) errors.push('password must be at least 8 characters');
    if (!body.firstName || body.firstName.trim() === '') errors.push('firstName is required');
    if (!body.lastName || body.lastName.trim() === '') errors.push('lastName is required');
    const known = new Set(['email', 'password', 'firstName', 'lastName']);
    const unknown = Object.keys(body).filter(k => !known.has(k));
    if (unknown.length) errors.push(`Unknown fields: ${unknown.join(', ')}`);
    return { valid: errors.length === 0, errors };
  },
}));
vi.mock('../dtos/loginDto', () => ({
  validateLoginDto: (body) => {
    const errors = [];
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.push('email is required');
    if (!body.password) errors.push('password is required');
    const known = new Set(['email', 'password']);
    const unknown = Object.keys(body).filter(k => !known.has(k));
    if (unknown.length) errors.push(`Unknown fields: ${unknown.join(', ')}`);
    return { valid: errors.length === 0, errors };
  },
}));
vi.mock('../dtos/middleware', () => ({
  validateCreateCampaign: (req, _res, next) => next(),
  validateUpdateCampaign: (req, _res, next) => next(),
  validateCampaignId: (req, _res, next) => next(),
  validateIssueReward: (req, _res, next) => next(),
  validateDistributeReward: (req, _res, next) => next(),
  validateCreateRedemption: (req, _res, next) => next(),
  validateRedemptionId: (req, _res, next) => next(),
  validateRedemptionQuery: (req, _res, next) => next(),
}));
vi.mock('../middleware/validateDto', () => ({ validateUpdateUserDto: (req, _res, next) => next() }));

// ── Mock authenticated user/merchant state ────────────────────────────────
let mockUser = { id: 1, role: 'user', wallet_address: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' };
let mockMerchant = null;

// Use vi.mock for hoisting; factory must not reference runtime variables
vi.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, _res, next) => { req.user = globalThis.__mockUser; next(); },
  requireAdmin: (req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, error: 'forbidden', message: 'Admin access required' });
    next();
  },
  requireOwnershipOrAdmin: (req, res, next) => {
    if (req.method === 'GET') return next();
    const resourceUserId = parseInt(req.params.id);
    if (req.user?.id !== resourceUserId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'You can only access your own profile' });
    }
    next();
  },
}));

vi.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, res, next) => {
    if (globalThis.__mockMerchant) { req.merchant = globalThis.__mockMerchant; next(); }
    else { res.status(401).json({ success: false, error: 'unauthorized', message: 'x-api-key header is required' }); }
  },
}));

// Ensure runtime state syncs to globals for hoisted vi.mock closures
beforeEach(() => {
  globalThis.__mockUser = mockUser;
  globalThis.__mockMerchant = mockMerchant;
});

vi.mock('../middleware/abuseDetection', () => ({
  checkIpBlock: (req, _res, next) => next(),
  recordFailedLogin: vi.fn(),
  checkRewardFarming: (req, _res, next) => next(),
  recordRewardClaim: vi.fn(),
  unblock: vi.fn(),
}));

vi.mock('../middleware/rateLimiter', () => ({
  globalLimiter: (req, _res, next) => next(),
  authLimiter: (req, _res, next) => next(),
  slidingRewards: (req, _res, next) => next(),
}));

// ── Helper: build a lightweight app with error handler ────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());

  // Mount routes
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/users', require('../routes/users'));
  app.use('/api/campaigns', require('../routes/campaigns'));
  app.use('/api/rewards', require('../routes/rewards'));
  app.use('/api/transactions', require('../routes/transactions'));
  app.use('/api/wallet', require('../routes/wallet'));
  app.use('/api/admin', require('../routes/admin'));
  app.use('/api/redemptions', require('../routes/redemptions'));

  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || 'internal_error',
      message: err.message || 'An unexpected error occurred',
    });
  });
  return app;
}

const app = buildApp();

// ── Import mocked modules for test verification ────────────────────────────
const userRepo = require('../db/userRepository');
const campaignRepo = require('../db/campaignRepository');
const adminRepo = require('../db/adminRepository');
const redemptionRepo = require('../db/redemptionRepository');
const transactionRepo = require('../db/transactionRepository');
const merchantRepo = require('../db/merchantRepository');
const soroban = require('../services/sorobanService');
const tokenService = require('../services/tokenService');
const walletService = require('../services/walletService');
const transactionService = require('../services/transactionService');
const referralService = require('../services/referralService');
const rewardIssuanceService = require('../services/rewardIssuanceService');
const abuseDetection = require('../middleware/abuseDetection');

// ── Constants ─────────────────────────────────────────────────────────────
const VALID_STELLAR = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: 1, role: 'user', wallet_address: VALID_STELLAR };
  mockMerchant = null;
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. AUTH ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Auth Endpoints', () => {
  describe('POST /api/auth/register', () => {
    const bcrypt = require('bcryptjs');

    beforeEach(() => { bcrypt.hash = vi.fn().mockResolvedValue('hashed_pw'); });

    test('201 — creates user and returns data', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@example.com', first_name: 'Jane', last_name: 'Doe', role: 'user', created_at: new Date() }] });
      const res = await request(app).post('/api/auth/register').send({ email: 'test@example.com', password: 'Str0ngPass!', firstName: 'Jane', lastName: 'Doe' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test('400 — missing email', async () => {
      const res = await request(app).post('/api/auth/register').send({ password: 'Str0ngPass!', firstName: 'Jane', lastName: 'Doe' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    test('400 — invalid email', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'bad', password: 'Str0ngPass!', firstName: 'Jane', lastName: 'Doe' });
      expect(res.status).toBe(400);
    });

    test('400 — short password', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'test@example.com', password: 'short', firstName: 'Jane', lastName: 'Doe' });
      expect(res.status).toBe(400);
    });

    test('400 — unknown field rejected', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'test@example.com', password: 'Str0ngPass!', firstName: 'Jane', lastName: 'Doe', role: 'admin' });
      expect(res.status).toBe(400);
    });

    test('409 — duplicate email', async () => {
      mockQuery.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));
      const res = await request(app).post('/api/auth/register').send({ email: 'test@example.com', password: 'Str0ngPass!', firstName: 'Jane', lastName: 'Doe' });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('duplicate_email');
    });
  });

  describe('POST /api/auth/login', () => {
    const bcrypt = require('bcryptjs');

    test('200 — returns tokens', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@example.com', password_hash: '$2b$12$hash', first_name: 'Jane', last_name: 'Doe', role: 'user' }] });
      bcrypt.compare = vi.fn().mockResolvedValue(true);
      const res = await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'Str0ngPass!' });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    });

    test('401 — wrong password', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, password_hash: '$2b$12$hash' }] });
      bcrypt.compare = vi.fn().mockResolvedValue(false);
      const res = await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'Wrong1!' });
      expect(res.status).toBe(401);
    });

    test('401 — user not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      bcrypt.compare = vi.fn().mockResolvedValue(false);
      const res = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'pass' });
      expect(res.status).toBe(401);
    });

    test('400 — missing fields', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('200 — rotates token', async () => {
      tokenService.verifyToken.mockReturnValue({ type: 'refresh', jti: 'abc', sub: VALID_STELLAR });
      tokenService.consumeRefreshJti.mockResolvedValue(VALID_STELLAR);
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, wallet_address: VALID_STELLAR, role: 'user' }] });
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'valid.token' });
      expect(res.status).toBe(200);
    });

    test('401 — missing refresh token', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(401);
    });

    test('401 — invalid token', async () => {
      tokenService.verifyToken.mockImplementation(() => { throw new Error('invalid'); });
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'bad' });
      expect(res.status).toBe(401);
    });

    test('401 — already used refresh token', async () => {
      tokenService.verifyToken.mockReturnValue({ type: 'refresh', jti: 'abc' });
      tokenService.consumeRefreshJti.mockResolvedValue(null);
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'used' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('200 — logs out', async () => {
      const res = await request(app).post('/api/auth/logout').send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. USER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════
describe('User Endpoints', () => {
  describe('POST /api/users', () => {
    test('201 — creates user', async () => {
      userRepo.getUserByWallet.mockResolvedValue(null);
      userRepo.createUser.mockResolvedValue({ id: 1, wallet_address: VALID_STELLAR });
      const res = await request(app).post('/api/users').send({ walletAddress: VALID_STELLAR });
      expect(res.status).toBe(201);
    });

    test('400 — missing walletAddress', async () => {
      const res = await request(app).post('/api/users').send({});
      expect(res.status).toBe(400);
    });

    test('409 — duplicate wallet', async () => {
      userRepo.getUserByWallet.mockResolvedValue({ id: 99 });
      const res = await request(app).post('/api/users').send({ walletAddress: VALID_STELLAR });
      expect(res.status).toBe(409);
    });

    test('201 — with valid referral', async () => {
      userRepo.getUserByWallet.mockResolvedValueOnce({ id: 42 }).mockResolvedValueOnce(null);
      userRepo.createUser.mockResolvedValue({ id: 1 });
      const res = await request(app).post('/api/users').send({ walletAddress: VALID_STELLAR, referralCode: 'REFERRER' });
      expect(res.status).toBe(201);
      expect(userRepo.createUser).toHaveBeenCalledWith(expect.objectContaining({ referredBy: 42 }));
    });

    test('201 — ignores invalid referral', async () => {
      userRepo.getUserByWallet.mockResolvedValue(null);
      userRepo.createUser.mockResolvedValue({ id: 1 });
      const res = await request(app).post('/api/users').send({ walletAddress: VALID_STELLAR, referralCode: 'NONEXISTENT' });
      expect(res.status).toBe(201);
      expect(userRepo.createUser).toHaveBeenCalledWith(expect.objectContaining({ referredBy: null }));
    });
  });

  describe('GET /api/users/:id', () => {
    test('200 — returns own private profile', async () => {
      userRepo.exists.mockResolvedValue(true);
      userRepo.getPrivateProfile.mockResolvedValue({ id: 1, email: 'test@example.com' });
      const res = await request(app).get('/api/users/1');
      expect(res.status).toBe(200);
    });

    test('400 — invalid id', async () => {
      const res = await request(app).get('/api/users/abc');
      expect(res.status).toBe(400);
    });

    test('404 — not found', async () => {
      userRepo.exists.mockResolvedValue(false);
      const res = await request(app).get('/api/users/999');
      expect(res.status).toBe(404);
    });

    test('200 — public profile for other user', async () => {
      userRepo.exists.mockResolvedValue(true);
      userRepo.getPublicProfile.mockResolvedValue({ id: 2, first_name: 'Other' });
      const res = await request(app).get('/api/users/2');
      expect(res.status).toBe(200);
      expect(userRepo.getPublicProfile).toHaveBeenCalled();
    });

    test('200 — admin sees private profile', async () => {
      mockUser = { id: 99, role: 'admin' };
      userRepo.exists.mockResolvedValue(true);
      userRepo.getPrivateProfile.mockResolvedValue({ id: 1, email: 'private@example.com' });
      const res = await request(app).get('/api/users/1');
      expect(res.status).toBe(200);
      expect(userRepo.getPrivateProfile).toHaveBeenCalled();
    });
  });

  describe('PATCH /api/users/:id', () => {
    test('200 — updates profile', async () => {
      userRepo.exists.mockResolvedValue(true);
      userRepo.update.mockResolvedValue({ id: 1, first_name: 'Jane' });
      const res = await request(app).patch('/api/users/1').send({ firstName: 'Jane' });
      expect(res.status).toBe(200);
    });

    test('403 — cannot update another user', async () => {
      userRepo.exists.mockResolvedValue(true);
      const res = await request(app).patch('/api/users/2').send({ firstName: 'Hacker' });
      expect(res.status).toBe(403);
    });

    test('404 — not found', async () => {
      userRepo.exists.mockResolvedValue(false);
      const res = await request(app).patch('/api/users/999').send({ firstName: 'Jane' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/users/:id', () => {
    test('200 — self-delete', async () => {
      userRepo.exists.mockResolvedValue(true);
      userRepo.softDelete.mockResolvedValue();
      const res = await request(app).delete('/api/users/1');
      expect(res.status).toBe(200);
    });

    test('403 — cannot delete another', async () => {
      userRepo.exists.mockResolvedValue(true);
      const res = await request(app).delete('/api/users/2');
      expect(res.status).toBe(403);
    });

    test('404 — not found', async () => {
      userRepo.exists.mockResolvedValue(false);
      const res = await request(app).delete('/api/users/999');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/users/:id/referrals', () => {
    test('200 — returns stats', async () => {
      userRepo.getUserById.mockResolvedValue({ id: 1 });
      referralService.getUserReferralStats.mockResolvedValue({ total_referrals: 5, total_bonus_earned: 250 });
      const res = await request(app).get('/api/users/1/referrals');
      expect(res.status).toBe(200);
      expect(res.body.data.total_referrals).toBe(5);
    });

    test('400 — invalid id', async () => {
      const res = await request(app).get('/api/users/abc/referrals');
      expect(res.status).toBe(400);
    });

    test('404 — not found', async () => {
      userRepo.getUserById.mockResolvedValue(null);
      const res = await request(app).get('/api/users/999/referrals');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/users/:walletAddress/points', () => {
    test('200 — returns balance', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ balance: '1250.50' }] });
      const res = await request(app).get(`/api/users/${VALID_STELLAR}/points`);
      expect(res.status).toBe(200);
      expect(res.body.data.balance).toBe(1250.5);
    });

    test('400 — invalid wallet', async () => {
      const { isValidStellarAddress } = require('../../blockchain/stellarService');
      isValidStellarAddress.mockReturnValueOnce(false);
      const res = await request(app).get('/api/users/INVALID/points');
      expect(res.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. CAMPAIGN ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Campaign Endpoints', () => {
  const MERCHANT = { id: 1, name: 'Test Merchant' };
  const DB_CAMPAIGN = {
    id: 42, merchant_id: 1, name: 'Summer Sale', reward_rate: '5',
    start_date: '2026-06-01', end_date: '2026-08-31', is_active: true,
    on_chain_status: 'confirmed', contract_campaign_id: 'contract-abc',
  };

  beforeEach(() => { mockMerchant = MERCHANT; });

  describe('POST /api/campaigns', () => {
    test('201 — creates campaign', async () => {
      campaignRepo.createCampaign.mockResolvedValue({ ...DB_CAMPAIGN, on_chain_status: 'pending', contract_campaign_id: null });
      soroban.registerCampaign.mockResolvedValue({ txHash: 'txhash', contractCampaignId: 'contract-abc' });
      campaignRepo.confirmOnChain.mockResolvedValue(DB_CAMPAIGN);
      const res = await request(app).post('/api/campaigns').send({ name: 'Summer Sale', rewardRate: 5, startDate: '2026-06-01', endDate: '2026-08-31' });
      expect(res.status).toBe(201);
    });

    test('400 — no name', async () => {
      const res = await request(app).post('/api/campaigns').send({ rewardRate: 5, startDate: '2026-06-01', endDate: '2026-08-31' });
      expect(res.status).toBe(400);
    });

    test('502 — on-chain fails', async () => {
      campaignRepo.createCampaign.mockResolvedValue({ ...DB_CAMPAIGN, on_chain_status: 'pending' });
      soroban.registerCampaign.mockRejectedValue(new Error('RPC timeout'));
      const res = await request(app).post('/api/campaigns').send({ name: 'Sale', rewardRate: 5, startDate: '2026-06-01', endDate: '2026-08-31' });
      expect(res.status).toBe(502);
    });
  });

  describe('GET /api/campaigns', () => {
    test('200 — lists campaigns', async () => {
      campaignRepo.getCampaignsByMerchant.mockResolvedValue([DB_CAMPAIGN]);
      const res = await request(app).get('/api/campaigns');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/campaigns/:id', () => {
    test('200 — returns campaign', async () => {
      campaignRepo.getCampaignById.mockResolvedValue(DB_CAMPAIGN);
      const res = await request(app).get('/api/campaigns/42');
      expect(res.status).toBe(200);
    });

    test('404 — not found', async () => {
      campaignRepo.getCampaignById.mockResolvedValue(null);
      const res = await request(app).get('/api/campaigns/999');
      expect(res.status).toBe(404);
    });

    test('403 — other merchant', async () => {
      campaignRepo.getCampaignById.mockResolvedValue({ ...DB_CAMPAIGN, merchant_id: 99 });
      const res = await request(app).get('/api/campaigns/42');
      expect(res.status).toBe(403);
    });

    test('400 — invalid id', async () => {
      const res = await request(app).get('/api/campaigns/abc');
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/campaigns/:id', () => {
    test('200 — updates campaign', async () => {
      campaignRepo.getCampaignById.mockResolvedValue(DB_CAMPAIGN);
      soroban.updateCampaign.mockResolvedValue({ txHash: 'txhash' });
      campaignRepo.updateCampaign.mockResolvedValue({ ...DB_CAMPAIGN, name: 'Winter Sale' });
      const res = await request(app).patch('/api/campaigns/42').send({ name: 'Winter Sale' });
      expect(res.status).toBe(200);
    });

    test('400 — no fields', async () => {
      campaignRepo.getCampaignById.mockResolvedValue(DB_CAMPAIGN);
      const res = await request(app).patch('/api/campaigns/42').send({});
      expect(res.status).toBe(400);
    });

    test('409 — not on-chain', async () => {
      campaignRepo.getCampaignById.mockResolvedValue({ ...DB_CAMPAIGN, contract_campaign_id: null });
      const res = await request(app).patch('/api/campaigns/42').send({ name: 'New' });
      expect(res.status).toBe(409);
    });

    test('502 — on-chain fails', async () => {
      campaignRepo.getCampaignById.mockResolvedValue(DB_CAMPAIGN);
      soroban.updateCampaign.mockRejectedValue(new Error('error'));
      const res = await request(app).patch('/api/campaigns/42').send({ name: 'New' });
      expect(res.status).toBe(502);
    });
  });

  describe('DELETE /api/campaigns/:id', () => {
    test('200 — deletes campaign', async () => {
      campaignRepo.getCampaignById.mockResolvedValue(DB_CAMPAIGN);
      soroban.pauseCampaign.mockResolvedValue({ txHash: 'txhash' });
      campaignRepo.softDeleteCampaign.mockResolvedValue({ ...DB_CAMPAIGN, deleted_at: new Date() });
      const res = await request(app).delete('/api/campaigns/42');
      expect(res.status).toBe(200);
    });

    test('409 — not on-chain', async () => {
      campaignRepo.getCampaignById.mockResolvedValue({ ...DB_CAMPAIGN, contract_campaign_id: null });
      const res = await request(app).delete('/api/campaigns/42');
      expect(res.status).toBe(409);
    });

    test('502 — pause fails', async () => {
      campaignRepo.getCampaignById.mockResolvedValue(DB_CAMPAIGN);
      soroban.pauseCampaign.mockRejectedValue(new Error('error'));
      const res = await request(app).delete('/api/campaigns/42');
      expect(res.status).toBe(502);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. REWARD ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Reward Endpoints', () => {
  const MERCHANT = { id: 1, name: 'Test Merchant' };
  beforeEach(() => { mockMerchant = MERCHANT; });

  describe('POST /api/rewards/issue', () => {
    test('202 — enqueues issuance', async () => {
      rewardIssuanceService.enqueueRewardIssuance.mockResolvedValue({ issuanceId: 'iss-1', duplicate: false });
      const res = await request(app).post('/api/rewards/issue').send({ idempotencyKey: 'k1', walletAddress: VALID_STELLAR, amount: 50, campaignId: 1 });
      expect(res.status).toBe(202);
    });

    test('200 — duplicate', async () => {
      rewardIssuanceService.enqueueRewardIssuance.mockResolvedValue({ issuanceId: 'iss-1', duplicate: true, status: 'done' });
      const res = await request(app).post('/api/rewards/issue').send({ idempotencyKey: 'k1', walletAddress: VALID_STELLAR, amount: 50, campaignId: 1 });
      expect(res.status).toBe(200);
      expect(res.body.duplicate).toBe(true);
    });

    test('400 — missing fields', async () => {
      const res = await request(app).post('/api/rewards/issue').send({});
      expect(res.status).toBe(400);
    });

    test('400 — amount <= 0', async () => {
      const res = await request(app).post('/api/rewards/issue').send({ idempotencyKey: 'k1', walletAddress: VALID_STELLAR, amount: 0, campaignId: 1 });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/rewards/distribute', () => {
    test('200 — distributes tokens', async () => {
      campaignRepo.getCampaignById.mockResolvedValue({ id: 1, merchant_id: 1 });
      campaignRepo.getActiveCampaign.mockResolvedValue({ id: 1, merchant_id: 1 });
      const { sendRewards } = require('../../blockchain/sendRewards');
      sendRewards.mockResolvedValue({ txHash: 'txhash' });
      const res = await request(app).post('/api/rewards/distribute').send({ walletAddress: VALID_STELLAR, amount: 50, campaignId: 1 });
      expect(res.status).toBe(200);
    });

    test('400 — missing fields', async () => {
      const res = await request(app).post('/api/rewards/distribute').send({});
      expect(res.status).toBe(400);
    });

    test('400 — amount <= 0', async () => {
      const res = await request(app).post('/api/rewards/distribute').send({ walletAddress: VALID_STELLAR, amount: 0, campaignId: 1 });
      expect(res.status).toBe(400);
    });

    test('404 — campaign not found', async () => {
      campaignRepo.getCampaignById.mockResolvedValue(null);
      const res = await request(app).post('/api/rewards/distribute').send({ walletAddress: VALID_STELLAR, amount: 50, campaignId: 999 });
      expect(res.status).toBe(404);
    });

    test('400 — inactive campaign', async () => {
      campaignRepo.getCampaignById.mockResolvedValue({ id: 1, merchant_id: 1 });
      campaignRepo.getActiveCampaign.mockResolvedValue(null);
      const res = await request(app).post('/api/rewards/distribute').send({ walletAddress: VALID_STELLAR, amount: 50, campaignId: 1 });
      expect(res.status).toBe(400);
    });

    test('403 — wrong merchant', async () => {
      campaignRepo.getCampaignById.mockResolvedValue({ id: 1, merchant_id: 99 });
      campaignRepo.getActiveCampaign.mockResolvedValue({ id: 1, merchant_id: 99 });
      const res = await request(app).post('/api/rewards/distribute').send({ walletAddress: VALID_STELLAR, amount: 50, campaignId: 1 });
      expect(res.status).toBe(403);
    });

    test('400 — no trustline', async () => {
      campaignRepo.getCampaignById.mockResolvedValue({ id: 1, merchant_id: 1 });
      campaignRepo.getActiveCampaign.mockResolvedValue({ id: 1, merchant_id: 1 });
      const { verifyTrustline } = require('../../blockchain/trustline');
      verifyTrustline.mockResolvedValue({ exists: false });
      const res = await request(app).post('/api/rewards/distribute').send({ walletAddress: VALID_STELLAR, amount: 50, campaignId: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('no_trustline');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. TRANSACTION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Transaction Endpoints', () => {
  describe('GET /api/transactions/:walletAddress', () => {
    test('200 — wallet history', async () => {
      transactionService.getWalletHistory.mockResolvedValue({ data: [{ txHash: 'abc' }], source: 'database' });
      const res = await request(app).get(`/api/transactions/${VALID_STELLAR}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/transactions/user/history', () => {
    test('200 — user history', async () => {
      transactionService.getUserHistory.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
      const res = await request(app).get('/api/transactions/user/history');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/transactions/merchant-totals', () => {
    beforeEach(() => { mockMerchant = { id: 1, name: 'Test' }; });
    test('200 — merchant totals', async () => {
      transactionRepo.getMerchantTotals.mockResolvedValue({ totalDistributed: 1000 });
      const res = await request(app).get('/api/transactions/merchant-totals');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/transactions/merchant/history', () => {
    beforeEach(() => { mockMerchant = { id: 1 }; });
    test('200 — merchant history', async () => {
      transactionService.getMerchantHistory.mockResolvedValue({ data: [], total: 0 });
      const res = await request(app).get('/api/transactions/merchant/history');
      expect(res.status).toBe(200);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. WALLET ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Wallet Endpoints', () => {
  describe('GET /api/wallet/supported', () => {
    test('200 — returns wallets', async () => {
      const res = await request(app).get('/api/wallet/supported');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.wallets)).toBe(true);
    });
  });

  describe('POST /api/wallet/verify', () => {
    test('200 — verifies', async () => {
      walletService.verifyWalletConnection.mockResolvedValue({ success: true, wallet: {} });
      const res = await request(app).post('/api/wallet/verify').send({ publicKey: VALID_STELLAR });
      expect(res.status).toBe(200);
    });

    test('400 — missing publicKey', async () => {
      const res = await request(app).post('/api/wallet/verify').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/wallet/validate', () => {
    test('200 — valid', async () => {
      walletService.validateAddress.mockReturnValue(true);
      const res = await request(app).post('/api/wallet/validate').send({ address: VALID_STELLAR });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });

    test('200 — invalid', async () => {
      walletService.validateAddress.mockReturnValue(false);
      const res = await request(app).post('/api/wallet/validate').send({ address: 'bad' });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    test('400 — missing address', async () => {
      const res = await request(app).post('/api/wallet/validate').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/wallet/balances/:publicKey', () => {
    test('200 — returns balances', async () => {
      walletService.getBalances.mockResolvedValue({ success: true, balances: {} });
      const res = await request(app).get(`/api/wallet/balances/${VALID_STELLAR}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/wallet/history/:publicKey', () => {
    test('200 — returns history', async () => {
      walletService.getTransactionHistory.mockResolvedValue({ success: true, transactions: [] });
      const res = await request(app).get(`/api/wallet/history/${VALID_STELLAR}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/wallet/status/:publicKey', () => {
    test('200 — connected', async () => {
      walletService.getConnectionStatus.mockReturnValue({ connected: true });
      const res = await request(app).get(`/api/wallet/status/${VALID_STELLAR}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('connected');
    });

    test('200 — not connected', async () => {
      walletService.getConnectionStatus.mockReturnValue(null);
      const res = await request(app).get(`/api/wallet/status/${VALID_STELLAR}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('not_connected');
    });
  });

  describe('GET /api/wallet/balance (authenticated)', () => {
    test('200 — returns NOVA balance', async () => {
      mockUser = { ...mockUser, stellar_public_key: VALID_STELLAR };
      walletService.getBalances.mockResolvedValue({ success: true, balances: { tokens: { NOVA: { balance: '100.1234567' } } } });
      const res = await request(app).get('/api/wallet/balance');
      expect(res.status).toBe(200);
      expect(res.body.balance).toBe('100.1234567');
    });

    test('400 — no wallet linked', async () => {
      mockUser = { ...mockUser, stellar_public_key: null };
      const res = await request(app).get('/api/wallet/balance');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('no_wallet_linked');
    });
  });

  describe('POST /api/wallet/submit', () => {
    test('200 — submits transaction', async () => {
      walletService.submitTransaction.mockResolvedValue({ success: true, hash: 'txhash' });
      const res = await request(app).post('/api/wallet/submit').send({ signedXDR: 'AAAA...' });
      expect(res.status).toBe(200);
    });

    test('400 — missing signedXDR', async () => {
      const res = await request(app).post('/api/wallet/submit').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/wallet/trustline', () => {
    test('200 — creates trustline XDR', async () => {
      walletService.createTrustlineTransaction.mockResolvedValue({ success: true, xdr: 'AAAA...' });
      const res = await request(app).post('/api/wallet/trustline').send({ publicKey: VALID_STELLAR });
      expect(res.status).toBe(200);
    });

    test('400 — missing publicKey', async () => {
      const res = await request(app).post('/api/wallet/trustline').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/wallet/activity', () => {
    test('200 — updates activity', async () => {
      const res = await request(app).post('/api/wallet/activity').send({ publicKey: VALID_STELLAR });
      expect(res.status).toBe(200);
    });

    test('400 — missing publicKey', async () => {
      const res = await request(app).post('/api/wallet/activity').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/wallet/disconnect', () => {
    test('200 — disconnects', async () => {
      const res = await request(app).post('/api/wallet/disconnect').send({ publicKey: VALID_STELLAR });
      expect(res.status).toBe(200);
    });

    test('400 — missing publicKey', async () => {
      const res = await request(app).post('/api/wallet/disconnect').send({});
      expect(res.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Admin Endpoints', () => {
  beforeEach(() => { mockUser = { ...mockUser, role: 'admin' }; });

  describe('Access control', () => {
    test('403 — non-admin cannot access', async () => {
      mockUser = { id: 1, role: 'user' };
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/stats', () => {
    test('200 — returns stats', async () => {
      adminRepo.getStats.mockResolvedValue({ totalUsers: 100 });
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/users', () => {
    test('200 — paginated list', async () => {
      adminRepo.listUsers.mockResolvedValue({ users: [{ id: 1 }], total: 1 });
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(200);
      expect(res.body.data.users).toHaveLength(1);
    });

    test('200 — supports search', async () => {
      adminRepo.listUsers.mockResolvedValue({ users: [], total: 0 });
      const res = await request(app).get('/api/admin/users?search=alice');
      expect(res.status).toBe(200);
      expect(adminRepo.listUsers).toHaveBeenCalledWith(expect.objectContaining({ search: 'alice' }));
    });

    test('200 — supports pagination', async () => {
      adminRepo.listUsers.mockResolvedValue({ users: [], total: 0 });
      const res = await request(app).get('/api/admin/users?page=2&limit=10');
      expect(res.status).toBe(200);
      expect(adminRepo.listUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 10 }));
    });
  });

  describe('POST /api/admin/rewards', () => {
    test('201 — creates reward', async () => {
      adminRepo.createReward.mockResolvedValue({ id: 1, name: '10% Off', cost: 500 });
      const res = await request(app).post('/api/admin/rewards').send({ name: '10% Off', cost: 500 });
      expect(res.status).toBe(201);
    });

    test('400 — missing name', async () => {
      const res = await request(app).post('/api/admin/rewards').send({ cost: 500 });
      expect(res.status).toBe(400);
    });

    test('400 — missing cost', async () => {
      const res = await request(app).post('/api/admin/rewards').send({ name: 'Reward' });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/admin/rewards/:id', () => {
    test('200 — updates reward', async () => {
      adminRepo.getRewardById.mockResolvedValue({ id: 1 });
      adminRepo.updateReward.mockResolvedValue({ id: 1, name: '15% Off' });
      const res = await request(app).patch('/api/admin/rewards/1').send({ name: '15% Off' });
      expect(res.status).toBe(200);
    });

    test('404 — not found', async () => {
      adminRepo.getRewardById.mockResolvedValue(null);
      const res = await request(app).patch('/api/admin/rewards/999').send({ name: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/rewards/:id', () => {
    test('200 — deletes', async () => {
      adminRepo.getRewardById.mockResolvedValue({ id: 1 });
      adminRepo.deleteReward.mockResolvedValue(true);
      const res = await request(app).delete('/api/admin/rewards/1');
      expect(res.status).toBe(200);
    });

    test('404 — not found', async () => {
      adminRepo.getRewardById.mockResolvedValue(null);
      adminRepo.deleteReward.mockResolvedValue(false);
      const res = await request(app).delete('/api/admin/rewards/999');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/admin/metrics', () => {
    test('200 — returns metrics', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total_users: 100, active_campaigns: 5, total_campaigns: 20, total_rewards_issued: 5000, total_redemptions: 50, total_points_redeemed: 2500, active_rewards: 10 }] });
      const res = await request(app).get('/api/admin/metrics');
      expect(res.status).toBe(200);
      expect(res.body.data.total_users).toBe(100);
    });
  });

  describe('POST /api/admin/campaigns/:id/pause', () => {
    test('200 — pauses', async () => {
      campaignRepo.getCampaignById.mockResolvedValue({ id: 1 });
      campaignRepo.softDeleteCampaign.mockResolvedValue({ deleted_at: new Date() });
      const res = await request(app).post('/api/admin/campaigns/1/pause');
      expect(res.status).toBe(200);
    });

    test('404 — not found', async () => {
      campaignRepo.getCampaignById.mockResolvedValue(null);
      const res = await request(app).post('/api/admin/campaigns/999/pause');
      expect(res.status).toBe(404);
    });

    test('400 — invalid id', async () => {
      const res = await request(app).post('/api/admin/campaigns/abc/pause');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/admin/audit-logs', () => {
    test('200 — returns logs', async () => {
      const res = await request(app).get('/api/admin/audit-logs');
      expect(res.status).toBe(200);
    });

    test('200 — with filters', async () => {
      const res = await request(app).get('/api/admin/audit-logs?action=login&page=1&limit=10');
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/admin/abuse/unblock/:identifier', () => {
    test('200 — unblocks IP', async () => {
      const res = await request(app).delete('/api/admin/abuse/unblock/192.168.1.1');
      expect(res.status).toBe(200);
      expect(abuseDetection.unblock).toHaveBeenCalledWith('192.168.1.1');
    });

    test('200 — unblocks wallet', async () => {
      const res = await request(app).delete(`/api/admin/abuse/unblock/${VALID_STELLAR}`);
      expect(res.status).toBe(200);
      expect(abuseDetection.unblock).toHaveBeenCalledWith(VALID_STELLAR);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. REDEMPTION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Redemption Endpoints', () => {
  describe('POST /api/redemptions', () => {
    test('201 — creates redemption', async () => {
      redemptionRepo.redeemReward.mockResolvedValue({ redemption: { id: 1, user_id: 1, reward_id: 1, points_spent: '50' }, pointTx: { id: 1 }, idempotent: false });
      const res = await request(app).post('/api/redemptions').set('x-idempotency-key', 'key-1').send({ userId: 1, rewardId: 1 });
      expect(res.status).toBe(201);
    });

    test('200 — idempotent replay', async () => {
      redemptionRepo.redeemReward.mockResolvedValue({ redemption: { id: 1 }, pointTx: null, idempotent: true });
      const res = await request(app).post('/api/redemptions').set('x-idempotency-key', 'key-1').send({ userId: 1, rewardId: 1 });
      expect(res.status).toBe(200);
      expect(res.body.idempotent).toBe(true);
    });

    test('400 — missing idempotency key', async () => {
      const res = await request(app).post('/api/redemptions').send({ userId: 1, rewardId: 1 });
      expect(res.status).toBe(400);
    });

    test('400 — missing userId', async () => {
      const res = await request(app).post('/api/redemptions').set('x-idempotency-key', 'key-1').send({ rewardId: 1 });
      expect(res.status).toBe(400);
    });

    test('400 — missing rewardId', async () => {
      const res = await request(app).post('/api/redemptions').set('x-idempotency-key', 'key-1').send({ userId: 1 });
      expect(res.status).toBe(400);
    });

    test('403 — cannot redeem for another user', async () => {
      const res = await request(app).post('/api/redemptions').set('x-idempotency-key', 'key-1').send({ userId: 99, rewardId: 1 });
      expect(res.status).toBe(403);
    });

    test('404 — reward not found', async () => {
      redemptionRepo.redeemReward.mockRejectedValue(Object.assign(new Error('not found'), { code: 'not_found' }));
      const res = await request(app).post('/api/redemptions').set('x-idempotency-key', 'key-1').send({ userId: 1, rewardId: 999 });
      expect(res.status).toBe(404);
    });

    test('409 — out of stock', async () => {
      redemptionRepo.redeemReward.mockRejectedValue(Object.assign(new Error('out of stock'), { code: 'out_of_stock' }));
      const res = await request(app).post('/api/redemptions').set('x-idempotency-key', 'key-1').send({ userId: 1, rewardId: 1 });
      expect(res.status).toBe(409);
    });

    test('409 — insufficient points', async () => {
      redemptionRepo.redeemReward.mockRejectedValue(Object.assign(new Error('insufficient points'), { code: 'insufficient_points' }));
      const res = await request(app).post('/api/redemptions').set('x-idempotency-key', 'key-1').send({ userId: 1, rewardId: 1 });
      expect(res.status).toBe(409);
    });

    test('400 — blank idempotency key', async () => {
      const res = await request(app).post('/api/redemptions').set('x-idempotency-key', '   ').send({ userId: 1, rewardId: 1 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/redemptions', () => {
    test('200 — lists redemptions', async () => {
      redemptionRepo.getUserRedemptions.mockResolvedValue({ data: [{ id: 1 }], total: 1, page: 1, limit: 20 });
      const res = await request(app).get('/api/redemptions');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/redemptions/:id', () => {
    test('200 — returns redemption', async () => {
      redemptionRepo.getRedemptionById.mockResolvedValue({ id: 1 });
      const res = await request(app).get('/api/redemptions/1');
      expect(res.status).toBe(200);
    });

    test('400 — invalid id', async () => {
      const res = await request(app).get('/api/redemptions/abc');
      expect(res.status).toBe(400);
    });

    test('404 — not found', async () => {
      redemptionRepo.getRedemptionById.mockResolvedValue(null);
      const res = await request(app).get('/api/redemptions/999');
      expect(res.status).toBe(404);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. CROSS-CUTTING CONCERNS
// ═══════════════════════════════════════════════════════════════════════════
describe('Cross-Cutting Concerns', () => {
  test('Merchant auth: 200 with valid key', async () => {
    mockMerchant = { id: 1, name: 'Test Merchant' };
    merchantRepo.getMerchantByApiKeyHash.mockResolvedValue({ id: 1 });
    campaignRepo.getCampaignsByMerchant.mockResolvedValue([]);
    const res = await request(app).get('/api/campaigns').set('x-api-key', 'valid-key');
    expect(res.status).toBe(200);
  });

  test('Merchant auth: 401 without key', async () => {
    mockMerchant = null;
    const res = await request(app).get('/api/campaigns');
    expect(res.status).toBe(401);
  });

  test('Admin gate: 403 for non-admin user', async () => {
    mockUser = { id: 1, role: 'user' };
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(403);
  });

  test('Ownership: 403 updating other user\'s profile', async () => {
    userRepo.exists.mockResolvedValue(true);
    const res = await request(app).patch('/api/users/2').send({ firstName: 'Hacker' });
    expect(res.status).toBe(403);
  });

  test('Admin: 200 updating any user profile', async () => {
    mockUser = { id: 1, role: 'admin' };
    userRepo.exists.mockResolvedValue(true);
    userRepo.update.mockResolvedValue({ id: 2 });
    const res = await request(app).patch('/api/users/2').send({ firstName: 'AdminUpdate' });
    expect(res.status).toBe(200);
  });

  test('Response envelope: always has success field', async () => {
    mockMerchant = { id: 1 };
    campaignRepo.getCampaignsByMerchant.mockResolvedValue([]);
    const res = await request(app).get('/api/campaigns');
    expect(res.body).toHaveProperty('success');
  });

  test('Error responses: consistent structure', async () => {
    userRepo.exists.mockResolvedValue(false);
    const res = await request(app).get('/api/users/999');
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('message');
  });

  test('Edge case: negative IDs rejected', async () => {
    const res = await request(app).get('/api/users/-1');
    expect(res.status).toBe(400);
  });

  test('Edge case: zero IDs rejected', async () => {
    const res = await request(app).get('/api/users/0');
    expect(res.status).toBe(400);
  });
});
