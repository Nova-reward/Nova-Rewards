const request = require('supertest');
const app = require('../server');
const { query } = require('../db/index');

// Mock database queries
jest.mock('../db/index', () => ({
  query: jest.fn(),
}));

describe('User Profile API', () => {
  let authToken;
  let mockUser;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

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
