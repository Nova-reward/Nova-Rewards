/**
 * mockSetup.js — Centralized backend API mock configuration.
 *
 * Installs Playwright route mocks for:
 * - Trustline verification
 * - Reward distribution
 * - Balance polling
 * - Error scenarios
 */

/**
 * Sets up standard backend mocks for happy-path tests.
 *
 * @param {Page} page
 * @param {object} opts
 * @param {number} [opts.expectedBalance=10] - Balance to return after distribution
 * @returns {Promise<{ distributionTxHash }>}
 */
export async function setupBackendMocks(page, { expectedBalance = 10 } = {}) {
  let distributed = false;
  const distributionTxHash = `mock-tx-hash-${Date.now()}`;

  // POST /api/trustline/verify → always report trustline exists
  await page.route('**/api/trustline/verify', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { exists: true } }),
    })
  );

  // POST /api/trustline/build → return mock unsigned XDR
  await page.route('**/api/trustline/build', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        xdr: 'AAAAAgAAAABmock-unsigned-changeTrust-xdr==',
      }),
    })
  );

  // POST /api/rewards/distribute → accept and return mock txHash
  await page.route('**/api/rewards/distribute', (route) => {
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

  // GET /api/users/:wallet/points → return balance (0 before distribute, expectedBalance after)
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
 * Setup mock for "no trustline" error scenario.
 *
 * @param {Page} page
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
 * Setup mock for "expired campaign" error scenario.
 *
 * @param {Page} page
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
 * Setup mock for rate limiting (429) error scenario.
 *
 * @param {Page} page
 */
export async function setupMockRateLimit(page) {
  await page.route('**/api/rewards/distribute', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Please try again later.',
      }),
    })
  );
}

/**
 * Setup mock for "campaign not found" (404) error scenario.
 *
 * @param {Page} page
 */
export async function setupMockCampaignNotFound(page) {
  await page.route('**/api/rewards/distribute', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: 'not_found',
        message: 'Campaign does not exist',
      }),
    })
  );
}

/**
 * Setup mock for "merchant forbidden" (403) error scenario.
 *
 * @param {Page} page
 */
export async function setupMockMerchantForbidden(page) {
  await page.route('**/api/rewards/distribute', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: 'forbidden',
        message: 'Campaign does not belong to this merchant',
      }),
    })
  );
}
