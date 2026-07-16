/**
 * freighterMockBuilder.js — Advanced Freighter wallet mock with tracking.
 *
 * Extends buildFreighterMockScript() with:
 * - Configurable response delays (simulate extension latency)
 * - Signing request tracking (for test verification)
 * - Browser-side state for test introspection
 */

import { buildFreighterMockScript } from './freighterMock.js';

/**
 * Builds an advanced Freighter mock with response delays and request tracking.
 *
 * @param {object} config
 * @param {string} config.publicKey - Stellar public key the mock exposes
 * @param {boolean} [config.autoApprove=true] - Auto-approve all sign requests
 * @param {number} [config.responseDelayMs=100] - Delay for all responses
 * @returns {object} { script, arg } for page.addInitScript(script, arg)
 */
export function buildAdvancedFreighterMock({
  publicKey,
  autoApprove = true,
  responseDelayMs = 100,
} = {}) {
  if (!publicKey) {
    throw new Error('[freighterMockBuilder] publicKey is required');
  }

  /**
   * Browser-side function (serialized and eval'd in the browser context).
   * This MUST be self-contained with no outer-scope dependencies.
   *
   * @param {{ publicKey, autoApprove, responseDelayMs }} cfg
   */
  function browserScript(cfg) {
    // Initialize tracking state on window
    window.__freighterMockTracking = {
      signRequests: [],
      getPublicKeyRequests: 0,
      requestAccessRequests: 0,
    };

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    const stub = {
      async isConnected() {
        await delay(cfg.responseDelayMs * 0.5);
        return { isConnected: true };
      },

      async requestAccess() {
        window.__freighterMockTracking.requestAccessRequests++;
        await delay(cfg.responseDelayMs);
        return {}; // No error = success
      },

      async getPublicKey() {
        window.__freighterMockTracking.getPublicKeyRequests++;
        await delay(cfg.responseDelayMs);
        return { publicKey: cfg.publicKey };
      },

      async signTransaction(xdr) {
        window.__freighterMockTracking.signRequests.push({
          xdr,
          timestamp: Date.now(),
        });

        await delay(cfg.responseDelayMs);

        if (!cfg.autoApprove) {
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

    // Install stub globally
    window.freighterApi = stub;
    window.__FREIGHTER_API_OVERRIDE__ = stub;

    console.debug('[freighterMockBuilder] Advanced mock installed', {
      publicKey: cfg.publicKey,
      autoApprove: cfg.autoApprove,
    });
  }

  return {
    script: browserScript,
    arg: { publicKey, autoApprove, responseDelayMs },
  };
}

/**
 * Extracts tracking data from the browser context.
 * Must be called inside a Playwright test.
 *
 * @param {Page} page
 * @returns {Promise<{ signRequests, getPublicKeyRequests, requestAccessRequests }>}
 */
export async function getFreighterMockTracking(page) {
  return page.evaluate(() => window.__freighterMockTracking || {});
}

/**
 * Asserts that Freighter.signTransaction was called the expected number of times.
 *
 * @param {Page} page
 * @param {number} expectedCount
 * @throws {Error} if count doesn't match
 */
export async function assertFreighterSignCount(page, expectedCount) {
  const tracking = await getFreighterMockTracking(page);
  const actualCount = tracking.signRequests?.length || 0;

  if (actualCount !== expectedCount) {
    throw new Error(
      `[assertFreighterSignCount] Expected ${expectedCount} sign requests, got ${actualCount}`
    );
  }
}

/**
 * Resets Freighter mock tracking state.
 *
 * @param {Page} page
 */
export async function resetFreighterMockTracking(page) {
  await page.evaluate(() => {
    if (window.freighterApi?.__resetTracking) {
      window.freighterApi.__resetTracking();
    }
  });
}
