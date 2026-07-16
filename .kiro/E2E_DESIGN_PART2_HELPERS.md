# E2E Suite Design - Part 2: Helper Utilities & Page Objects

## Helper Utilities

### 1. API Client Helper (`frontend/e2e/helpers/testApiClient.js`)

**Extends the existing `apiClient.js` with test-specific methods:**

```javascript
/**
 * testApiClient.js — Test-specific API client extensions.
 * 
 * Wraps createApiClient() and adds:
 * - Error assertion helpers
 * - Response logging
 * - Retry logic with backoff
 * - Mock response injection
 */

import { createApiClient } from './apiClient.js';

export function createTestApiClient(baseUrl) {
  const api = createApiClient(baseUrl);

  return {
    ...api,

    /**
     * Registers a merchant and returns { merchant, apiKey, displayedApiKey }.
     * The displayedApiKey is the one returned by the API (for UI verification).
     * 
     * @param {object} merchantData
     * @returns {Promise<{ merchant, apiKey, displayedApiKey }>}
     */
    async registerMerchantWithKey(merchantData) {
      const body = await this.registerMerchant(merchantData);
      return {
        merchant: body.merchant,
        apiKey: body.apiKey,
        displayedApiKey: body.apiKey, // Same for API client
      };
    },

    /**
     * Creates a campaign and optionally logs response.
     * 
     * @param {object} campaignData
     * @param {string} apiKey
     * @returns {Promise<object>}
     */
    async createCampaignWithLogging(campaignData, apiKey) {
      try {
        const { campaign } = await this.createCampaign(campaignData, apiKey);
        console.log('[testApiClient] Campaign created:', {
          id: campaign.id,
          name: campaign.name,
          merchant_id: campaign.merchant_id,
        });
        return campaign;
      } catch (err) {
        console.error('[testApiClient] Campaign creation failed:', err.message);
        throw err;
      }
    },

    /**
     * Distributes a reward with retry logic (exponential backoff).
     * Useful if the backend is transiently slow.
     * 
     * @param {object} rewardData
     * @param {string} apiKey
     * @param {object} opts
     * @param {number} [opts.maxRetries=3]
     * @param {number} [opts.initialDelayMs=500]
     * @returns {Promise<{ txHash }>}
     */
    async distributeRewardWithRetry(rewardData, apiKey, { maxRetries = 3, initialDelayMs = 500 } = {}) {
      let lastErr;
      let delay = initialDelayMs;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await this.distributeReward(rewardData, apiKey);
        } catch (err) {
          lastErr = err;
          console.warn(`[testApiClient] Distribute attempt ${attempt} failed: ${err.message}`);
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
          }
        }
      }

      throw new Error(`[testApiClient] Distribute failed after ${maxRetries} retries: ${lastErr.message}`);
    },

    /**
     * Asserts that an API call fails with a specific HTTP status & error code.
     * 
     * @param {Function} apiCall — The API call to make
     * @param {object} expectations
     * @param {number} [expectations.status=400]
     * @param {string} [expectations.errorCode]
     * @param {string} [expectations.messagePattern]
     * @returns {Promise<object>} — The error response body
     */
    async expectApiError(apiCall, expectations = {}) {
      const { status = 400, errorCode, messagePattern } = expectations;

      try {
        await apiCall();
        throw new Error(`[testApiClient] Expected API error with status ${status}, but call succeeded`);
      } catch (err) {
        if (err.status !== status) {
          throw new Error(
            `[testApiClient] Expected status ${status}, got ${err.status}: ${JSON.stringify(err.body)}`
          );
        }

        if (errorCode && err.body?.error !== errorCode) {
          throw new Error(
            `[testApiClient] Expected error code "${errorCode}", got "${err.body?.error}"`
          );
        }

        if (messagePattern && !messagePattern.test(err.body?.message)) {
          throw new Error(
            `[testApiClient] Message "${err.body?.message}" does not match pattern ${messagePattern}`
          );
        }

        console.log('[testApiClient] Caught expected error:', {
          status,
          errorCode: err.body?.error,
          message: err.body?.message,
        });

        return err.body;
      }
    },
  };
}
```

### 2. Freighter Mock Helper (`frontend/e2e/helpers/freighterMockBuilder.js`)

