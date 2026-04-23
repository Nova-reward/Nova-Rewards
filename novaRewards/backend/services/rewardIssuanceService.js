/**
 * Reward Issuance Engine  (#572)
 *
 * Responsibilities:
 *  - Validate campaign eligibility for an action event
 *  - Enforce idempotency (one reward per idempotency key)
 *  - Submit Stellar distribution transaction
 *  - Record status (pending → confirmed | failed) in reward_issuances
 *  - Enqueue jobs via BullMQ (3 attempts, exponential backoff)
 *  - Move permanently-failed jobs to a dead-letter queue
 */

const { rewardIssuanceQueue } = require('../jobs/queues');
const {
  createIssuance,
  getIssuanceByKey,
  markConfirmed,
  markFailed,
  incrementAttempts,
} = require('../db/rewardIssuanceRepository');
const { getActiveCampaign } = require('../db/campaignRepository');
const { distributeRewards } = require('../../blockchain/sendRewards');

// ---------------------------------------------------------------------------
// Enqueue a reward issuance job
// ---------------------------------------------------------------------------

/**
 * Enqueues a reward issuance job.
 *
 * @param {{
 *   idempotencyKey: string,   — unique key (e.g. `${merchantId}:${userId}:${actionId}`)
 *   campaignId:     number,
 *   userId?:        number,
 *   walletAddress:  string,
 *   amount:         number,
 * }} params
 * @returns {Promise<{ queued: boolean, issuanceId?: number, duplicate?: boolean }>}
 */
async function enqueueRewardIssuance(params) {
  const { idempotencyKey } = params;

  // Check for existing record — return early if already processed
  const existing = await getIssuanceByKey(idempotencyKey);
  if (existing) {
    return { queued: false, duplicate: true, issuanceId: existing.id, status: existing.status };
  }

  // Persist pending record before enqueuing (guarantees DB row exists when worker runs)
  const issuance = await createIssuance(params);
  if (!issuance) {
    // Race condition: another process inserted the same key
    const race = await getIssuanceByKey(idempotencyKey);
    return { queued: false, duplicate: true, issuanceId: race?.id, status: race?.status };
  }

  await rewardIssuanceQueue.add(
    'issue-reward',
    { issuanceId: issuance.id, ...params },
    { jobId: idempotencyKey } // BullMQ deduplicates by jobId
  );

  return { queued: true, issuanceId: issuance.id };
}

// ---------------------------------------------------------------------------
// Process a single reward issuance job (called by the BullMQ worker)
// ---------------------------------------------------------------------------

/**
 * Processes one reward issuance job.
 * Throws on failure so BullMQ can retry with exponential backoff.
 *
 * @param {import('bullmq').Job} job
 */
async function processRewardIssuance(job) {
  const { issuanceId, campaignId, walletAddress, amount } = job.data;

  await incrementAttempts(issuanceId);

  // Validate campaign is still active
  const campaign = await getActiveCampaign(campaignId);
  if (!campaign) {
    await markFailed(issuanceId, 'Campaign is inactive or expired');
    // Do NOT throw — no point retrying an eligibility failure
    return { skipped: true, reason: 'campaign_inactive' };
  }

  try {
    const { txHash } = await distributeRewards({ recipient: walletAddress, amount, campaignId });
    await markConfirmed(issuanceId, txHash);
    return { confirmed: true, txHash };
  } catch (err) {
    // On the final attempt, mark as failed; otherwise let BullMQ retry
    if (job.attemptsMade >= (job.opts.attempts ?? 3) - 1) {
      await markFailed(issuanceId, err.message);
    }
    throw err; // re-throw so BullMQ handles backoff / dead-letter
  }
}

module.exports = { enqueueRewardIssuance, processRewardIssuance };
