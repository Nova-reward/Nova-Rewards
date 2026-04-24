'use strict';

/**
 * Leaderboard consumer Pact tests
 *
 * Covers:
 *   GET /api/leaderboard — authenticated → 200
 *   GET /api/leaderboard — unauthenticated → 401
 *
 * Requirements: 1.1, 1.2, 1.3, 1.6
 */

const axios = require('axios');
const { Matchers } = require('@pact-foundation/pact');
const { provider } = require('./setup');

const { like, string, eachLike, integer } = Matchers;

describe('Leaderboard API contract', () => {
  it('GET /api/leaderboard with auth returns 200 with leaderboard entries', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'leaderboard entries exist' }],
        uponReceiving: 'an authenticated request for the leaderboard',
        withRequest: {
          method: 'GET',
          path: '/api/leaderboard',
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
              rank: integer(1),
              user_id: integer(42),
              display_name: string('Alice S.'),
              points: like(4200),
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.get(
          `${mockServer.url}/api/leaderboard`,
          { headers: { Authorization: 'Bearer token' } }
        );

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(Array.isArray(res.data.data)).toBe(true);
        expect(res.data.data.length).toBeGreaterThan(0);
      });
  });

  it('GET /api/leaderboard without auth returns 401', async () => {
    await provider
      .addInteraction({
        states: [],
        uponReceiving: 'an unauthenticated request for the leaderboard',
        withRequest: {
          method: 'GET',
          path: '/api/leaderboard',
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
          await axios.get(`${mockServer.url}/api/leaderboard`);
        } catch (err) {
          res = err.response;
        }

        expect(res).toBeDefined();
        expect(res.status).toBe(401);
        expect(res.data.success).toBe(false);
      });
  });
});
