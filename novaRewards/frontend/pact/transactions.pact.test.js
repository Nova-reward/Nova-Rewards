'use strict';

/**
 * Transactions consumer Pact tests
 *
 * Covers:
 *   POST /api/transactions/record  — valid body → 201
 *   POST /api/transactions/record  — missing fields → 400
 *   GET  /api/transactions/merchant-totals — with auth → 200
 *   GET  /api/transactions/merchant-totals — without auth → 401
 *
 * Requirements: 1.1, 1.2, 1.3, 1.6
 */

const axios = require('axios');
const { Matchers } = require('@pact-foundation/pact');
const { provider } = require('./setup');

const { like, string, eachLike, integer } = Matchers;

describe('Transactions API contract', () => {
  // ─── POST /api/transactions/record ──────────────────────────────────────

  it('POST /api/transactions/record with valid body returns 201', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'a registered user exists' }],
        uponReceiving: 'a valid transaction record request',
        withRequest: {
          method: 'POST',
          path: '/api/transactions/record',
          headers: {
            'Content-Type': 'application/json',
            Authorization: like('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
          },
          body: {
            walletAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
            amount: 50,
            merchantId: 7,
          },
        },
        willRespondWith: {
          status: 201,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: true,
            data: like({
              id: 101,
              tx_hash: 'a1b2c3d4e5f6',
              amount: 50,
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.post(
          `${mockServer.url}/api/transactions/record`,
          { walletAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', amount: 50, merchantId: 7 },
          { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' } }
        );

        expect(res.status).toBe(201);
        expect(res.data.success).toBe(true);
        expect(res.data.data.id).toBeDefined();
      });
  });

  it('POST /api/transactions/record with missing fields returns 400', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'a registered user exists' }],
        uponReceiving: 'a transaction record request with missing fields',
        withRequest: {
          method: 'POST',
          path: '/api/transactions/record',
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
            `${mockServer.url}/api/transactions/record`,
            {},
            { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' } }
          );
        } catch (err) {
          res = err.response;
        }

        expect(res).toBeDefined();
        expect(res.status).toBe(400);
        expect(res.data.success).toBe(false);
        expect(res.data.error).toBeDefined();
      });
  });

  // ─── GET /api/transactions/merchant-totals ───────────────────────────────

  it('GET /api/transactions/merchant-totals with auth returns 200 with totals array', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'merchant transactions exist' }],
        uponReceiving: 'an authenticated request for merchant totals',
        withRequest: {
          method: 'GET',
          path: '/api/transactions/merchant-totals',
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
              merchant_id: integer(7),
              total_amount: like(1500),
              transaction_count: integer(30),
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.get(
          `${mockServer.url}/api/transactions/merchant-totals`,
          { headers: { Authorization: 'Bearer token' } }
        );

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(Array.isArray(res.data.data)).toBe(true);
        expect(res.data.data.length).toBeGreaterThan(0);
      });
  });

  it('GET /api/transactions/merchant-totals without auth returns 401', async () => {
    await provider
      .addInteraction({
        states: [],
        uponReceiving: 'an unauthenticated request for merchant totals',
        withRequest: {
          method: 'GET',
          path: '/api/transactions/merchant-totals',
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
          await axios.get(`${mockServer.url}/api/transactions/merchant-totals`);
        } catch (err) {
          res = err.response;
        }

        expect(res).toBeDefined();
        expect(res.status).toBe(401);
        expect(res.data.success).toBe(false);
      });
  });
});
