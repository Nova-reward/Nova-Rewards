const request = require('supertest');
const app = require('../server');
const { pool } = require('../db');
const { client: redisClient } = require('../lib/redis');

describe('Health Check Endpoints', () => {
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

    it('should include database check', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.data.checks).toHaveProperty('database');
      expect(response.body.data.checks.database).toHaveProperty('status');
      expect(response.body.data.checks.database).toHaveProperty('responseTime');
    });

    it('should include cache check', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.data.checks).toHaveProperty('cache');
      expect(response.body.data.checks.cache).toHaveProperty('status');
      expect(response.body.data.checks.cache).toHaveProperty('responseTime');
    });

    it('should include stellar check', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.data.checks).toHaveProperty('stellar');
      expect(response.body.data.checks.stellar).toHaveProperty('status');
      expect(response.body.data.checks.stellar).toHaveProperty('network');
    });

    it('should include memory check', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.data.checks).toHaveProperty('memory');
      expect(response.body.data.checks.memory).toHaveProperty('status');
      expect(response.body.data.checks.memory).toHaveProperty('free');
      expect(response.body.data.checks.memory).toHaveProperty('total');
      expect(response.body.data.checks.memory).toHaveProperty('percentUsed');
    });

    it('should include disk check', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.data.checks).toHaveProperty('disk');
      expect(response.body.data.checks.disk).toHaveProperty('status');
    });

    it('should return 503 when database is down', async () => {
      // Mock database failure
      jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('Connection refused'));

      const response = await request(app)
        .get('/api/health/detailed')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.data.status).toBe('unhealthy');
      expect(response.body.data.checks.database.status).toBe('unhealthy');
    });

    it('should return degraded status when response times are slow', async () => {
      // Mock slow database response
      jest.spyOn(pool, 'query').mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ rows: [{ '?column?': 1 }] }), 1500))
      );

      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.data.checks.database.status).toBe('degraded');
    });
  });
});
