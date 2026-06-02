'use strict';

/**
 * Users consumer Pact tests
 *
 * Covers:
 *   GET /api/users/profile  — with auth → 200
 *   GET /api/users/profile  — without auth → 401
 *   GET /api/users/referral — with auth → 200
 *
 * Requirements: 1.1, 1.2, 1.3, 1.6
 */

const axios = require('axios');
const { Matchers } = require('@pact-foundation/pact');
const { provider } = require('./setup');

const { like, string, integer } = Matchers;

describe('Users API contract', () => {
  // ─── GET /api/users/profile ──────────────────────────────────────────────

  it('GET /api/users/profile with auth returns 200 with user profile', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'user profile exists' }],
        uponReceiving: 'an authenticated request for user profile',
        withRequest: {
          method: 'GET',
          path: '/api/users/profile',
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
              id: 42,
              email: 'alice@example.com',
              first_name: 'Alice',
              last_name: 'Smith',
              role: 'user',
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.get(
          `${mockServer.url}/api/users/profile`,
          { headers: { Authorization: 'Bearer token' } }
        );

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(res.data.data.id).toBeDefined();
        expect(res.data.data.email).toBeDefined();
      });
  });

  it('GET /api/users/profile without auth returns 401', async () => {
    await provider
      .addInteraction({
        states: [],
        uponReceiving: 'an unauthenticated request for user profile',
        withRequest: {
          method: 'GET',
          path: '/api/users/profile',
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
          await axios.get(`${mockServer.url}/api/users/profile`);
        } catch (err) {
          res = err.response;
        }

        expect(res).toBeDefined();
        expect(res.status).toBe(401);
        expect(res.data.success).toBe(false);
      });
  });

  // ─── GET /api/users/referral ─────────────────────────────────────────────

  it('GET /api/users/referral with auth returns 200 with referral info', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'user profile exists' }],
        uponReceiving: 'an authenticated request for user referral info',
        withRequest: {
          method: 'GET',
          path: '/api/users/referral',
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
              referral_code: 'ALICE123',
              referral_count: 5,
              referral_points_earned: 250,
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.get(
          `${mockServer.url}/api/users/referral`,
          { headers: { Authorization: 'Bearer token' } }
        );

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(res.data.data.referral_code).toBeDefined();
      });
  });
});
