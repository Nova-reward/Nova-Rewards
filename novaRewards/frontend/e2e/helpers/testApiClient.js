/**
 * testApiClient.js — Extended test API client with assertions and retry logic.
 *
 * Wraps the base createApiClient() and adds:
 * - Error assertion helpers (expectApiError)
 * - Retry logic with exponential backoff (distributeRewardWithRetry)
 * - Response logging
 */

import { createApiClient } from './apiClient.js';

/**
 * Creates a test-enhanced API client.
 *
 * @param {string} baseUrl
 * @returns {object} Extended API client with test helpers
 */
export function createTestApiClient(baseUrl) {
  const api = createApiClient(baseUrl);

  return {
    ...api,

    /**
     * Registers a merchant and returns the raw API key.
     *
     * @param {object} merchantData
     * @returns {Promise<{ merchant, apiKey }>}
     */
    async registerMerchantWithKey(merchantData) {
      const body = await this.registerMerchant(merchantData);
      return {
        merchant: body.merchant,
        apiKey: body.apiKey,
      };
    },

    /**
     * Distributes a reward with automatic retry (exponential backoff).
     * Useful if the backend is transiently slow.
     *
     * @param {object} rewardData
     * @param {string} apiKey
     * @param {object} opts
     * @param {number} [opts.maxRetries=3]
     * @param {number} [opts.initialDelayMs=500]
     * @returns {Promise<{ txHash }>}
     */
    async distributeRewardWithRetry(
      rewardData,
      apiKey,
      { maxRetries = 3, initialDelayMs = 500 } = {}
    ) {
      let lastErr;
      let delay = initialDelayMs;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await this.distributeReward(rewardData, apiKey);
        } catch (err) {
          lastErr = err;
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, delay));
            delay *= 2;
          }
        }
      }

      throw lastErr;
    },

    /**
     * Asserts that an API call fails with expected status and error code.
     *
     * @param {Function} apiCall
     * @param {object} expectations
     * @param {number} [expectations.status=400]
     * @param {string} [expectations.errorCode]
     * @param {RegExp} [expectations.messagePattern]
     * @returns {Promise<object>} The error response body
     * @throws {Error} if assertion fails
     */
    async expectApiError(apiCall, expectations = {}) {
      const { status = 400, errorCode, messagePattern } = expectations;

      try {
        await apiCall();
        throw new Error(`Expected API error with status ${status}, but call succeeded`);
      } catch (err) {
        if (!err.status) throw err; // Re-throw non-API errors

        if (err.status !== status) {
          throw new Error(
            `Expected status ${status}, got ${err.status}: ${JSON.stringify(err.body)}`
          );
        }

        if (errorCode && err.body?.error !== errorCode) {
          throw new Error(
            `Expected error code "${errorCode}", got "${err.body?.error}"`
          );
        }

        if (messagePattern && !messagePattern.test(err.body?.message)) {
          throw new Error(
            `Message "${err.body?.message}" does not match pattern ${messagePattern}`
          );
        }

        return err.body;
      }
    },
  };
}
