'use strict';

/**
 * Jest globalSetup — runs once in the main process before any test module loads.
 *
 * Injects the minimum set of environment variables required by:
 *   - configService.js  (getRequiredConfig throws if vars are missing)
 *   - tokenService.js   (JWT_SECRET)
 *   - validateEnv.js    (called by server.js — not used in tests directly,
 *                        but some test files require routes that transitively
 *                        load configService)
 *
 * Using globalSetup (rather than jest.setup.js) guarantees these vars are
 * present before any module-level code executes, including the top-level
 * getConfig() / getRequiredConfig() calls in configService.js.
 *
 * All values are clearly fake — they will never reach a real service.
 */
module.exports = async function globalSetup() {
  // ── JWT ──────────────────────────────────────────────────────────────────
  process.env.JWT_SECRET           = 'test-jwt-secret-at-least-32-chars!!';
  process.env.JWT_EXPIRES_IN       = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';

  // ── Stellar (required by configService getRequiredConfig calls) ──────────
  process.env.STELLAR_NETWORK      = 'testnet';
  process.env.HORIZON_URL          = 'https://horizon-testnet.stellar.org';
  process.env.ISSUER_PUBLIC        = 'GTEST000000000000000000000000000000000000000000000000000001';
  process.env.ISSUER_SECRET        = 'STEST000000000000000000000000000000000000000000000000000001';
  process.env.DISTRIBUTION_PUBLIC  = 'GTEST000000000000000000000000000000000000000000000000000002';
  process.env.DISTRIBUTION_SECRET  = 'STEST000000000000000000000000000000000000000000000000000002';

  // ── Database / Redis (connections are mocked in tests) ───────────────────
  process.env.DATABASE_URL         = 'postgresql://test:test@localhost:5432/test_db';
  process.env.REDIS_URL            = 'redis://localhost:6379';

  // ── App ──────────────────────────────────────────────────────────────────
  process.env.NODE_ENV             = 'test';
  process.env.PORT                 = '3099';
  process.env.ALLOWED_ORIGIN       = 'http://localhost:3000';

  // ── Optional / feature flags ─────────────────────────────────────────────
  process.env.REFERRAL_BONUS_POINTS = '100';
  process.env.DAILY_BONUS_POINTS    = '10';

  // ── Field-level encryption (#651) ────────────────────────────────────────
  // Test key: 64 hex chars = 32 bytes. NOT for production use.
  process.env.FIELD_ENCRYPTION_KEY  = '0000000000000000000000000000000000000000000000000000000000000001';
};
