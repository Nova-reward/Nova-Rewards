# E2E Suite Design - Part 1: Test Fixtures

## Test Data Fixtures

### 1. Merchant Fixtures (`frontend/e2e/fixtures/merchants.js`)

```javascript
/**
 * Test merchant data generators.
 * Each fixture produces unique, deterministic data per test run.
 */

const RUN_ID = Date.now().toString(36); // e.g., "2pxk9l"

export const MERCHANTS = {
  // Valid merchant (happy path)
  valid: () => ({
    name: `E2E Merchant ${RUN_ID}`,
    walletAddress: 'GCKFBEIYTKP5RCTLBMTPHBGO7NUWI6SNAJH5OVHQZAQHNOMZQR3ATYP',
    businessCategory: 'E2E Testing',
  }),

  // Merchant for campaign tests
  forCampaigns: () => ({
    name: `Campaign Merchant ${RUN_ID}`,
    walletAddress: 'GBZXN7PIRZGNMHGA7MUSC7SHJFPAY2MMNVFQ4YGPHDGNDUNVCM65LLE',
    businessCategory: 'Campaign Testing',
  }),

  // Merchant for error path tests
  forErrors: () => ({
    name: `Error Merchant ${RUN_ID}`,
    walletAddress: 'GB7EQYJRJC3X6JDQZFWYJS2JLNKBWLW42XS47FWX6X7KXXASJFX3BGVX',
    businessCategory: 'Error Testing',
  }),

  // Missing required field (for validation tests)
  invalidNoName: () => ({
    walletAddress: 'GCKFBEIYTKP5RCTLBMTPHBGO7NUWI6SNAJH5OVHQZAQHNOMZQR3ATYP',
    businessCategory: 'Testing',
  }),

  // Invalid Stellar address
  invalidAddress: () => ({
    name: `Invalid Address Merchant ${RUN_ID}`,
    walletAddress: 'INVALID_ADDRESS_12345',
    businessCategory: 'Testing',
  }),
};

/**
 * Predefined valid Stellar public keys (from Stellar testnet).
 * These are just valid Ed25519 keys used for testing—no private keys needed.
 */
export const STELLAR_WALLETS = {
  merchant: 'GCKFBEIYTKP5RCTLBMTPHBGO7NUWI6SNAJH5OVHQZAQHNOMZQR3ATYP',
  customer1: 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K',
  customer2: 'GBYH7EWH63C7RVGVNFGXPXJCCCTUWVPCZZWJSYPSBFWKDJWZFTC5XSBM',
  customer3: 'GAWVKFXVNUMKL3YXHM2KKDQVMIWVT5LTSALP3XYQMZ7KQSGDLZ4VBZD',
};
```

### 2. Campaign Fixtures (`frontend/e2e/fixtures/campaigns.js`)

```javascript
/**
 * Test campaign data generators.
 */

const RUN_ID = Date.now().toString(36);

// Helper: format date as YYYY-MM-DD (ISO string for <input type="date">)
const formatDate = (d) => d.toISOString().slice(0, 10);

export const CAMPAIGNS = {
  // Valid campaign (active, 30-day duration from today)
  valid: () => {
    const today = new Date();
    const inThirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      name: `E2E Campaign ${RUN_ID}`,
      rewardRate: '1.5', // 1.5 NOVA per unit
      startDate: formatDate(today),
      endDate: formatDate(inThirtyDays),
    };
  },

  // Campaign with higher reward rate
  highRewardRate: () => {
    const today = new Date();
    const inThirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      name: `High Reward Campaign ${RUN_ID}`,
      rewardRate: '5.0',
      startDate: formatDate(today),
      endDate: formatDate(inThirtyDays),
    };
  },

  // Campaign that expired yesterday (for testing blocked distribution)
  expired: () => {
    const yesterday = new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(yesterday.getTime() - 1 * 24 * 60 * 60 * 1000);
    return {
      name: `Expired Campaign ${RUN_ID}`,
      rewardRate: '1.0',
      startDate: formatDate(twoDaysAgo),
      endDate: formatDate(yesterday),
    };
  },

  // Invalid: end_date before start_date
  invalidDateOrder: () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);
    return {
      name: `Invalid Dates Campaign ${RUN_ID}`,
      rewardRate: '1.0',
      startDate: formatDate(today),
      endDate: formatDate(yesterday), // BEFORE start_date
    };
  },

  // Invalid: negative reward rate
  negativeRewardRate: () => {
    const today = new Date();
    const inThirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      name: `Negative Rate Campaign ${RUN_ID}`,
      rewardRate: '-5.0',
      startDate: formatDate(today),
      endDate: formatDate(inThirtyDays),
    };
  },

  // Invalid: zero reward rate
  zeroRewardRate: () => {
    const today = new Date();
    const inThirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      name: `Zero Rate Campaign ${RUN_ID}`,
      rewardRate: '0',
      startDate: formatDate(today),
      endDate: formatDate(inThirtyDays),
    };
  },
};
```

