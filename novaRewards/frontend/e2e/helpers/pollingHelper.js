/**
 * pollingHelper.js — Reusable polling utilities with exponential backoff.
 *
 * Provides:
 * - pollUntil: Generic predicate polling
 * - pollForElement: Wait for page element visibility
 * - pollBalanceUntilReady: Balance-specific polling
 */

/**
 * Polls a predicate function until it returns true, with exponential backoff.
 *
 * @param {Function} predicate - Async function returning boolean
 * @param {object} opts
 * @param {number} [opts.timeoutMs=30_000]
 * @param {number} [opts.initialDelayMs=500]
 * @param {number} [opts.maxDelayMs=4_000]
 * @param {string} [opts.description='poll']
 * @returns {Promise<{ attempts, totalTimeMs }>}
 * @throws {Error} if timeout reached without success
 */
export async function pollUntil(
  predicate,
  {
    timeoutMs = 30_000,
    initialDelayMs = 500,
    maxDelayMs = 4_000,
    description = 'poll',
  } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let delay = initialDelayMs;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts++;
    try {
      const result = await predicate();
      if (result) {
        const totalTimeMs = Date.now() - (deadline - timeoutMs);
        return { attempts, totalTimeMs };
      }
    } catch (err) {
      // Predicates may throw; if timeout is reached, we'll throw below
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      break;
    }

    await new Promise((r) => setTimeout(r, Math.min(delay, remainingMs)));
    delay = Math.min(delay * 2, maxDelayMs);
  }

  throw new Error(`[pollUntil] "${description}" timed out after ${attempts} attempts (${timeoutMs}ms)`);
}

/**
 * Polls a page element until it appears on screen.
 *
 * @param {Page} page
 * @param {string|Locator} selector
 * @param {object} opts
 * @param {number} [opts.timeoutMs=10_000]
 * @param {string} [opts.description]
 * @returns {Promise<Locator>}
 */
export async function pollForElement(page, selector, { timeoutMs = 10_000, description } = {}) {
  const locator = typeof selector === 'string' ? page.locator(selector) : selector;
  const desc = description || `element "${selector}"`;

  await pollUntil(
    async () => {
      const count = await locator.count();
      return count > 0;
    },
    { timeoutMs, description: desc }
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
 * @param {number} [opts.timeoutMs=30_000]
 * @returns {Promise<{ balance, attempts, totalTimeMs }>}
 * @throws {Error} if timeout reached
 */
export async function pollBalanceUntilReady(
  apiClient,
  walletAddress,
  expectedBalance,
  { timeoutMs = 30_000 } = {}
) {
  let lastBalance = 0;

  const { attempts, totalTimeMs } = await pollUntil(
    async () => {
      lastBalance = await apiClient.getBalance(walletAddress);
      return lastBalance >= expectedBalance;
    },
    {
      timeoutMs,
      description: `balance for ${walletAddress.slice(0, 8)}... >= ${expectedBalance}`,
    }
  );

  return { balance: lastBalance, attempts, totalTimeMs };
}
