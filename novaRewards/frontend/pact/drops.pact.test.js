'use strict';

/**
 * Drops consumer Pact tests
 *
 * Covers:
 *   GET  /api/drops        — authenticated → 200
 *   POST /api/drops/claim  — valid body → 200
 *   POST /api/drops/claim  — invalid/expired drop → 400
 *
 * Requirements: 1.1, 1.2, 1.3, 1.6
 */

const axios = require('axios');
const { Matchers } = require('@pact-foundation/pact');
const { provider } = require('./setup');

const { like, string, eachLike, integer } = Matchers;

describe('Drops API contract', () => {
  // ─── GET /api/drops ──────────────────────────────────────────────────────

  it('GET /api/drops with auth returns 200 with drops array', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'a drop is available' }],
        uponReceiving: 'an authenticated request for available drops',
        withRequest: {
          method: 'GET',
          path: '/api/drops',
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
              id: integer(1),
              title: string('Genesis Drop'),
              amount: like(100),
              expires_at: string('2025-12-31T23:59:59Z'),
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.get(
          `${mockServer.url}/api/drops`,
          { headers: { Authorization: 'Bearer token' } }
        );

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(Array.isArray(res.data.data)).toBe(true);
        expect(res.data.data.length).toBeGreaterThan(0);
      });
  });

  // ─── POST /api/drops/claim ───────────────────────────────────────────────

  it('POST /api/drops/claim with valid body returns 200 success', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'a drop is available' }],
        uponReceiving: 'a valid drop claim request',
        withRequest: {
          method: 'POST',
          path: '/api/drops/claim',
          headers: {
            'Content-Type': 'application/json',
            Authorization: like('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
          },
          body: {
            dropId: 1,
          },
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: true,
            data: like({
              claimed: true,
              amount: 100,
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.post(
          `${mockServer.url}/api/drops/claim`,
          { dropId: 1 },
          { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' } }
        );

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(res.data.data.claimed).toBe(true);
      });
  });

  it('POST /api/drops/claim with invalid/expired drop returns 400', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'no active drops exist' }],
        uponReceiving: 'a drop claim request for an expired drop',
        withRequest: {
          method: 'POST',
          path: '/api/drops/claim',
          headers: {
            'Content-Type': 'application/json',
            Authorization: like('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
          },
          body: {
            dropId: 9999,
          },
        },
        willRespondWith: {
          status: 400,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: false,
            error: string('drop_expired_or_invalid'),
          },
        },
      })
      .executeTest(async (mockServer) => {
        let res;
        try {
          await axios.post(
            `${mockServer.url}/api/drops/claim`,
            { dropId: 9999 },
            { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' } }
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
