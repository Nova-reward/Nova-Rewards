// Unit tests for leaderboard route
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../services/emailService', () => ({ sendWelcome: jest.fn() }));

jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, res, next) => {
    req.user = { id: 1, role: 'user' };
    next();
  },
  requireAdmin: (req, res, next) => next(),
  requireOwnershipOrAdmin: (req, res, next) => next(),
}));

jest.mock('../db/leaderboardRepository', () => ({ getLeaderboard: jest.fn() }));

jest.mock('../lib/redis', () => ({
  client: {
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
  },
  connectRedis: jest.fn(),
}));

const request = require('supertest');
const app = require('../server');
const { getLeaderboard } = require('../db/leaderboardRepository');
const { client: redis } = require('../lib/redis');

beforeEach(() => jest.clearAllMocks());

describe('GET /api/leaderboard', () => {
  test('200 - returns weekly leaderboard from DB when cache miss', async () => {
    redis.get.mockResolvedValue(null);
    redis.setEx.mockResolvedValue('OK');
    getLeaderboard.mockResolvedValue({
      rankings: [{ user_id: 1, total_points: '500', rank: '1' }],
      currentUser: null,
    });

    const res = await request(app).get('/api/leaderboard?period=weekly');
    expect(res.status).toBe(200);
    expect(res.body.data.period).toBe('weekly');
    expect(res.body.data.rankings).toHaveLength(1);
  });

  test('200 - returns cached rankings', async () => {
    const cached = [{ user_id: 1, total_points: '500', rank: '1' }];
    redis.get.mockResolvedValue(JSON.stringify(cached));
    getLeaderboard.mockResolvedValue({ rankings: [], currentUser: null });

    const res = await request(app).get('/api/leaderboard?period=alltime');
    expect(res.status).toBe(200);
    expect(res.body.data.rankings).toEqual(cached);
  });

  test('200 - includes currentUser when not in top rankings', async () => {
    redis.get.mockResolvedValue(null);
    redis.setEx.mockResolvedValue('OK');
    const currentUser = { user_id: 1, total_points: '50', rank: '10' };
    getLeaderboard
      .mockResolvedValueOnce({ rankings: [{ user_id: 2, total_points: '500', rank: '1' }], currentUser: null })
      .mockResolvedValueOnce({ rankings: [], currentUser });

    const res = await request(app).get('/api/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.data.currentUser).toEqual(currentUser);
  });

  test('200 - defaults to weekly period for invalid period', async () => {
    redis.get.mockResolvedValue(null);
    redis.setEx.mockResolvedValue('OK');
    getLeaderboard.mockResolvedValue({ rankings: [], currentUser: null });

    const res = await request(app).get('/api/leaderboard?period=invalid');
    expect(res.status).toBe(200);
    expect(res.body.data.period).toBe('weekly');
  });
});
