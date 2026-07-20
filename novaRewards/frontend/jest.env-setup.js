/**
 * Jest pre-setup: sets required environment variables before any module loads.
 * This runs before next.config.js and lib/env.js are imported, preventing
 * the "Invalid environment configuration" error during tests.
 */

process.env.NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

process.env.NEXT_PUBLIC_HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';

process.env.NEXT_PUBLIC_STELLAR_NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';

process.env.NEXT_PUBLIC_ISSUER_PUBLIC =
  process.env.NEXT_PUBLIC_ISSUER_PUBLIC ||
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

process.env.NEXT_PUBLIC_STAKING_ENABLED =
  process.env.NEXT_PUBLIC_STAKING_ENABLED || 'false';

process.env.NEXT_PUBLIC_REFERRAL_ENABLED =
  process.env.NEXT_PUBLIC_REFERRAL_ENABLED || 'false';
