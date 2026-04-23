/* eslint-disable no-console */
/**
 * Performance: API Response Time Baselines
 * Measures p95 latencies across 100 requests per endpoint
 * Run with: npm test -- tests/performance/api-timings.test.js
 * Requires seeded test DB
 */

const request = require('supertest');
const app = require('../../server');
const { performance } = require('perf_hooks');

// Thresholds (ms): p95 latencies
const THRESHOLDS = {
  '/api/users/1/points': 50,      // Simple balance lookup
  '/api/campaigns/1': 100,       // Single campaign
  '/api/redemptions': 150,       // Complex atomic tx (worst case)
};

describe('API Response Time Baselines (p95)', () => {
  Object.entries(THRESHOLDS).forEach(([endpoint, threshold]) => {
    test(`p95(${endpoint}) < ${threshold}ms`, async () => {
      const times = [];
      
      // Warmup
      await request(app).get('/health').expect(200);
      
      // 100 timed requests
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        await request(app)
          .get(endpoint.replace('/1', `/${i+1}`)) // vary IDs
          .expect(200)
          .then(() => {
            times.push(performance.now() - start);
          });
      }
      
      // Sort & p95 (95th percentile)
      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(times.length * 0.95)];
      
      console.log(`p95(${endpoint}): ${p95.toFixed(1)}ms (threshold: ${threshold}ms)`);
      
      expect(p95).toBeLessThan(threshold);
    }, 30000); // 30s timeout
  });
});

