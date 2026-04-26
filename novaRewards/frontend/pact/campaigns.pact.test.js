'use strict';

/**
 * Campaigns consumer Pact tests
 *
 * Covers:
 *   GET /api/campaigns                — with merchant API key → 200
 *   GET /api/campaigns                — without API key → 401
 *   GET /api/campaigns/{merchantId}   — valid ID → 200
 *   GET /api/campaigns/{merchantId}   — unknown ID → 404
 *
 * Requirements: 1.1, 1.2, 1.3, 1.6
 */

const axios = require('axios');
const { Matchers } = require('@pact-foundation/pact');
const { provider } = require('./setup');

const { like, string, eachLike, integer } = Matchers;

describe('Campaigns API contract', () => {
  // ─── GET /api/campaigns ──────────────────────────────────────────────────

  it('GET /api/campaigns with merchant API key returns 200 with campaign array', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'merchant campaigns exist' }],
        uponReceiving: 'an authenticated merchant request for campaigns',
        withRequest: {
          method: 'GET',
          path: '/api/campaigns',
          headers: {
            'x-api-key': like('test-merchant-api-key'),
          },
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: true,
            data: eachLike({
              id: integer(3),
              merchant_id: integer(7),
              name: string('Summer Loyalty Drive'),
              reward_rate: like(1.5),
              is_active: like(true),
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.get(
          `${mockServer.url}/api/campaigns`,
          { headers: { 'x-api-key': 'test-merchant-api-key' } }
        );

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(Array.isArray(res.data.data)).toBe(true);
        expect(res.data.data.length).toBeGreaterThan(0);
      });
  });

  it('GET /api/campaigns without API key returns 401', async () => {
    await provider
      .addInteraction({
        states: [],
        uponReceiving: 'a request for campaigns without an API key',
        withRequest: {
          method: 'GET',
          path: '/api/campaigns',
        },
        willRespondWith: {
          status: 401,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: false,
            error: string('missing_api_key'),
          },
        },
      })
      .executeTest(async (mockServer) => {
        let res;
        try {
          await axios.get(`${mockServer.url}/api/campaigns`);
        } catch (err) {
          res = err.response;
        }

        expect(res).toBeDefined();
        expect(res.status).toBe(401);
        expect(res.data.success).toBe(false);
      });
  });

  // ─── GET /api/campaigns/{merchantId} ────────────────────────────────────

  it('GET /api/campaigns/{merchantId} with valid ID returns 200 with campaign array', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'merchant campaigns exist' }],
        uponReceiving: 'a request for campaigns by valid merchant ID',
        withRequest: {
          method: 'GET',
          path: '/api/campaigns/7',
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: true,
            data: eachLike({
              id: integer(3),
              merchant_id: integer(7),
              name: string('Summer Loyalty Drive'),
              reward_rate: like(1.5),
              is_active: like(true),
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.get(`${mockServer.url}/api/campaigns/7`);

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(Array.isArray(res.data.data)).toBe(true);
      });
  });

  it('GET /api/campaigns/{merchantId} with unknown ID returns 404', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'no campaigns exist for merchant 9999' }],
        uponReceiving: 'a request for campaigns by unknown merchant ID',
        withRequest: {
          method: 'GET',
          path: '/api/campaigns/9999',
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
          await axios.get(`${mockServer.url}/api/campaigns/9999`);
        } catch (err) {
          res = err.response;
        }

        expect(res).toBeDefined();
        expect(res.status).toBe(404);
        expect(res.data.success).toBe(false);
      });
  });
});