**Enhanced Freighter mock with configuration:**

```javascript
/**
 * freighterMockBuilder.js — Advanced Freighter mock builder.
 * 
 * Extends buildFreighterMockScript() with:
 * - Delayed responses (simulate extension latency)
 * - Signing request tracking
 * - Selective rejection
 */

import { buildFreighterMockScript } from './freighterMock.js';

export function buildAdvancedFreighterMock({
  publicKey,
  autoApprove = true,
  responseDelayMs = 100,
  trackingCallback = null,
} = {}) {
  if (!publicKey) {
    throw new Error('[freighterMockBuilder] publicKey is required');
  }

  /**
   * Browser-side function that installs the advanced mock.
   */
  function browserScript(config) {
    // Tracking state (persisted in browser window)
    window.__freighterMockTracking = {
      signRequests: [],
      getPublicKeyRequests: 0,
      requestAccessRequests: 0,
    };

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    const stub = {
      async isConnected() {
        await delay(config.responseDelayMs * 0.5);
        return { isConnected: true };
      },

      async requestAccess() {
        window.__freighterMockTracking.requestAccessRequests++;
        await delay(config.responseDelayMs);
        return {}; // No error = success
      },

      async getPublicKey() {
        window.__freighterMockTracking.getPublicKeyRequests++;
        await delay(config.responseDelayMs);
        return { publicKey: config.publicKey };
      },

      async signTransaction(xdr) {
        window.__freighterMockTracking.signRequests.push({
          xdr,
          timestamp: Date.now(),
        });

        await delay(config.responseDelayMs);

        if (!config.autoApprove) {
          return { error: 'User declined to sign transaction' };
        }

        return { signedTxXdr: xdr };
      },

      // Test helper: get tracking data
      __getTracking() {
        return window.__freighterMockTracking;
      },

      // Test helper: reset tracking
      __resetTracking() {
        window.__freighterMockTracking = {
          signRequests: [],
          getPublicKeyRequests: 0,
          requestAccessRequests: 0,
        };
      },
    };

    // Install stub
    window.freighterApi = stub;
    window.__FREIGHTER_API_OVERRIDE__ = stub;
    console.debug('[freighterMockBuilder] Advanced mock installed');
  }

  return {
    script: browserScript,
    arg: { publicKey, autoApprove, responseDelayMs },
  };
}

/**
 * Helper: Extract tracking data from the browser context.
 * Call this inside a test to verify Freighter was called correctly.
 * 
 * @param {Page} page
 * @returns {Promise<{ signRequests, getPublicKeyRequests, requestAccessRequests }>}
 */
export async function getFreighterMockTracking(page) {
  return page.evaluate(() => window.__freighterMockTracking);
}

/**
 * Helper: Assert Freighter.signTransaction was called N times.
 * 
 * @param {Page} page
 * @param {number} expectedCount
 */
export async function assertFreighterSignCount(page, expectedCount) {
  const tracking = await getFreighterMockTracking(page);
  if (tracking.signRequests.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} sign requests, got ${tracking.signRequests.length}`
    );
  }
}
```

### 3. Polling Utility (`frontend/e2e/helpers/pollingHelper.js`)

```javascript
/**
 * pollingHelper.js — Reusable polling logic for balance updates, status changes, etc.
 * 
 * Implements exponential backoff with logging.
 */

/**
 * Polls a predicate function until it returns true.
 * 
 * @param {Function} predicate — Async function returning boolean
 * @param {object} opts
 * @param {number} [opts.timeoutMs=30_000]
 * @param {number} [opts.initialDelayMs=500]
 * @param {number} [opts.maxDelayMs=4_000]
 * @param {string} [opts.description='poll']
 * @returns {Promise<{ attempts, totalTimeMs }>}
 * @throws {Error} if timeout reached
 */
export async function pollUntil(
  predicate,
  { timeoutMs = 30_000, initialDelayMs = 500, maxDelayMs = 4_000, description = 'poll' } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let delay = initialDelayMs;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts++;
    try {
      const result = await predicate();
      const totalTimeMs = Date.now() + timeoutMs - deadline;
      console.log(`[pollingHelper] ${description} succeeded after ${attempts} attempts (${totalTimeMs}ms)`);
      return { attempts, totalTimeMs };
    } catch (err) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        throw new Error(`[pollingHelper] ${description} timed out after ${attempts} attempts: ${err.message}`);
      }

      await new Promise(r => setTimeout(r, Math.min(delay, remainingMs)));
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }

  throw new Error(`[pollingHelper] ${description} timed out after ${attempts} attempts`);
}

