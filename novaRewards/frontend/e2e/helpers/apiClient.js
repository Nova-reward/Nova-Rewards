/**
 * apiClient.js — Backend API helper for Playwright E2E test setup.
 *
 * Provides typed, Promise-based wrappers over the NovaRewards REST API so that
 * test fixtures can create merchants, users, campaigns, and issue rewards
 * without clicking through the browser.  This keeps the UI spec focused on the
 * UI interactions and avoids brittle "setup via the page" pre-conditions.
 *
 * All functions throw on non-2xx responses; callers should let errors propagate
 * so Playwright surfaces them as test setup failures rather than silent bugs.
 *
 * Usage (inside a Playwright test or fixture):
 *
 *   const client = createApiClient('http://localhost:3001');
 *   const { merchant, apiKey } = await client.registerMerchant({ ... });
 *   const { campaign }         = await client.createCampaign({ ... }, apiKey);
 *   const { txHash }           = await client.distributeReward({ ... }, apiKey);
 *   const balance              = await client.pollBalance(walletAddress, expectedAmount);
 */

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Sends a JSON request and returns the parsed response body.
 * Throws a descriptive Error on non-2xx status.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<unknown>}
 */
async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!res.ok) {
    const message =
      (typeof body === 'object' && body !== null && body.message) ||
      `HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`;
    const err = new Error(`[apiClient] ${options.method || 'GET'} ${url} → ${message}`);
    // @ts-ignore — attach status for callers that want to branch on it
    err.status = res.status;
    // @ts-ignore
    err.body = body;
    throw err;
  }

  return body;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an API client bound to the given base URL.
 *
 * @param {string} baseUrl  e.g. "http://localhost:3001"
 * @returns {ApiClient}
 */
