'use strict';

/**
 * Admin consumer Pact tests
 *
 * Covers:
 *   GET  /api/admin/stats    — with admin auth → 200
 *   GET  /api/admin/stats    — without auth → 401
 *   GET  /api/admin/stats    — with non-admin auth → 403
 *   GET  /api/admin/users    — with admin auth → 200 paginated list
 *   POST /api/admin/rewards  — valid body → 201
 *   POST /api/admin/rewards  — missing required fields → 400
 *
 * Requirements: 1.1, 1.2, 1.3, 1.6
 */

const axios = require('axios');
const { Matchers } = require('@pact-foundation/pact');
const { provider } = require('./setup');

const { like, string, eachLike, integer } = Matchers;

describe('Admin API contract', () => {
  // ─── GET /api/admin/stats ────────────────────────────────────────────────

  it('GET /api/admin/stats with admin auth returns 200 with platform stats', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'admin user is authenticated' }],
        uponReceiving: 'an admin request for platform stats',
        withRequest: {
          method: 'GET',
          path: '/api/admin/stats',
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
              total_users: 1500,
              total_points_issued: 750000,
              total_redemptions: 320,
              active_rewards: 18,
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.get(
          `${mockServer.url}/api/admin/stats`,
          { headers: { Authorization: 'Bearer admin-token' } }
        );

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(res.data.data.total_users).toBeDefined();
        expect(res.data.data.total_points_issued).toBeDefined();
      });
  });

  it('GET /api/admin/stats without auth returns 401', async () => {
    await provider
      .addInteraction({
        states: [],
        uponReceiving: 'an unauthenticated request for admin stats',
        withRequest: {
          method: 'GET',
          path: '/api/admin/stats',
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
          await axios.get(`${mockServer.url}/api/admin/stats`);
        } catch (err) {
          res = err.response;
        }

        expect(res).toBeDefined();
        expect(res.status).toBe(401);
        expect(res.data.success).toBe(false);
      });
  });

  it('GET /api/admin/stats with non-admin auth returns 403', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'a registered user exists' }],
        uponReceiving: 'a non-admin request for admin stats',
        withRequest: {
          method: 'GET',
          path: '/api/admin/stats',
          headers: {
            Authorization: like('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
          },
        },
        willRespondWith: {
          status: 403,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: false,
            error: string('forbidden'),
          },
        },
      })
      .executeTest(async (mockServer) => {
        let res;
        try {
          await axios.get(
            `${mockServer.url}/api/admin/stats`,
            { headers: { Authorization: 'Bearer user-token' } }
          );
        } catch (err) {
          res = err.response;
        }

        expect(res).toBeDefined();
        expect(res.status).toBe(403);
        expect(res.data.success).toBe(false);
      });
  });

  // ─── GET /api/admin/users ────────────────────────────────────────────────

  it('GET /api/admin/users with admin auth returns 200 with paginated user list', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'admin user is authenticated' }],
        uponReceiving: 'an admin request for paginated user list',
        withRequest: {
          method: 'GET',
          path: '/api/admin/users',
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
              users: eachLike({
                id: integer(42),
                email: string('alice@example.com'),
                role: string('user'),
              }),
              total: integer(1500),
              page: integer(1),
              limit: integer(20),
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.get(
          `${mockServer.url}/api/admin/users`,
          { headers: { Authorization: 'Bearer admin-token' } }
        );

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(res.data.data.users).toBeDefined();
        expect(res.data.data.total).toBeDefined();
      });
  });

  // ─── POST /api/admin/rewards ─────────────────────────────────────────────

  it('POST /api/admin/rewards with valid body returns 201 with created reward', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'admin user is authenticated' }],
        uponReceiving: 'an admin request to create a reward',
        withRequest: {
          method: 'POST',
          path: '/api/admin/rewards',
          headers: {
            'Content-Type': 'application/json',
            Authorization: like('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
          },
          body: {
            name: '10% Off Voucher',
            cost: 500,
            stock: 100,
            isActive: true,
          },
        },
        willRespondWith: {
          status: 201,
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
        const res = await axios.post(
          `${mockServer.url}/api/admin/rewards`,
          { name: '10% Off Voucher', cost: 500, stock: 100, isActive: true },
          { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' } }
        );

        expect(res.status).toBe(201);
        expect(res.data.success).toBe(true);
        expect(res.data.data.id).toBeDefined();
        expect(res.data.data.name).toBeDefined();
      });
  });

  it('POST /api/admin/rewards with missing required fields returns 400', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'admin user is authenticated' }],
        uponReceiving: 'an admin request to create a reward with missing fields',
        withRequest: {
          method: 'POST',
          path: '/api/admin/rewards',
          headers: {
            'Content-Type': 'application/json',
            Authorization: like('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
          },
          body: {},
        },
        willRespondWith: {
          status: 400,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: false,
            error: string('validation_error'),
          },
        },
      })
      .executeTest(async (mockServer) => {
        let res;
        try {
          await axios.post(
            `${mockServer.url}/api/admin/rewards`,
            {},
            { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' } }
          );
        } catch (err) {
          res = err.response;
        }

        expect(res).toBeDefined();
        expect(res.status).toBe(400);
        expect(res.data.success).toBe(false);
      });
  });
});
