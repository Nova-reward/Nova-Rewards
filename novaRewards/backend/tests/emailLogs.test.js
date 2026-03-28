// Feature: email notification service
// Validates: Requirements #184

// Must be set before requiring server.js
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

const request = require('supertest');

// Stub validateEnv so server.js does not halt on missing env vars
jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));

// Mock the db layer
jest.mock('../db/emailLogRepository', () => ({
  getEmailLogs: jest.fn(),
  getEmailLogById: jest.fn(),
  createEmailLog: jest.fn(),
  markEmailSent: jest.fn(),
  markEmailDelivered: jest.fn(),
  markEmailFailed: jest.fn(),
}));

// Mock authenticateMerchant middleware
jest.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, res, next) => {
    req.merchant = { id: 1, name: 'Test Merchant' };
    next();
  },
}));

const app = require('../server');
const {
  getEmailLogs,
  getEmailLogById,
} = require('../db/emailLogRepository');

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// GET /api/admin/email-logs
// ---------------------------------------------------------------------------
describe('GET /api/admin/email-logs', () => {
  test('200 - returns paginated email logs', async () => {
    const mockResult = {
      data: [
        {
          id: 1,
          recipient_email: 'user@example.com',
          email_type: 'welcome',
          subject: 'Welcome to NovaRewards!',
          status: 'sent',
          created_at: '2026-03-27T10:00:00Z',
        },
        {
          id: 2,
          recipient_email: 'user2@example.com',
          email_type: 'redemption_confirmation',
          subject: 'Redemption Confirmation',
          status: 'delivered',
          created_at: '2026-03-26T10:00:00Z',
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
    };

    getEmailLogs.mockResolvedValue(mockResult);

    const res = await request(app)
      .get('/api/admin/email-logs');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  test('200 - filters by recipient email', async () => {
    const mockResult = {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    };

    getEmailLogs.mockResolvedValue(mockResult);

    const res = await request(app)
      .get('/api/admin/email-logs')
      .query({ recipientEmail: 'user@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getEmailLogs).toHaveBeenCalledWith({
      recipientEmail: 'user@example.com',
      emailType: undefined,
      status: undefined,
      page: 1,
      limit: 20,
    });
  });

  test('200 - filters by email type', async () => {
    const mockResult = {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    };

    getEmailLogs.mockResolvedValue(mockResult);

    const res = await request(app)
      .get('/api/admin/email-logs')
      .query({ type: 'welcome' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getEmailLogs).toHaveBeenCalledWith({
      recipientEmail: undefined,
      emailType: 'welcome',
      status: undefined,
      page: 1,
      limit: 20,
    });
  });

  test('200 - filters by status', async () => {
    const mockResult = {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    };

    getEmailLogs.mockResolvedValue(mockResult);

    const res = await request(app)
      .get('/api/admin/email-logs')
      .query({ status: 'failed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getEmailLogs).toHaveBeenCalledWith({
      recipientEmail: undefined,
      emailType: undefined,
      status: 'failed',
      page: 1,
      limit: 20,
    });
  });

  test('400 - rejects when page is invalid', async () => {
    const res = await request(app)
      .get('/api/admin/email-logs')
      .query({ page: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/page/i);
  });

  test('400 - rejects when limit exceeds maximum', async () => {
    const res = await request(app)
      .get('/api/admin/email-logs')
      .query({ limit: 150 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/limit/i);
  });

  test('400 - rejects when type is invalid', async () => {
    const res = await request(app)
      .get('/api/admin/email-logs')
      .query({ type: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/type/i);
  });

  test('400 - rejects when status is invalid', async () => {
    const res = await request(app)
      .get('/api/admin/email-logs')
      .query({ status: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/status/i);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/email-logs/:id
// ---------------------------------------------------------------------------
describe('GET /api/admin/email-logs/:id', () => {
  test('200 - returns a specific email log', async () => {
    const mockLog = {
      id: 1,
      recipient_email: 'user@example.com',
      email_type: 'welcome',
      subject: 'Welcome to NovaRewards!',
      status: 'sent',
      created_at: '2026-03-27T10:00:00Z',
    };

    getEmailLogById.mockResolvedValue(mockLog);

    const res = await request(app)
      .get('/api/admin/email-logs/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.email_type).toBe('welcome');
  });

  test('400 - rejects when id is invalid', async () => {
    const res = await request(app)
      .get('/api/admin/email-logs/invalid');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
  });

  test('404 - returns not found for non-existent log', async () => {
    getEmailLogById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/admin/email-logs/999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('not_found');
  });
});
