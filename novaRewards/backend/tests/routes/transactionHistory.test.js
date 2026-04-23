const request = require('supertest');
const app = require('../../server');

describe('Transaction History API', () => {
  const mockUserId = 'user-123';
  const mockTransactions = [
    {
      id: '1',
      userId: mockUserId,
      type: 'issuance',
      amount: '100.00',
      campaignId: 1,
      campaign: { id: 1, name: 'Summer Campaign' },
      status: 'confirmed',
      txHash: 'abc123',
      createdAt: new Date('2024-01-15'),
    },
    {
      id: '2',
      userId: mockUserId,
      type: 'redemption',
      amount: '50.00',
      campaignId: 2,
      campaign: { id: 2, name: 'Winter Campaign' },
      status: 'confirmed',
      txHash: 'def456',
      createdAt: new Date('2024-01-14'),
    },
  ];

  describe('GET /api/transactions/history', () => {
    test('returns paginated transactions with default limit', async () => {
      const response = await request(app)
        .get('/api/transactions/history')
        .query({ userId: mockUserId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.limit).toBe(20);
    });

    test('returns error when userId is missing', async () => {
      const response = await request(app).get('/api/transactions/history');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('validation_error');
    });

    test('filters transactions by type', async () => {
      const response = await request(app)
        .get('/api/transactions/history')
        .query({ userId: mockUserId, type: 'issuance' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('returns error for invalid transaction type', async () => {
      const response = await request(app)
        .get('/api/transactions/history')
        .query({ userId: mockUserId, type: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
    });

    test('respects limit parameter', async () => {
      const response = await request(app)
        .get('/api/transactions/history')
        .query({ userId: mockUserId, limit: 50 });

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(50);
    });

    test('caps limit to maximum of 100', async () => {
      const response = await request(app)
        .get('/api/transactions/history')
        .query({ userId: mockUserId, limit: 200 });

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBeLessThanOrEqual(100);
    });

    test('handles offset parameter for pagination', async () => {
      const response = await request(app)
        .get('/api/transactions/history')
        .query({ userId: mockUserId, offset: 10 });

      expect(response.status).toBe(200);
      expect(response.body.pagination.offset).toBe(10);
    });

    test('filters by date range', async () => {
      const response = await request(app)
        .get('/api/transactions/history')
        .query({
          userId: mockUserId,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-20',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('filters by campaign ID', async () => {
      const response = await request(app)
        .get('/api/transactions/history')
        .query({ userId: mockUserId, campaignId: 1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('includes hasMore flag in pagination', async () => {
      const response = await request(app)
        .get('/api/transactions/history')
        .query({ userId: mockUserId });

      expect(response.status).toBe(200);
      expect(response.body.pagination.hasMore).toBeDefined();
      expect(typeof response.body.pagination.hasMore).toBe('boolean');
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
