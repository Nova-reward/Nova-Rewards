// Feature: referral tracking logic
// Validates: Requirements #181

// Must be set before requiring server.js
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';
process.env.REFERRAL_BONUS_POINTS = '100';

const request = require('supertest');

// Stub validateEnv so server.js does not halt on missing env vars
jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));

// Mock the db layer
jest.mock('../db/userRepository', () => ({
  getUserByWallet: jest.fn(),
  getUserById: jest.fn(),
  createUser: jest.fn(),
  markReferralBonusClaimed: jest.fn(),
  getReferredUsers: jest.fn(),
  getReferralPointsEarned: jest.fn(),
  hasReferralBonusBeenClaimed: jest.fn(),
  getUnprocessedReferrals: jest.fn(),
}));

jest.mock('../db/pointTransactionRepository', () => ({
  recordPointTransaction: jest.fn(),
  getUserTotalPoints: jest.fn(),
  getUserReferralPoints: jest.fn(),
}));

jest.mock('../services/emailService', () => ({
  sendWelcome: jest.fn().mockResolvedValue({ success: true }),
}));

const app = require('../server');
const {
  getUserByWallet,
  getUserById,
  createUser,
  markReferralBonusClaimed,
  getReferredUsers,
  getReferralPointsEarned,
  hasReferralBonusBeenClaimed,
} = require('../db/userRepository');
const {
  recordPointTransaction,
  getUserTotalPoints,
  getUserReferralPoints,
} = require('../db/pointTransactionRepository');
const { processReferralBonus } = require('../services/referralService');

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// POST /api/users
// ---------------------------------------------------------------------------
describe('POST /api/users', () => {
  test('201 - creates user without referral', async () => {
    const mockUser = { id: 1, wallet_address: 'GABC123', referred_by: null };
    getUserByWallet.mockResolvedValue(null);
    createUser.mockResolvedValue(mockUser);

    const res = await request(app)
      .post('/api/users')
      .send({ walletAddress: 'GABC123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.wallet_address).toBe('GABC123');
    expect(createUser).toHaveBeenCalledWith({
      walletAddress: 'GABC123',
      referredBy: null,
    });
  });

  test('201 - creates user with referral', async () => {
    const mockReferrer = { id: 2, wallet_address: 'GREFERRER' };
    const mockUser = { id: 1, wallet_address: 'GABC123', referred_by: 2 };

    getUserByWallet.mockResolvedValueOnce(null); // Check if user exists
    getUserByWallet.mockResolvedValueOnce(mockReferrer); // Find referrer
    createUser.mockResolvedValue(mockUser);

    const res = await request(app)
      .post('/api/users')
      .send({ walletAddress: 'GABC123', referralCode: 'GREFERRER' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.referred_by).toBe(2);
    expect(createUser).toHaveBeenCalledWith({
      walletAddress: 'GABC123',
      referredBy: 2,
    });
  });

  test('400 - rejects when walletAddress is missing', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/walletAddress/i);
  });

  test('409 - rejects when user already exists', async () => {
    const mockUser = { id: 1, wallet_address: 'GABC123' };
    getUserByWallet.mockResolvedValue(mockUser);

    const res = await request(app)
      .post('/api/users')
      .send({ walletAddress: 'GABC123' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('duplicate_user');
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/:id/referrals
// ---------------------------------------------------------------------------
describe('GET /api/users/:id/referrals', () => {
  test('200 - returns referral statistics', async () => {
    const mockUser = { id: 1, wallet_address: 'GABC123' };
    const mockReferredUsers = [
      { id: 2, wallet_address: 'GUSER2', referred_at: '2026-03-27T10:00:00Z' },
      { id: 3, wallet_address: 'GUSER3', referred_at: '2026-03-26T10:00:00Z' },
    ];

    getUserById.mockResolvedValue(mockUser);
    getReferredUsers.mockResolvedValue(mockReferredUsers);
    getReferralPointsEarned.mockResolvedValue('200');

    const res = await request(app)
      .get('/api/users/1/referrals');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.referredUsers).toHaveLength(2);
    expect(res.body.data.totalPoints).toBe('200');
    expect(res.body.data.totalReferrals).toBe(2);
  });

  test('400 - rejects when id is invalid', async () => {
    const res = await request(app)
      .get('/api/users/invalid/referrals');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
  });

  test('404 - returns not found for non-existent user', async () => {
    getUserById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/users/999/referrals');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('not_found');
  });
});

// ---------------------------------------------------------------------------
// Referral bonus processing
// ---------------------------------------------------------------------------
describe('Referral bonus processing', () => {
  test('prevents self-referrals', async () => {
    const result = await processReferralBonus(1, 1);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/self-referral/i);
  });

  test('prevents duplicate bonus claims', async () => {
    hasReferralBonusBeenClaimed.mockResolvedValue(true);

    const result = await processReferralBonus(1, 2);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already been claimed/i);
  });

  test('processes valid referral bonus', async () => {
    const mockReferrer = { id: 1, wallet_address: 'GREFERRER' };
    const mockReferredUser = { id: 2, wallet_address: 'GUSER2', referred_by: 1 };
    const mockBonus = { id: 1, user_id: 1, type: 'referral', amount: '100' };

    hasReferralBonusBeenClaimed.mockResolvedValue(false);
    getUserById.mockResolvedValueOnce(mockReferrer);
    getUserById.mockResolvedValueOnce(mockReferredUser);
    recordPointTransaction.mockResolvedValue(mockBonus);
    markReferralBonusClaimed.mockResolvedValue({});

    const result = await processReferralBonus(1, 2);

    expect(result.success).toBe(true);
    expect(result.bonus).toEqual(mockBonus);
    expect(recordPointTransaction).toHaveBeenCalledWith({
      userId: 1,
      type: 'referral',
      amount: 100,
      description: expect.any(String),
      referredUserId: 2,
    });
  });

  test('rejects invalid referral relationship', async () => {
    const mockReferrer = { id: 1, wallet_address: 'GREFERRER' };
    const mockReferredUser = { id: 2, wallet_address: 'GUSER2', referred_by: 3 };

    hasReferralBonusBeenClaimed.mockResolvedValue(false);
    getUserById.mockResolvedValueOnce(mockReferrer);
    getUserById.mockResolvedValueOnce(mockReferredUser);

    const result = await processReferralBonus(1, 2);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/invalid referral relationship/i);
  });
});
