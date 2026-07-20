/**
 * Manual Jest mock for lib/env.js
 * Prevents environment validation from running during tests.
 */

const env = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  NEXT_PUBLIC_HORIZON_URL: process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet',
  NEXT_PUBLIC_ISSUER_PUBLIC: process.env.NEXT_PUBLIC_ISSUER_PUBLIC || 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  NEXT_PUBLIC_STAKING_ENABLED: process.env.NEXT_PUBLIC_STAKING_ENABLED || 'false',
  NEXT_PUBLIC_REFERRAL_ENABLED: process.env.NEXT_PUBLIC_REFERRAL_ENABLED || 'false',
};

module.exports = { env, validateEnv: () => env };
