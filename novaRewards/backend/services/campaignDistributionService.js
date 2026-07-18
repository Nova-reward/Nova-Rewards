'use strict';

const { distributeRewards } = require('../../blockchain/sendRewards');
const logger = require('../lib/logger');

const BATCH_SIZE = 50;
const MAX_RECIPIENT_RETRIES = 3;

/**
 * Attempts a single transfer, retrying up to MAX_RECIPIENT_RETRIES times on failure.
 * Returns { walletAddress, txHash } on success or throws the last error.
 */
async function transferWithRetry(walletAddress, amount, campaignId) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RECIPIENT_RETRIES; attempt++) {
    try {
      const { txHash } = await distributeRewards({ toWallet: walletAddress, amount: String(amount), campaignId });
      return { walletAddress, txHash };
    } catch (err) {
      lastErr = err;
      logger.warn('[Distribution] transfer attempt failed', {
        walletAddress,
        campaignId,
        attempt,
        maxAttempts: MAX_RECIPIENT_RETRIES,
        error: err.message,
      });
    }
  }
  throw lastErr;
}

/**
 * Processes all recipients for a campaign distribution job.
 *
 * Recipients are processed in batches of BATCH_SIZE (50) to stay within
 * Stellar's rate limits. Each recipient is retried up to MAX_RECIPIENT_RETRIES (3)
 * times before being counted as permanently failed.
 *
 * @param {object} params
 * @param {number|string} params.campaignId
 * @param {Array<{walletAddress: string, amount: string}>} params.recipients
 * @param {string} [params.defaultAmount] - Used when a recipient has no per-recipient amount
 * @returns {Promise<{succeeded: Array, failed: Array}>}
 */
async function processCampaignDistribution({ campaignId, recipients, defaultAmount }) {
  const succeeded = [];
  const failed = [];

  for (let batchStart = 0; batchStart < recipients.length; batchStart += BATCH_SIZE) {
    const batch = recipients.slice(batchStart, batchStart + BATCH_SIZE);
    const batchIndex = Math.floor(batchStart / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(recipients.length / BATCH_SIZE);

    logger.info('[Distribution] processing batch', {
      campaignId,
      batchIndex,
      totalBatches,
      batchSize: batch.length,
    });

    await Promise.all(
      batch.map(async (recipient) => {
        const amount = recipient.amount ?? defaultAmount;
        try {
          const result = await transferWithRetry(recipient.walletAddress, amount, campaignId);
          succeeded.push(result);
        } catch (err) {
          logger.error('[Distribution] recipient permanently failed', {
            campaignId,
            walletAddress: recipient.walletAddress,
            error: err.message,
          });
          failed.push({ walletAddress: recipient.walletAddress, error: err.message });
        }
      }),
    );
  }

  logger.info('[Distribution] job complete', {
    campaignId,
    total: recipients.length,
    succeeded: succeeded.length,
    failed: failed.length,
  });

  return { succeeded, failed };
}

module.exports = { processCampaignDistribution, BATCH_SIZE, MAX_RECIPIENT_RETRIES };
