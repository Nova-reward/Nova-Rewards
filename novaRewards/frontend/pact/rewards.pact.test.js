'use strict';

/**
 * Rewards consumer Pact tests
 *
 * Covers:
 *   GET /api/rewards       — with auth → 200
 *   GET /api/rewards       — without auth → 401
 *   GET /api/rewards/{id}  — valid ID → 200
 *   GET /api/rewards/{id}  — unknown ID → 404
 *
 * Requirements: 1.1, 1.2, 1.3, 1.6
 */

const axios = require('axios');
const { Matchers } = require('@pact-foundation/pact');
const { provider } = require('./setup');

const { like, string, eachLike, integer } = Matchers;

describe('Rewards API contract', () => {
  // ─── GET /api/rewards ────────────────────────────────────────────────────

  it('GET /api/rewards with auth returns 200 with rewards array', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'rewards are available' }],
        uponReceiving: 'an authenticated request for rewards list',
        withRequest: {
          method: 'GET',
          path: '/api/rewards',
          headers: {
            Authorization: like('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
          },
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: true,
            data: eachLike({
              id: integer(12),
              name: string('10% Off Voucher'),
              cost: integer(500),
              is_active: like(true),
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.get(
          `${mockServer.url}/api/rewards`,
          { headers: { Authorization: 'Bearer token' } }
        );

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(Array.isArray(res.data.data)).toBe(true);
        expect(res.data.data.length).toBeGreaterThan(0);
      });
  });

  it('GET /api/rewards without auth returns 401', async () => {
    await provider
      .addInteraction({
        states: [],
        uponReceiving: 'an unauthenticated request for rewards list',
        withRequest: {
          method: 'GET',
          path: '/api/rewards',
        },
        willRespondWith: {
          status: 401,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: false,
            error: string('unauthorized'),
          },
        },
      })
      .executeTest(async (mockServer) => {
        let res;
        try {
          await axios.get(`${mockServer.url}/api/rewards`);
        } catch (err) {
          res = err.response;
        }

        expect(res).toBeDefined();
        expect(res.status).toBe(401);
        expect(res.data.success).toBe(false);
      });
  });

  // ─── GET /api/rewards/{id} ───────────────────────────────────────────────

  it('GET /api/rewards/{id} with valid ID returns 200 with single reward', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'rewards are available' }],
        uponReceiving: 'an authenticated request for a specific reward',
        withRequest: {
          method: 'GET',
          path: '/api/rewards/12',
          headers: {
            Authorization: like('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
          },
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: true,
            data: like({
              id: 12,
              name: '10% Off Voucher',
              cost: 500,
              is_active: true,
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.get(
          `${mockServer.url}/api/rewards/12`,
          { headers: { Authorization: 'Bearer token' } }
        );

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(res.data.data.id).toBeDefined();
        expect(res.data.data.name).toBeDefined();
      });
  });

  it('GET /api/rewards/{id} with unknown ID returns 404', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'rewards are available' }],
        uponReceiving: 'an authenticated request for a non-existent reward',
        withRequest: {
          method: 'GET',
          path: '/api/rewards/9999',
          headers: {
            Authorization: like('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
          },
        },
        willRespondWith: {
          status: 404,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: false,
            error: string('not_found'),
          },
        },
      })
      .executeTest(async (mockServer) => {
        let res;
        try {
          await axios.get(
            `${mockServer.url}/api/rewards/9999`,
            { headers: { Authorization: 'Bearer token' } }
          );
        } catch (err) {
          res = err.response;
        }

        expect(res).toBeDefined();
        expect(res.status).toBe(404);
        expect(res.data.success).toBe(false);
      });
  });
});
