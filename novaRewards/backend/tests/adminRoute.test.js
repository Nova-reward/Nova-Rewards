// Unit tests for admin routes
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../services/emailService', () => ({ sendWelcome: jest.fn() }));

jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ success: false, error: 'unauthorized' });
    const parts = auth.substring(7).split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    req.user = { id: payload.userId, role: payload.role || 'user' };
    next();
  },
  requireAdmin: (req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, error: 'forbidden' });
    next();
  },
  requireOwnershipOrAdmin: (req, res, next) => next(),
}));

jest.mock('../db/adminRepository', () => ({
  getStats: jest.fn(),
  listUsers: jest.fn(),
  createReward: jest.fn(),
  updateReward: jest.fn(),
  deleteReward: jest.fn(),
  getRewardById: jest.fn(),
}));

const request = require('supertest');
const app = require('../server');
const adminRepo = require('../db/adminRepository');

function makeToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer header.${encoded}.sig`;
}

const adminToken = makeToken({ userId: 1, role: 'admin' });
const userToken = makeToken({ userId: 2, role: 'user' });

beforeEach(() => jest.clearAllMocks());

describe('GET /api/admin/stats', () => {
  test('200 - returns stats for admin', async () => {
    adminRepo.getStats.mockResolvedValue({ total_users: '10' });
    const res = await request(app).get('/api/admin/stats').set('Authorization', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.total_users).toBe('10');
  });

  test('403 - rejects non-admin', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', userToken);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/users', () => {
  test('200 - returns paginated users', async () => {
    adminRepo.listUsers.mockResolvedValue({ users: [{ id: 1 }], total: 1 });
    const res = await request(app).get('/api/admin/users').set('Authorization', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
  });
});

describe('POST /api/admin/rewards', () => {
  test('201 - creates reward', async () => {
    adminRepo.createReward.mockResolvedValue({ id: 1, name: 'Coffee', cost: '5.00' });
    const res = await request(app)
      .post('/api/admin/rewards')
      .set('Authorization', adminToken)
      .send({ name: 'Coffee', cost: 5, stock: 10 });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Coffee');
  });

  test('400 - rejects missing name', async () => {
    const res = await request(app)
      .post('/api/admin/rewards')
      .set('Authorization', adminToken)
      .send({ cost: 5 });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/admin/rewards/:id', () => {
  test('200 - updates reward', async () => {
    adminRepo.updateReward.mockResolvedValue({ id: 1, name: 'Tea' });
    const res = await request(app)
      .patch('/api/admin/rewards/1')
      .set('Authorization', adminToken)
      .send({ name: 'Tea' });
    expect(res.status).toBe(200);
  });

  test('404 - returns not found', async () => {
    adminRepo.updateReward.mockResolvedValue(null);
    const res = await request(app)
      .patch('/api/admin/rewards/999')
      .set('Authorization', adminToken)
      .send({ name: 'Tea' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/rewards/:id', () => {
  test('200 - deletes reward', async () => {
    adminRepo.deleteReward.mockResolvedValue(true);
    const res = await request(app)
      .delete('/api/admin/rewards/1')
      .set('Authorization', adminToken);
    expect(res.status).toBe(200);
  });

  test('404 - returns not found', async () => {
    adminRepo.deleteReward.mockResolvedValue(false);
    const res = await request(app)
      .delete('/api/admin/rewards/999')
      .set('Authorization', adminToken);
    expect(res.status).toBe(404);
  });
});
