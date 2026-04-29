'use strict';

/**
 * Auth consumer Pact tests
 *
 * Covers:
 *   POST /api/auth/login  — valid credentials → 200
 *   POST /api/auth/login  — invalid credentials → 401
 *   POST /api/auth/register — valid body → 201
 *   POST /api/auth/register — duplicate email → 409
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6
 */

const axios = require('axios');
const { Matchers } = require('@pact-foundation/pact');
const { provider } = require('./setup');

const { like, string } = Matchers;

describe('Auth API contract', () => {
  // ─── POST /api/auth/login ────────────────────────────────────────────────

  it('POST /api/auth/login with valid credentials returns 200 with tokens and user', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'a registered user exists' }],
        uponReceiving: 'a valid login request',
        withRequest: {
          method: 'POST',
          path: '/api/auth/login',
          headers: { 'Content-Type': 'application/json' },
          body: {
            email: 'alice@example.com',
            password: 'S3cur3P@ss!',
          },
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: true,
            data: {
              accessToken: string('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
              refreshToken: string('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
              user: like({
                id: 1,
                email: 'alice@example.com',
                first_name: 'Alice',
                last_name: 'Smith',
                role: 'user',
              }),
            },
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.post(
          `${mockServer.url}/api/auth/login`,
          { email: 'alice@example.com', password: 'S3cur3P@ss!' },
          { headers: { 'Content-Type': 'application/json' } }
        );

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(res.data.data.accessToken).toBeDefined();
        expect(res.data.data.refreshToken).toBeDefined();
        expect(res.data.data.user).toBeDefined();
      });
  });

  it('POST /api/auth/login with invalid credentials returns 401', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'a registered user exists' }],
        uponReceiving: 'a login request with invalid credentials',
        withRequest: {
          method: 'POST',
          path: '/api/auth/login',
          headers: { 'Content-Type': 'application/json' },
          body: {
            email: 'alice@example.com',
            password: 'wrongpassword',
          },
        },
        willRespondWith: {
          status: 401,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: false,
            error: string('invalid_credentials'),
          },
        },
      })
      .executeTest(async (mockServer) => {
        let res;
        try {
          await axios.post(
            `${mockServer.url}/api/auth/login`,
            { email: 'alice@example.com', password: 'wrongpassword' },
            { headers: { 'Content-Type': 'application/json' } }
          );
        } catch (err) {
          res = err.response;
        }

        expect(res).toBeDefined();
        expect(res.status).toBe(401);
        expect(res.data.success).toBe(false);
        expect(res.data.error).toBeDefined();
      });
  });

  // ─── POST /api/auth/register ─────────────────────────────────────────────

  it('POST /api/auth/register with valid body returns 201 with user data', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'no existing user with this email' }],
        uponReceiving: 'a valid registration request',
        withRequest: {
          method: 'POST',
          path: '/api/auth/register',
          headers: { 'Content-Type': 'application/json' },
          body: {
            email: 'bob@example.com',
            password: 'S3cur3P@ss!',
            firstName: 'Bob',
            lastName: 'Jones',
          },
        },
        willRespondWith: {
          status: 201,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: true,
            data: like({
              id: 2,
              email: 'bob@example.com',
            }),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await axios.post(
          `${mockServer.url}/api/auth/register`,
          {
            email: 'bob@example.com',
            password: 'S3cur3P@ss!',
            firstName: 'Bob',
            lastName: 'Jones',
          },
          { headers: { 'Content-Type': 'application/json' } }
        );

        expect(res.status).toBe(201);
        expect(res.data.success).toBe(true);
        expect(res.data.data.id).toBeDefined();
        expect(res.data.data.email).toBeDefined();
      });
  });

  it('POST /api/auth/register with duplicate email returns 409', async () => {
    await provider
      .addInteraction({
        states: [{ description: 'a registered user exists' }],
        uponReceiving: 'a registration request with a duplicate email',
        withRequest: {
          method: 'POST',
          path: '/api/auth/register',
          headers: { 'Content-Type': 'application/json' },
          body: {
            email: 'alice@example.com',
            password: 'S3cur3P@ss!',
            firstName: 'Alice',
            lastName: 'Smith',
          },
        },
        willRespondWith: {
          status: 409,
          headers: { 'Content-Type': like('application/json') },
          body: {
            success: false,
            error: string('email_already_registered'),
          },
        },
      })
      .executeTest(async (mockServer) => {
        let res;
        try {
          await axios.post(
            `${mockServer.url}/api/auth/register`,
            {
              email: 'alice@example.com',
              password: 'S3cur3P@ss!',
              firstName: 'Alice',
              lastName: 'Smith',
            },
            { headers: { 'Content-Type': 'application/json' } }
          );
        } catch (err) {
          res = err.response;
        }

        expect(res).toBeDefined();
        expect(res.status).toBe(409);
        expect(res.data.success).toBe(false);
        expect(res.data.error).toBeDefined();
      });
  });
});
