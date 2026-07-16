const request = require('supertest');
const app = require('../../server');

describe('Transaction History API', () => {
  const mockUserId = 'user-123';

  describe('GET /api/transactions/history', () => {
    test('returns cursor-paginated transactions', async () => {
      const response = await request(app)
        .get('/api/transactions/history')
        .query({ userId: mockUserId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      // nextCursor is either a string or null
      expect(
        response.body.nextCursor === null ||
        typeof response.body.nextCursor === 'string'
      ).toBe(true);
    });

    test('returns error when userId is missing', async () => {
      const response = await request(app).get('/api/transactions/history');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('validation_error');
    });

    test('respects limit parameter', async () => {
      const response = await request(app)
        .get('/api/transactions/history')
        .query({ userId: mockUserId, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(10);
    });

    test('caps limit to maximum of 100', async () => {
      const response = await request(app)
        .get('/api/transactions/history')
        .query({ userId: mockUserId, limit: 200 });

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(100);
    });

    test('accepts a cursor parameter without error', async () => {
      // First page
      const first = await request(app)
        .get('/api/transactions/history')
        .query({ userId: mockUserId, limit: 5 });

      expect(first.status).toBe(200);

      // If there is a next cursor, use it
      if (first.body.nextCursor) {
        const second = await request(app)
          .get('/api/transactions/history')
          .query({ userId: mockUserId, limit: 5, cursor: first.body.nextCursor });

        expect(second.status).toBe(200);
        expect(Array.isArray(second.body.data)).toBe(true);
      }
    });

    test('returns empty data array for unknown userId', async () => {
      const response = await request(app)
        .get('/api/transactions/history')
        .query({ userId: 'nonexistent-user-xyz' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.nextCursor).toBeNull();
    });
  });

  describe('GET /api/transactions/stats', () => {
    test('returns transaction statistics', async () => {
      const response = await request(app)
        .get('/api/transactions/stats')
        .query({ userId: mockUserId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalTransactions).toBeDefined();
      expect(response.body.data.totalRewardsIssued).toBeDefined();
      expect(response.body.data.breakdown).toBeDefined();
    });

    test('returns error when userId is missing', async () => {
      const response = await request(app).get('/api/transactions/stats');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('filters stats by date range', async () => {
      const response = await request(app)
        .get('/api/transactions/stats')
        .query({
          userId: mockUserId,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-20',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/transactions/export/csv', () => {
    test('exports transactions as CSV', async () => {
      const response = await request(app)
        .get('/api/transactions/export/csv')
        .query({ userId: mockUserId });

      expect(response.status).toBe(200);
      expect(response.type).toMatch('text/csv');
      expect(response.headers['content-disposition']).toMatch('attachment');
    });

    test('returns error when userId is missing', async () => {
      const response = await request(app).get('/api/transactions/export/csv');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('includes headers in CSV export', async () => {
      const response = await request(app)
        .get('/api/transactions/export/csv')
        .query({ userId: mockUserId });

      expect(response.status).toBe(200);
      expect(response.text).toMatch(/Date/);
      expect(response.text).toMatch(/Type/);
      expect(response.text).toMatch(/Amount/);
      expect(response.text).toMatch(/Campaign/);
    });

    test('filters CSV export by type', async () => {
      const response = await request(app)
        .get('/api/transactions/export/csv')
        .query({ userId: mockUserId, type: 'issuance' });

      expect(response.status).toBe(200);
      expect(response.type).toMatch('text/csv');
    });
  });
});
