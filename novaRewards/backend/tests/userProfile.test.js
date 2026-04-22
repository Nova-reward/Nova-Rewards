// Must be set before requiring server.js — stellarService reads ISSUER_PUBLIC at module load time
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

const request = require('supertest');

// Stub validateEnv so server.js does not halt on missing env vars
jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));

// Mock database queries
jest.mock('../db/index', () => ({
  query: jest.fn(),
}));

jest.mock('../db/pointTransactionRepository', () => ({
  recordPointTransaction: jest.fn(),
  getUserPointTransactions: jest.fn(),
  getUserBalance: jest.fn(),
  getUserTotalPoints: jest.fn(),
  getUserReferralPoints: jest.fn(),
}));

jest.mock('../db/redemptionRepository', () => ({
  redeemReward: jest.fn(),
  getRedemptionById: jest.fn(),
  getUserRedemptions: jest.fn(),
}));

jest.mock('../db/transactionRepository', () => ({
  recordTransaction: jest.fn(),
  getTransactionByHash: jest.fn(),
  getTransactionsByMerchant: jest.fn(),
  getMerchantTotals: jest.fn(),
  getTransactionsByUser: jest.fn(),
}));

// Mock emailService to avoid nodemailer dependency
jest.mock('../services/emailService', () => ({
  sendWelcome: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock Stellar service for token balance API
jest.mock('../../blockchain/stellarService', () => ({
  getNOVABalance: jest.fn().mockResolvedValue('1337.0000000'),
  isValidStellarAddress: jest.fn().mockReturnValue(true),
}));

// Mock authenticateUser to inject req.user based on the Authorization header
jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Bearer token is required' });
    }
    try {
      const parts = auth.substring(7).split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      req.user = { id: payload.userId, role: payload.role || 'user' };
      next();
    } catch {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Invalid token' });
    }
  },
  requireOwnershipOrAdmin: (req, res, next) => {
    // For GET requests, allow all authenticated users through — the route decides what data to return
    // For mutating requests (PATCH, DELETE), enforce ownership or admin
    if (req.method === 'GET') return next();
    const resourceUserId = parseInt(req.params.id);
    if (req.user?.id !== resourceUserId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'Forbidden' });
    }
    next();
  },
  requireAdmin: (req, res, next) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'Admin access required' });
    }
    next();
  },
}));

const app = require('../server');
const { query } = require('../db/index');
const {
  getUserBalance,
  getUserTotalPoints,
  getUserReferralPoints,
} = require('../db/pointTransactionRepository');
const { getUserRedemptions } = require('../db/redemptionRepository');
const { getTransactionsByUser } = require('../db/transactionRepository');