function createApiClient(baseUrl) {
  const api = baseUrl.replace(/\/$/, '');

  // ── Auth ──────────────────────────────────────────────────────────────────

  /**
   * Registers a new user account.
   *
   * @param {{ email: string, password: string, firstName: string, lastName: string }} params
   * @returns {Promise<{ user: object }>}
   */
  async function registerUser({ email, password, firstName, lastName }) {
    const body = await request(`${api}/api/auth/register`, {
      method: 'POST',
      body: { email, password, firstName, lastName },
    });
    return { user: body.data };
  }

  /**
   * Logs in and returns the access token + user record.
   *
   * @param {{ email: string, password: string }} params
   * @returns {Promise<{ accessToken: string, refreshToken: string, user: object }>}
   */
  async function loginUser({ email, password }) {
    const body = await request(`${api}/api/auth/login`, {
      method: 'POST',
      body: { email, password },
    });
    return {
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken,
      user: body.data.user,
    };
  }

  // ── Merchants ─────────────────────────────────────────────────────────────

  /**
   * Registers a new merchant and returns its record + raw API key.
   *
   * IMPORTANT: The raw API key is only returned at registration time.
   * The database stores only its SHA-256 hash.
   *
   * @param {{ name: string, walletAddress: string, businessCategory?: string }} params
   * @returns {Promise<{ merchant: object, apiKey: string }>}
   */
  async function registerMerchant({ name, walletAddress, businessCategory = 'Testing' }) {
    const body = await request(`${api}/api/merchants/register`, {
      method: 'POST',
      body: { name, walletAddress, businessCategory },
    });
    return {
      merchant: body.data,
      // api_key is present in the response only on first registration
      apiKey: body.data.api_key,
    };
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  /**
   * Creates a reward campaign on behalf of a merchant.
   *
   * @param {{ name: string, rewardRate: number, startDate: string, endDate: string }} params
   * @param {string} merchantApiKey   x-api-key for authentication
   * @returns {Promise<{ campaign: object }>}
   */
  async function createCampaign({ name, rewardRate, startDate, endDate }, merchantApiKey) {
    const body = await request(`${api}/api/campaigns`, {
      method: 'POST',
      headers: { 'x-api-key': merchantApiKey },
      body: { name, rewardRate, startDate, endDate },
    });
    return { campaign: body.data };
  }

  // ── Rewards ───────────────────────────────────────────────────────────────

  /**
   * Issues a NOVA reward to a recipient wallet.
   *
   * The backend will:
   *   1. Verify the recipient has a NOVA trustline via Horizon.
   *   2. Check the campaign is active and belongs to this merchant.
   *   3. Build, sign (DISTRIBUTION_SECRET), and submit a payment on Stellar.
   *   4. Return { success, txHash }.
   *
   * In E2E tests the Stellar calls are intercepted by Playwright's route mocking
   * (see reward-issuance.spec.js) so no real network calls happen to Horizon.
   *
   * @param {{ walletAddress: string, amount: string|number, campaignId: number }} params
   * @param {string} merchantApiKey
   * @returns {Promise<{ txHash: string }>}
   */
  async function distributeReward({ walletAddress, amount, campaignId }, merchantApiKey) {
    const body = await request(`${api}/api/rewards/distribute`, {
      method: 'POST',
      headers: { 'x-api-key': merchantApiKey },
      body: { walletAddress, amount: String(amount), campaignId },
    });
    // Backend returns { success: true, txHash, transaction } at the top level.
    return { txHash: body.txHash };
  }

  // ── Balance ───────────────────────────────────────────────────────────────

  /**
   * Fetches the current NOVA token balance for a wallet address from the
   * Horizon-backed /api/users/:wallet/points endpoint.
   *
   * @param {string} walletAddress
   * @returns {Promise<number>}
   */
  async function getBalance(walletAddress) {
    const body = await request(`${api}/api/users/${walletAddress}/points`);
    return Number(body.data.balance);
  }

  /**
   * Polls GET /api/users/:walletAddress/points until the balance reaches
   * (or exceeds) `expectedBalance`, with a configurable timeout.
   *
   * Polling uses exponential back-off starting at 500 ms to avoid hammering
   * the API while still converging quickly in fast CI environments.
   *
   * @param {string}  walletAddress
   * @param {number}  expectedBalance   Minimum balance to wait for (NOVA units)
   * @param {object}  [opts]
   * @param {number}  [opts.timeoutMs=30000]  Abort after this many ms
   * @param {number}  [opts.initialDelayMs=500]
   * @param {number}  [opts.maxDelayMs=4000]
   * @returns {Promise<number>}  The observed balance when the condition was met
   * @throws {Error}  if the timeout is reached before the balance matches
   */
  async function pollBalance(
    walletAddress,
    expectedBalance,
    { timeoutMs = 30_000, initialDelayMs = 500, maxDelayMs = 4_000 } = {},
  ) {
    const deadline = Date.now() + timeoutMs;
    let delay = initialDelayMs;
    let lastBalance = 0;

    while (Date.now() < deadline) {
      lastBalance = await getBalance(walletAddress);
      if (lastBalance >= expectedBalance) return lastBalance;

      // Wait, then double the delay (capped at maxDelayMs)
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, maxDelayMs);
    }

    throw new Error(
      `[apiClient] pollBalance timed out after ${timeoutMs}ms. ` +
        `Expected balance >= ${expectedBalance}, last observed: ${lastBalance}`,
    );
  }

  // ── Merchant totals ───────────────────────────────────────────────────────

  /**
   * Returns total NOVA distributed and redeemed for the merchant
   * identified by the given API key.
   *
   * @param {string} merchantApiKey
   * @returns {Promise<{ totalDistributed: string, totalRedeemed: string }>}
   */
  async function getMerchantTotals(merchantApiKey) {
    const body = await request(`${api}/api/transactions/merchant-totals`, {
      headers: { 'x-api-key': merchantApiKey },
    });
    return body.data;
  }

  return {
    registerUser,
    loginUser,
    registerMerchant,
    createCampaign,
    distributeReward,
    getBalance,
    pollBalance,
    getMerchantTotals,
  };
}

module.exports = { createApiClient };