### 3. Reward Distribution Fixtures (`frontend/e2e/fixtures/rewards.js`)

```javascript
/**
 * Test reward distribution data.
 */

import { STELLAR_WALLETS } from './merchants.js';

export const REWARDS = {
  // Standard reward distribution
  standard: () => ({
    walletAddress: STELLAR_WALLETS.customer1,
    amount: '10.0000000',
    description: 'Standard 10 NOVA reward',
  }),

  // Bulk reward
  bulk: () => ({
    walletAddress: STELLAR_WALLETS.customer1,
    amount: '100.0000000',
    description: 'Bulk 100 NOVA reward',
  }),

  // Minimal reward (tests floating-point precision)
  minimal: () => ({
    walletAddress: STELLAR_WALLETS.customer2,
    amount: '0.0000001',
    description: 'Minimal 0.0000001 NOVA reward',
  }),

  // Invalid: negative amount
  negativeAmount: () => ({
    walletAddress: STELLAR_WALLETS.customer1,
    amount: '-10.0',
    description: 'Negative amount (invalid)',
  }),

  // Invalid: zero amount
  zeroAmount: () => ({
    walletAddress: STELLAR_WALLETS.customer1,
    amount: '0',
    description: 'Zero amount (invalid)',
  }),

  // Invalid: non-existent wallet
  invalidWallet: () => ({
    walletAddress: 'INVALID_WALLET_ADDRESS_123',
    amount: '10.0',
    description: 'Invalid wallet address',
  }),

  // Valid wallet but no trustline (will be mocked as error)
  noTrustline: () => ({
    walletAddress: STELLAR_WALLETS.customer3,
    amount: '10.0',
    description: 'Customer with no NOVA trustline',
  }),
};
```

### 4. User Fixtures (`frontend/e2e/fixtures/users.js`)

```javascript
/**
 * Test user data (for future user registration/login tests).
 */

const RUN_ID = Date.now().toString(36);

export const USERS = {
  // Valid user (happy path)
  valid: () => ({
    email: `user-${RUN_ID}@example.com`,
    password: 'SecurePassword123!@#',
    firstName: 'Test',
    lastName: 'User',
  }),

  // User for multiple test runs (avoid duplicate emails)
  unique: () => ({
    email: `user-${RUN_ID}-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'SecurePassword123!@#',
    firstName: 'Unique',
    lastName: `Test${RUN_ID}`,
  }),

  // Weak password (for validation tests)
  weakPassword: () => ({
    email: `weak-${RUN_ID}@example.com`,
    password: '123',
    firstName: 'Weak',
    lastName: 'Pass',
  }),

  // Invalid email
  invalidEmail: () => ({
    email: 'not-an-email',
    password: 'SecurePassword123!@#',
    firstName: 'Invalid',
    lastName: 'Email',
  }),

  // Missing fields
  missingEmail: () => ({
    password: 'SecurePassword123!@#',
    firstName: 'No',
    lastName: 'Email',
  }),
};
```

### 5. Test Configuration Constants (`frontend/e2e/fixtures/constants.ts`)

```typescript
/**
 * E2E test configuration constants.
 */

export const TEST_CONFIG = {
  // URLs
  FRONTEND_URL: process.env.PLAYWRIGHT_FRONTEND_URL || 'http://localhost:3000',
  BACKEND_URL: process.env.PLAYWRIGHT_BACKEND_URL || 'http://localhost:3001',

  // Timeouts
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
    REQUEST_ACCESS_DELAY_MS: 100, // Simulate extension latency
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
```

---

## Summary of Fixture Files to Create

| File | Purpose |
|------|---------|
| `frontend/e2e/fixtures/merchants.js` | Merchant test data (valid, invalid variants) |
| `frontend/e2e/fixtures/campaigns.js` | Campaign test data (valid, expired, invalid dates) |
| `frontend/e2e/fixtures/rewards.js` | Reward distribution test data |
| `frontend/e2e/fixtures/users.js` | User registration/login test data |
| `frontend/e2e/fixtures/constants.ts` | Global test configuration & constants |

**Key Design Principles:**
- **Deterministic**: All data includes `RUN_ID` to avoid DB collisions
- **Comprehensive**: Valid paths + error cases (invalid dates, amounts, wallets)
- **Reusable**: Fixtures are factory functions, not hardcoded values
- **Isolated**: Each fixture is self-contained with no cross-dependencies
- **Typed**: Where practical, use TypeScript (constants) for autocomplete