/**
 * Polls a page element until it appears on screen.
 * 
 * @param {Page} page
 * @param {string|Locator} selector
 * @param {object} opts
 * @returns {Promise<Locator>}
 */
export async function pollForElement(page, selector, opts = {}) {
  const { timeoutMs = 10_000, description = `element "${selector}"` } = opts;
  const locator = typeof selector === 'string' ? page.locator(selector) : selector;

  await pollUntil(
    async () => {
      const count = await locator.count();
      return count > 0;
    },
    { timeoutMs, description }
  );

  return locator;
}

/**
 * Polls balance until it reaches or exceeds expected amount.
 * 
 * @param {ApiClient} apiClient
 * @param {string} walletAddress
 * @param {number} expectedBalance
 * @param {object} opts
 * @returns {Promise<{ balance, attempts, totalTimeMs }>}
 */
export async function pollBalanceUntilReady(
  apiClient,
  walletAddress,
  expectedBalance,
  opts = {}
) {
  const { timeoutMs = 30_000, description = `balance for ${walletAddress}` } = opts;

  let lastBalance = 0;

  const result = await pollUntil(
    async () => {
      lastBalance = await apiClient.getBalance(walletAddress);
      return lastBalance >= expectedBalance;
    },
    { timeoutMs, description }
  );

  return { balance: lastBalance, ...result };
}
```

### 4. Mock Setup Helper (`frontend/e2e/helpers/mockSetup.js`)

```javascript
/**
 * mockSetup.js — Centralized backend API mocking setup.
 * 
 * Installs Playwright route mocks for:
 * - Trustline verification
 * - Reward distribution
 * - Balance polling
 */

export async function setupBackendMocks(page, { expectedBalance = 0 } = {}) {
  let distributed = false;
  const distributionTxHash = `mock-tx-hash-${Date.now()}`;

  // POST /api/trustline/verify
  await page.route('**/api/trustline/verify', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { exists: true } }),
    })
  );

  // POST /api/trustline/build
  await page.route('**/api/trustline/build', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        xdr: 'AAAAAgAAAABmock-unsigned-changeTrust-xdr==',
      }),
    })
  );

  // POST /api/rewards/distribute
  await page.route('**/api/rewards/distribute', (route, request) => {
    distributed = true;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        txHash: distributionTxHash,
        transaction: null,
      }),
    });
  });

  // GET /api/users/:wallet/points
  await page.route('**/api/users/*/points', (route) => {
    const balance = distributed ? expectedBalance : 0;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { balance },
      }),
    });
  });

  return { distributionTxHash };
}

/**
 * Setup mock for "no trustline" error.
 * Causes trustline/verify to return { exists: false }.
 */
export async function setupMockNoTrustline(page) {
  await page.route('**/api/trustline/verify', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: 'no_trustline',
        message: 'Recipient does not have a NOVA trustline',
      }),
    })
  );
}

/**
 * Setup mock for "expired campaign" error.
 * Causes rewards/distribute to return 400 + error.
 */
export async function setupMockExpiredCampaign(page) {
  await page.route('**/api/rewards/distribute', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: 'invalid_campaign',
        message: 'Campaign is expired or inactive',
      }),
    })
  );
}

/**
 * Setup mock for rate limiting (429).
 */
export async function setupMockRateLimit(page) {
  await page.route('**/api/rewards/distribute', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: 'rate_limit_exceeded',
        message: 'Too many requests',
      }),
    })
  );
}
```

---

## Summary of Helper Files to Create

| File | Purpose |
|------|---------|
| `frontend/e2e/helpers/testApiClient.js` | Test-specific API client extensions (logging, retry, error assertions) |
| `frontend/e2e/helpers/freighterMockBuilder.js` | Advanced Freighter mock with tracking & delays |
| `frontend/e2e/helpers/pollingHelper.js` | Reusable polling logic (elements, balance, predicates) |
| `frontend/e2e/helpers/mockSetup.js` | Centralized backend API mock configuration |

