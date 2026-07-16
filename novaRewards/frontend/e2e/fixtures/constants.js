/**
 * constants.js — Global E2E test configuration constants.
 */

export const TEST_CONFIG = {
  // URLs
  FRONTEND_URL: process.env.PLAYWRIGHT_FRONTEND_URL || 'http://localhost:3000',
  BACKEND_URL: process.env.PLAYWRIGHT_BACKEND_URL || 'http://localhost:3001',

  // Timeouts (milliseconds)
  BALANCE_POLL_TIMEOUT_MS: 30_000,
  BALANCE_POLL_INITIAL_DELAY_MS: 500,
  BALANCE_POLL_MAX_DELAY_MS: 4_000,

  API_REQUEST_TIMEOUT_MS: 10_000,
  PAGE_NAVIGATION_TIMEOUT_MS: 30_000,
  PAGE_ACTION_TIMEOUT_MS: 15_000,

  // Test identifiers
  RUN_SUFFIX: Date.now().toString(36),

  // Freighter mock defaults
  FREIGHTER: {
    AUTO_APPROVE: true,
    REQUEST_ACCESS_DELAY_MS: 100,
    SIGN_TRANSACTION_DELAY_MS: 500,
  },

  // API mocking
  MOCK_TRUSTLINE_DELAY_MS: 100,
  MOCK_DISTRIBUTE_DELAY_MS: 200,
  MOCK_BALANCE_INITIAL: 0,

  // Retry strategy
  RETRIES_LOCAL: 0,
  RETRIES_CI: 1,
};

export const STELLAR_NETWORK = 'testnet';
export const HORIZON_BASE_URL = 'https://horizon-testnet.stellar.org';
export const STELLAR_EXPERT_URL = 'https://stellar.expert/explorer/testnet/tx';
