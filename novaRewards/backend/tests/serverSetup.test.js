'use strict';

const request = require('supertest');

// Set required environment variables before initializing dependencies
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.ISSUER_SECRET = 'SDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.DISTRIBUTION_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.DISTRIBUTION_SECRET = 'SDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'super-secret-jwt-key';
process.env.FIELD_ENCRYPTION_KEY = '01234567890123456789012345678901';
process.env.NODE_ENV = 'test';

jest.mock('../db/merchantRepository', () => ({
  getMerchantById: jest.fn(),
  getMerchantByApiKeyHash: jest.fn(),
  createMerchant: jest.fn(),
  updateMerchant: jest.fn(),
}));

jest.mock('../db/index', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  query: jest.fn().mockResolvedValue({ rows: [] }),
}));

jest.mock('../lib/redis', () => ({
  client: {
    ping: jest.fn().mockResolvedValue('PONG'),
    sendCommand: jest.fn().mockResolvedValue('OK'),
    isOpen: true,
    on: jest.fn(),
  },
  connectRedis: jest.fn().mockResolvedValue(true),
}));

jest.mock('../jobs/queues', () => ({
  serverAdapter: {
    getRouter: () => (req, res, next) => next(),
  },
}));

const app = require('../server');

describe('Express Server Setup & Middleware Integration', () => {
  describe('GET /health', () => {
    it('returns status ok with 200 OK', async () => {
      const response = await request(app).get('/health').expect(200);
      expect(response.body).toEqual({
        success: true,
        data: { status: 'ok' },
      });
    });
  });

  describe('Security Headers (Helmet)', () => {
    it('sets OWASP security headers on HTTP responses', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS Behavior', () => {
    it('allows requests and includes CORS headers in dev/test environment', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');
      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('Correlation & Tracing Headers', () => {
    it('propagates or generates x-correlation-id header', async () => {
      const customTrace = 'test-trace-id-12345';
      const response = await request(app)
        .get('/health')
        .set('x-correlation-id', customTrace);
      expect(response.headers['x-correlation-id']).toBe(customTrace);
    });
  });

  describe('404 Handler', () => {
    it('returns structured 404 JSON for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent-route-path')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Cannot GET /api/v1/non-existent-route-path',
        code: 'not_found',
        statusCode: 404,
      });
    });
  });

  describe('Centralized Error Handling', () => {
    it('handles malformed JSON request bodies with 400 Bad Request', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid_json": ')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid JSON in request body',
        code: 'invalid_json',
        statusCode: 400,
      });
    });
  });
});
