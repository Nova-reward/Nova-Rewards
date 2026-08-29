'use strict';

const { distributeRewards } = require('../../blockchain/sendRewards');
const logger = require('../lib/logger');
const cacheService = require('../services/cacheService');

const BATCH_SIZE = 50;
const MAX_RECIPIENT_RETRIES = 3;

// ---------------------------------------------------------------------------
// Custom error codes
// ---------------------------------------------------------------------------

class CampaignEnforcementError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CampaignEnforcementError';
    this.code = code;
    this.statusCode = 422;
  }
}

// ---------------------------------------------------------------------------
// Enforcement helpers
// ---------------------------------------------------------------------------

/**
 * Validates that a campaign is still eligible for distribution.
 * Throws CampaignEnforcementError with a specific code if not.
 *
 * @param {object} campaign - Campaign row from DB
 * @param {object} [opts]
 * @param {Date} [opts.now] - Override the current date (useful in tests)
 */
function assertCampaignEligible(campaign, { now = new Date() } = {}) {
  if (!campaign) {
    throw new CampaignEnforcementError('CAMPAIGN_NOT_FOUND', 'Campaign does not exist.');
  }

  // Status check
  if (campaign.status && campaign.status !== 'active') {
    throw new CampaignEnforcementError(
      'CAMPAIGN_INACTIVE',
      `Campaign ${campaign.id} is not active (status: ${campaign.status}).`
    );
  }

  // End-date enforcement
  if (campaign.end_date) {
    const endDate = new Date(campaign.end_date);
    if (now > endDate) {
      throw new CampaignEnforcementError(
        'CAMPAIGN_EXPIRED',
        `Campaign ${campaign.id} ended on ${endDate.toISOString()}. No further distributions allowed.`
      );
    }
  }

  // Budget cap enforcement
  const budgetCap = Number(campaign.budget_cap ?? campaign.token_amount ?? 0);
  const totalIssued = Number(campaign.total_issued ?? campaign.tokens_issued ?? 0);

  if (budgetCap > 0 && totalIssued >= budgetCap) {
    throw new CampaignEnforcementError(
      'CAMPAIGN_BUDGET_EXHAUSTED',
      `Campaign ${campaign.id} has reached its budget cap (${budgetCap} tokens). Issued: ${totalIssued}.`
    );
  }
}

// ---------------------------------------------------------------------------
// Transfer helper
// ---------------------------------------------------------------------------

/**
 * Attempts a single transfer, retrying up to MAX_RECIPIENT_RETRIES times on failure.
 * Returns { walletAddress, txHash } on success or throws the last error.
 */
async function transferWithRetry(walletAddress, amount, campaignId) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RECIPIENT_RETRIES; attempt++) {
    try {
      const { txHash } = await distributeRewards({
        toWallet: walletAddress,
        amount: String(amount),
        campaignId,
      });
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

// ---------------------------------------------------------------------------
// Main distribution function
// ---------------------------------------------------------------------------

/**
 * Processes all recipients for a campaign distribution job.
 *
 * Validates campaign eligibility (end-date + budget cap) before processing.
 * Recipients are processed in batches of BATCH_SIZE (50) to stay within
 * Stellar's rate limits. Each recipient is retried up to MAX_RECIPIENT_RETRIES (3)
 * times before being counted as permanently failed.
 *
 * @param {object} params
 * @param {number|string} params.campaignId
 * @param {Array<{walletAddress: string, amount: string}>} params.recipients
 * @param {string} [params.defaultAmount] - Used when a recipient has no per-recipient amount
 * @param {object} [params.campaign] - Pre-loaded campaign row (avoids extra DB hit if caller has it)
 * @returns {Promise<{succeeded: Array, failed: Array}>}
 * @throws {CampaignEnforcementError} if campaign is expired or budget exhausted
 */
async function processCampaignDistribution({
  campaignId,
  recipients,
  defaultAmount,
  campaign = null,
}) {
  // If campaign object provided, enforce constraints before touching Stellar
  if (campaign) {
    assertCampaignEligible(campaign);
  }

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

          // Invalidate balance cache for the recipient after successful distribution
          await cacheService.invalidateBalanceCache(recipient.walletAddress);
        } catch (err) {
          logger.error('[Distribution] recipient permanently failed', {
            campaignId,
            walletAddress: recipient.walletAddress,
            error: err.message,
          });
          failed.push({ walletAddress: recipient.walletAddress, error: err.message });
        }
      })
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

module.exports = {
  processCampaignDistribution,
  assertCampaignEligible,
  CampaignEnforcementError,
  BATCH_SIZE,
  MAX_RECIPIENT_RETRIES,
};