describe('User Profile API', () => {
  let authToken;
  let mockUser;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Default: user exists (tests that need 404 override with empty rows)
    query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

    // Mock authenticated user
    mockUser = {
      id: 1,
      wallet_address: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      first_name: 'John',
      last_name: 'Doe',
      bio: 'Test user',
      stellar_public_key: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Mock token (in production, use actual JWT)
    authToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjF9.mock';
  });

  describe('GET /api/users/:id', () => {
    it('should return public profile for non-owner', async () => {
      // Mock user exists
      query.mockResolvedValueOnce({ rows: [{ exists: true }] });
      
      // Mock getPublicProfile
      query.mockResolvedValueOnce({
        rows: [{
          id: 2,
          wallet_address: 'GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
          first_name: 'Jane',
          last_name: 'Smith',
          bio: 'Another user',
          created_at: new Date().toISOString(),
        }],
      });

      const res = await request(app)
        .get('/api/users/2')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('first_name');
      expect(res.body.data).not.toHaveProperty('stellar_public_key');
    });

    it('should return private profile for owner', async () => {
      // Mock user exists
      query.mockResolvedValueOnce({ rows: [{ exists: true }] });
      
      // Mock getPrivateProfile
      query.mockResolvedValueOnce({
        rows: [mockUser],
      });

      const res = await request(app)
        .get('/api/users/1')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('stellar_public_key');
    });

    it('should return 404 for non-existent user', async () => {
      // Mock user does not exist
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/users/999')
        .set('Authorization', authToken);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('not_found');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/users/1');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('unauthorized');
    });

    it('should return token balance for user with stellarPublicKey', async () => {
      query.mockResolvedValueOnce({ rows: [mockUser] });

      const res = await request(app)
        .get('/api/users/1/token-balance')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('tokenBalance', '1337.0000000');
      expect(res.body.data).toHaveProperty('cached', false);
    });

    it('should return 404 when no linked Stellar public key', async () => {
      query.mockResolvedValueOnce({ rows: [{ ...mockUser, stellar_public_key: null }] });

      const res = await request(app)
        .get('/api/users/1/token-balance')
        .set('Authorization', authToken);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('not_found');
    });
  });

  describe('GET /api/users', () => {
    it('should return paginated users for admin', async () => {
      authToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJhZG1pbiJ9.mock';

      query
        .mockResolvedValueOnce({
          rows: [{
            id: 2,
            wallet_address: 'GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
            email: 'jane@example.com',
            first_name: 'Jane',
            last_name: 'Smith',
            role: 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }],
        })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] });

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', authToken)
        .query({ search: 'jane', page: 1, limit: 20 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.limit).toBe(20);
    });

    it('should reject non-admin user list access', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', authToken);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('forbidden');
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('should update user profile with valid data', async () => {
      // Mock user exists
      query.mockResolvedValueOnce({ rows: [{ exists: true }] });
      
      // Mock update
      query.mockResolvedValueOnce({
        rows: [{
          ...mockUser,
          first_name: 'Updated',
          last_name: 'Name',
          updated_at: new Date().toISOString(),
        }],
      });

      const res = await request(app)
        .patch('/api/users/1')
        .set('Authorization', authToken)
        .send({ firstName: 'Updated', lastName: 'Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.first_name).toBe('Updated');
    });

    it('should reject unknown fields', async () => {
      const res = await request(app)
        .patch('/api/users/1')
        .set('Authorization', authToken)
        .send({ unknownField: 'value' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('validation_error');
    });

    it('should validate field types', async () => {
      const res = await request(app)
        .patch('/api/users/1')
        .set('Authorization', authToken)
        .send({ firstName: 123 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('validation_error');
    });

    it('should validate Stellar address format', async () => {
      const res = await request(app)
        .patch('/api/users/1')
        .set('Authorization', authToken)
        .send({ stellarPublicKey: 'invalid-address' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('validation_error');
    });

    it('should return 403 for non-owner', async () => {
      const res = await request(app)
        .patch('/api/users/2')
        .set('Authorization', authToken)
        .send({ firstName: 'Hacked' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('forbidden');
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user profile with the PUT alias', async () => {
      query.mockResolvedValueOnce({ rows: [{ exists: true }] });
      query.mockResolvedValueOnce({
        rows: [{
          ...mockUser,
          first_name: 'Updated',
          bio: 'Updated bio',
          updated_at: new Date().toISOString(),
        }],
      });

      const res = await request(app)
        .put('/api/users/1')
        .set('Authorization', authToken)
        .send({ firstName: 'Updated', bio: 'Updated bio' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.first_name).toBe('Updated');
      expect(res.body.data.bio).toBe('Updated bio');
    });
  });

  describe('GET /api/users/:id/rewards', () => {
    it('should return reward summary and redemption history for owner', async () => {
      query.mockResolvedValueOnce({ rows: [{ exists: true }] });
      getUserBalance.mockResolvedValue(450);
      getUserTotalPoints.mockResolvedValue('1200');
      getUserReferralPoints.mockResolvedValue('150');
      getUserRedemptions.mockResolvedValue({
        data: [{ id: 1, reward_name: 'Coffee Voucher', points_spent: '100' }],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/users/1/rewards')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.balance).toBe(450);
      expect(res.body.data.summary.totalPoints).toBe('1200');
      expect(res.body.data.summary.referralPoints).toBe('150');
      expect(res.body.data.rewards).toHaveLength(1);
    });

    it('should reject reward access for non-owner non-admin', async () => {
      query.mockResolvedValueOnce({ rows: [{ exists: true }] });

      const res = await request(app)
        .get('/api/users/2/rewards')
        .set('Authorization', authToken);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('forbidden');
    });
  });

  describe('GET /api/users/:id/transactions', () => {
    it('should return paginated user transactions for owner', async () => {
      query.mockResolvedValueOnce({ rows: [{ exists: true }] });
      getTransactionsByUser.mockResolvedValue({
        data: [{ id: 1, tx_type: 'distribution', amount: '75' }],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/users/1/transactions')
        .set('Authorization', authToken)
        .query({ type: 'distribution' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(getTransactionsByUser).toHaveBeenCalledWith(1, {
        type: 'distribution',
        startDate: undefined,
        endDate: undefined,
        page: 1,
        limit: 20,
      });
    });

    it('should validate transaction filter values', async () => {
      query.mockResolvedValueOnce({ rows: [{ exists: true }] });

      const res = await request(app)
        .get('/api/users/1/transactions')
        .set('Authorization', authToken)
        .query({ type: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('validation_error');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should soft-delete user and anonymize PII', async () => {
      // Mock user exists
      query.mockResolvedValueOnce({ rows: [{ exists: true }] });
      
      // Mock soft delete
      query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .delete('/api/users/1')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
    });

    it('should return 404 for non-existent user', async () => {
      // Mock user does not exist
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .delete('/api/users/999')
        .set('Authorization', authToken);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('not_found');
    });

    it('should return 403 for non-owner', async () => {
      const res = await request(app)
        .delete('/api/users/2')
        .set('Authorization', authToken);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('forbidden');
    });
  });

  describe('Admin access', () => {
    beforeEach(() => {
      // Mock admin user
      mockUser.role = 'admin';
      authToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJhZG1pbiJ9.mock';
    });

    it('should allow admin to access any user profile', async () => {
      // Mock user exists
      query.mockResolvedValueOnce({ rows: [{ exists: true }] });
      
      // Mock getPrivateProfile
      query.mockResolvedValueOnce({
        rows: [{
          id: 2,
          wallet_address: 'GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
          first_name: 'Jane',
          last_name: 'Smith',
          bio: 'Another user',
          stellar_public_key: 'GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
          role: 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
      });

      const res = await request(app)
        .get('/api/users/2')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('stellar_public_key');
    });

    it('should allow admin to update any user profile', async () => {
      // Mock user exists
      query.mockResolvedValueOnce({ rows: [{ exists: true }] });
      
      // Mock update
      query.mockResolvedValueOnce({
        rows: [{
          id: 2,
          wallet_address: 'GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
          first_name: 'Admin Updated',
          last_name: 'Name',
          bio: 'Another user',
          stellar_public_key: 'GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
          role: 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
      });

      const res = await request(app)
        .patch('/api/users/2')
        .set('Authorization', authToken)
        .send({ firstName: 'Admin Updated' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.first_name).toBe('Admin Updated');
    });

    it('should allow admin to delete any user', async () => {
      // Mock user exists
      query.mockResolvedValueOnce({ rows: [{ exists: true }] });
      
      // Mock soft delete
      query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .delete('/api/users/2')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
