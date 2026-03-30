// Health check endpoint tests
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';

const express = require('express');
const request = require('supertest');

// Mock database
jest.mock('../db/index', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
  },
  query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
}));

// Mock Redis
jest.mock('../lib/redis', () => ({
  client: {
    ping: jest.fn().mockResolvedValue('PONG'),
    sendCommand: jest.fn().mockResolvedValue('OK'),
    isOpen: true,
    on: jest.fn(),
  },
  connectRedis: jest.fn().mockResolvedValue(true),
}));

// Mock Stellar SDK
jest.mock('stellar-sdk', () => {
  const actual = jest.requireActual('stellar-sdk');
  return {
    ...actual,
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        ledgers: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              call: jest.fn().mockResolvedValue({
                records: [{ sequence: 12345678 }],
              }),
            }),
          }),
        }),
      })),
    },
  };
});

const { pool } = require('../db');
const { client: redisClient } = require('../lib/redis');

// Build a lightweight app with just the health route
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/health', require('../routes/health'));
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || 'internal_error',
      message: err.message || 'An unexpected error occurred',
    });
  });
  return app;
}

describe('Health Check Endpoints', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks to default successful state
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    redisClient.ping.mockResolvedValue('PONG');
  });

  describe('GET /api/health', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { status: 'ok' },
      });
    });
  });

  describe('GET /api/health/detailed', () => {
    it('should return detailed health check with all components', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('checks');
      expect(response.body.data).toHaveProperty('responseTime');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('environment');
    });

    it('should include all required checks', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      const { checks } = response.body.data;
      
      expect(checks).toHaveProperty('database');
      expect(checks).toHaveProperty('cache');
      expect(checks).toHaveProperty('stellar');
      expect(checks).toHaveProperty('disk');
      expect(checks).toHaveProperty('memory');
    });

    it('should return 503 when database is down', async () => {
      pool.query.mockRejectedValueOnce(new Error('Connection refused'));

      const response = await request(app)
        .get('/api/health/detailed')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.data.status).toBe('unhealthy');
    });

    it('should return 503 when cache is down', async () => {
      redisClient.ping.mockRejectedValueOnce(new Error('Redis connection failed'));

      const response = await request(app)
        .get('/api/health/detailed')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.data.status).toBe('unhealthy');
    });
  });
});
