// @ts-check
/**
 * Shared test helpers and fixtures for Nova Rewards E2E tests.
 */

const { expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Unique email per test run to avoid conflicts */
function uniqueEmail(prefix = 'user') {
  return `${prefix}+${Date.now()}@test.nova`;
}

const TEST_USER = {
  name: 'Test User',
  email: uniqueEmail('e2e'),
  password: 'Password1',
};

const TEST_MERCHANT = {
  name: 'E2E Coffee Shop',
  walletAddress: 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3QLBDQBQD',
  businessCategory: 'Food & Beverage',
};

/**
 * Register a user via the UI and return to the page after redirect.
 * @param {import('@playwright/test').Page} page
 * @param {{ name: string, email: string, password: string }} user
 */
async function registerUser(page, user = TEST_USER) {
  await page.goto('/register');
  await page.fill('#name', user.name);
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.fill('#confirmPassword', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}

/**
 * Log in via the UI.
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string, password: string }} credentials
 */
async function loginUser(page, credentials = TEST_USER) {
  await page.goto('/login');
  await page.fill('#email', credentials.email);
  await page.fill('#password', credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}

/**
 * Seed auth tokens directly into localStorage to skip UI login.
 * @param {import('@playwright/test').Page} page
 * @param {{ token: string, user: object }} auth
 */
async function seedAuth(page, auth) {
  await page.goto('/login');
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('authUser', JSON.stringify(user));
  }, auth);
}

// ============================================================================
// Freighter Wallet Mocking Utilities
// ============================================================================

const TEST_WALLET_ADDRESS = 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3QLBDQBQD';
const TEST_WALLET_SECRET = 'SBZNMVXVWZVYKHVUVZQZF5ZFRX5IBMYQLVFK5G3IHFCZFJCL4YJV3JL7';

/**
 * Injects a mocked Freighter extension into the page context.
 * Allows simulating successful wallet connections, errors, and network states.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Configuration for the mock
 * @param {boolean} options.installed - Whether Freighter is "installed" (default: true)
 * @param {boolean} options.authorized - Whether user has authorized access (default: false)
 * @param {string} options.publicKey - Mock wallet address (default: TEST_WALLET_ADDRESS)
 * @param {string} options.network - Mock network ('TESTNET' or 'PUBLIC', default: 'TESTNET')
 * @param {string} options.networkPassphrase - Network passphrase (default: Test SDF)
 * @param {boolean} options.networkMismatch - Simulate network mismatch error (default: false)
 * @param {'denied'|'error'|null} options.accessDenialError - Simulate access denial (default: null)
 */
async function mockFreighterExtension(page, options = {}) {
  const {
    installed = true,
    authorized = false,
    publicKey = TEST_WALLET_ADDRESS,
    network = 'TESTNET',
    networkPassphrase = 'Test SDF Network ; September 2015',
    networkMismatch = false,
    accessDenialError = null,
  } = options;

  await page.addInitScript(({ installed, authorized, publicKey, network, networkPassphrase, networkMismatch, accessDenialError }) => {
    // Create mock freighter API
    window.freighter = {
      isConnected: async () => ({
        isConnected: installed,
      }),
      requestAccess: async () => {
        if (!installed) {
          throw new Error('Freighter extension not found');
        }
        if (accessDenialError === 'denied') {
          return { error: 'User denied access' };
        }
        if (accessDenialError === 'error') {
          throw new Error('Access request failed');
        }
        return { error: null };
      },
      getPublicKey: async () => {
        if (!installed || !authorized) {
          return { error: 'Not connected' };
        }
        return { publicKey, error: null };
      },
      getNetwork: async () => {
        if (!installed || !authorized) {
          return { error: 'Not connected' };
        }
        const mismatchNetwork = networkMismatch ? 'PUBLIC' : network;
        const mismatchPassphrase = networkMismatch
          ? 'Public Global Stellar Network ; September 2015'
          : networkPassphrase;
        return {
          network: mismatchNetwork,
          networkPassphrase: mismatchPassphrase,
          error: null,
        };
      },
      signTransaction: async (xdr, opts) => {
        if (!installed || !authorized) {
          throw new Error('Not connected');
        }
        // Return a mock signed XDR
        return {
          signedTxXdr: `signed_${xdr}`,
          error: null,
        };
      },
    };

    // Mock @stellar/freighter-api module exports for dynamic imports
    window.__FREIGHTER_MOCK__ = {
      isConnected: () => window.freighter.isConnected(),
      requestAccess: () => window.freighter.requestAccess(),
      getPublicKey: () => window.freighter.getPublicKey(),
      getNetwork: () => window.freighter.getNetwork(),
      signTransaction: (xdr, opts) => window.freighter.signTransaction(xdr, opts),
    };
  }, { installed, authorized, publicKey, network, networkPassphrase, networkMismatch, accessDenialError });

  // Intercept module resolution for @stellar/freighter-api
  await page.route('**/@stellar/freighter-api*', (route) => {
    route.abort();
  });
}

/**
 * Authorizes the mocked Freighter wallet for a page.
 * This simulates the user clicking "Approve" in the Freighter prompt.
 *
 * @param {import('@playwright/test').Page} page
 */
async function authorizeFreighter(page) {
  await page.evaluate(() => {
    // Update the mock to indicate authorization
    if (window.freighter) {
      window.freighter._authorized = true;
    }
  });
}

/**
 * Sets up the page with a connected Freighter wallet.
 * Combines mocking + authorization + localStorage seeding.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Same options as mockFreighterExtension
 */
async function setUpConnectedFreighterWallet(page, options = {}) {
  await mockFreighterExtension(page, { ...options, authorized: true });
  await page.goto('/dashboard');
  // Seed localStorage with wallet connection
  await page.evaluate((publicKey) => {
    localStorage.setItem('walletPublicKey', publicKey);
    localStorage.setItem('walletType', 'freighter');
  }, options.publicKey || TEST_WALLET_ADDRESS);
}

/**
 * Mock Horizon API responses for wallet balance and transaction queries.
 * Prevents external API calls during tests.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {string} options.balance - NOVA balance (default: '1000.0000000')
 * @param {Array} options.transactions - Mock transactions array (default: [])
 */
async function mockHorizonAPI(page, options = {}) {
  const { balance = '1000.0000000', transactions = [] } = options;

  // Mock account details endpoint
  await page.route('**/api/v1/accounts/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: TEST_WALLET_ADDRESS,
        account_id: TEST_WALLET_ADDRESS,
        balances: [
          {
            balance,
            asset_type: 'credit_alphanum4',
            asset_code: 'NOVA',
            asset_issuer: 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3QLBDQBQD',
          },
        ],
      }),
    });
  });

  // Mock transactions endpoint
  await page.route('**/api/v1/accounts/**/transactions**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        _embedded: { records: transactions },
      }),
    });
  });

  // Mock operations endpoint
  await page.route('**/api/v1/accounts/**/operations**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        _embedded: { records: [] },
      }),
    });
  });
}

module.exports = {
  uniqueEmail,
  TEST_USER,
  TEST_MERCHANT,
  TEST_WALLET_ADDRESS,
  TEST_WALLET_SECRET,
  registerUser,
  loginUser,
  seedAuth,
  mockFreighterExtension,
  authorizeFreighter,
  setUpConnectedFreighterWallet,
  mockHorizonAPI,
  API_URL,
};
