'use strict';

/**
 * Vitest globalSetup — runs once before any test module loads.
 * Injects the minimum env vars required by configService / tokenService.
 */
export async function setup() {
  process.env.JWT_SECRET             = 'test-jwt-secret-at-least-32-chars!!';
  process.env.JWT_EXPIRES_IN         = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';

  process.env.STELLAR_NETWORK        = 'testnet';
  process.env.HORIZON_URL            = 'https://horizon-testnet.stellar.org';
  process.env.ISSUER_PUBLIC          = 'GTEST000000000000000000000000000000000000000000000000000001';
  process.env.ISSUER_SECRET          = 'STEST000000000000000000000000000000000000000000000000000001';
  process.env.DISTRIBUTION_PUBLIC    = 'GTEST000000000000000000000000000000000000000000000000000002';
  process.env.DISTRIBUTION_SECRET    = 'STEST000000000000000000000000000000000000000000000000000002';

  process.env.DATABASE_URL           = 'postgresql://test:test@localhost:5432/test_db';
  process.env.REDIS_URL              = 'redis://localhost:6379';

  process.env.NODE_ENV               = 'test';
  process.env.PORT                   = '3099';
  process.env.ALLOWED_ORIGIN         = 'http://localhost:3000';

  process.env.REFERRAL_BONUS_POINTS  = '100';
  process.env.DAILY_BONUS_POINTS     = '10';

  // Test key: 64 hex chars = 32 bytes. NOT for production use.
  process.env.FIELD_ENCRYPTION_KEY   = '0000000000000000000000000000000000000000000000000000000000000001';
}
