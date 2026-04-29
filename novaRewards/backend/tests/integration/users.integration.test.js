'use strict';

/**
 * Integration tests: /api/users
 *
 * Covers:
 *  - GET  /api/users/:id          (own profile, admin access, 401/403/404)
 *  - PATCH /api/users/:id         (update own profile, admin update, 403)
 *  - DELETE /api/users/:id        (self-delete, admin delete, 403)
 *  - GET  /api/users/:id/balance  (point balance)
 */

jest.mock('../../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../../../blockchain/stellarService', () => ({
  isValidStellarAddress: jest.fn().mockReturnValue(true),
  getNOVABalance: jest.fn().mockResolvedValue('100'),
}));
jest.mock('../../../blockchain/sendRewards', () => ({ distributeRewards: jest.fn() }));
jest.mock('../../../blockchain/trustline', () => ({ verifyTrustline: jest.fn().mockResolvedValue({ exists: true }) }));
jest.mock('../../services/emailService', () => ({ sendWelcome: jest.fn().mockResolvedValue(true) }));
jest.mock('../../services/sorobanService', () => ({
  registerCampaign: jest.fn(),
  updateCampaign: jest.fn(),
  pauseCampaign: jest.fn(),
}));
jest.mock('../../routes/rewards', () => require('express').Router());
jest.mock('../../routes/transactions', () => require('express').Router());
jest.mock('../../lib/redis', () => ({
  client: { isOpen: false, on: jest.fn() },
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const app = require('../../server');
const { resetDb, seedDb, closePool, getPool } = require('./helpers/db');
const { bearerFor, expiredToken } = require('./helpers/auth');

let user;
let admin;

beforeAll(async () => {
  await resetDb();
  ({ user, admin } = await seedDb());
});

afterAll(async () => {
  await closePool();
});

// ── GET /api/users/:id ────────────────────────────────────────────────────

describe('GET /api/users/:id', () => {
  it('200 — user can read own profile (private fields)', async () => {
    const res = await request(app)
      .get(`/api/users/${user.id}`)
      .set('Authorization', bearerFor(user));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.email).toBe(user.email);
  });

  it('200 — admin can read any user profile', async () => {
    const res = await request(app)
      .get(`/api/users/${user.id}`)
      .set('Authorization', bearerFor(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app).get(`/api/users/${user.id}`);
    expect(res.status).toBe(401);
  });

  it('401 — expired JWT', async () => {
    const res = await request(app)
      .get(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${expiredToken(user)}`);

    expect(res.status).toBe(401);
  });

  it('404 — non-existent user', async () => {
    const res = await request(app)
      .get('/api/users/999999')
      .set('Authorization', bearerFor(admin));

    expect(res.status).toBe(404);
  });

  it('400 — invalid id', async () => {
    const res = await request(app)
      .get('/api/users/abc')
      .set('Authorization', bearerFor(user));

    expect(res.status).toBe(400);
  });
});

// ── PATCH /api/users/:id ──────────────────────────────────────────────────

describe('PATCH /api/users/:id', () => {
  it('200 — user can update own profile', async () => {
    const res = await request(app)
      .patch(`/api/users/${user.id}`)
      .set('Authorization', bearerFor(user))
      .send({ firstName: 'Updated', lastName: 'Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.first_name).toBe('Updated');
  });

  it('200 — admin can update any user profile', async () => {
    const res = await request(app)
      .patch(`/api/users/${user.id}`)
      .set('Authorization', bearerFor(admin))
      .send({ bio: 'Admin-set bio' });

    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBe('Admin-set bio');
  });

  it('403 — user cannot update another user\'s profile', async () => {
    const res = await request(app)
      .patch(`/api/users/${admin.id}`)
      .set('Authorization', bearerFor(user))
      .send({ firstName: 'Hijack' });

    expect(res.status).toBe(403);
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app)
      .patch(`/api/users/${user.id}`)
      .send({ firstName: 'X' });

    expect(res.status).toBe(401);
  });

  it('404 — non-existent user', async () => {
    const res = await request(app)
      .patch('/api/users/999999')
      .set('Authorization', bearerFor(admin))
      .send({ firstName: 'X' });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/users/:id ─────────────────────────────────────────────────

describe('DELETE /api/users/:id', () => {
  let deleteTarget;

  beforeAll(async () => {
    // Create a dedicated user to delete so we don't break other tests
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('TempPass1!', 4);
    const db = getPool();
    const res = await db.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES ('delete-me@example.com', $1, 'Delete', 'Me', 'user')
      RETURNING *
    `, [hash]);
    deleteTarget = res.rows[0];
  });

  it('403 — user cannot delete another user', async () => {
    const res = await request(app)
      .delete(`/api/users/${admin.id}`)
      .set('Authorization', bearerFor(user));

    expect(res.status).toBe(403);
  });

  it('200 — user can delete own account', async () => {
    const res = await request(app)
      .delete(`/api/users/${deleteTarget.id}`)
      .set('Authorization', bearerFor(deleteTarget));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('404 — non-existent user', async () => {
    const res = await request(app)
      .delete('/api/users/999999')
      .set('Authorization', bearerFor(admin));

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app).delete(`/api/users/${user.id}`);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/users/:id/token-balance ─────────────────────────────────────

describe('GET /api/users/:id/token-balance', () => {
  it('200 — returns on-chain token balance for user with stellar key', async () => {
    // Give user a stellar public key
    const db = getPool();
    await db.query(
      `UPDATE users SET stellar_public_key = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' WHERE id = $1`,
      [user.id]
    );

    const res = await request(app)
      .get(`/api/users/${user.id}/token-balance`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokenBalance).toBeDefined();
  });

  it('404 — user not found', async () => {
    const res = await request(app).get('/api/users/999999/token-balance');
    expect(res.status).toBe(404);
  });

  it('400 — invalid id', async () => {
    const res = await request(app).get('/api/users/abc/token-balance');
    expect(res.status).toBe(400);
  });
});
