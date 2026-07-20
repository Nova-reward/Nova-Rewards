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
  // Valid Stellar testnet keypairs — used only for unit tests, never hold real funds
  process.env.ISSUER_PUBLIC          = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  process.env.ISSUER_SECRET          = 'SCZANGBA5OKUQZY5JNBMY7FVTDMA6HKZF7MAYK4QUMZF6EQEQO5JKRI';
  process.env.FEE_SOURCE_SECRET      = 'SCZANGBA5OKUQZY5JNBMY7FVTDMA6HKZF7MAYK4QUMZF6EQEQO5JKRI';
  process.env.DISTRIBUTION_PUBLIC    = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
  process.env.DISTRIBUTION_SECRET    = 'SDMO45FDCUV6KBQVWIQGDMLWF6KQZAMXLPK7CVMMXJKP57FHZCCMTIH';

  process.env.DATABASE_URL           = 'postgresql://test:test@localhost:5432/test_db';
  process.env.REDIS_URL              = 'redis://localhost:6379';

  process.env.NODE_ENV               = 'test';
  process.env.PORT                   = '3099';
  process.env.ALLOWED_ORIGIN         = 'http://localhost:3000';

  process.env.REFERRAL_BONUS_POINTS  = '100';
  process.env.DAILY_BONUS_POINTS     = '10';

  // Test key: 64 hex chars = 32 bytes. NOT for production use.
  process.env.FIELD_ENCRYPTION_KEY   = '0000000000000000000000000000000000000000000000000000000000000001';

  // Idempotency HMAC secret — used by reward issuance engine (#1138). NOT for production use.
  process.env.IDEMPOTENCY_HMAC_SECRET = '0000000000000000000000000000000000000000000000000000000000000002';
}
