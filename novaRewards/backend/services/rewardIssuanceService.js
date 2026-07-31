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
 *
 * Security (#1138):
 *  - Idempotency keys are HMAC-SHA256 over a canonical JSON payload so that
 *    a crafted actionId containing colon separators cannot produce a collision
 *    with a legitimate key belonging to a different user.
 */

import crypto from 'crypto';
import { rewardIssuanceQueue } from '../jobs/queues';
import {
  createIssuance,
  getIssuanceByKey,
  markConfirmed,
  markFailed,
  incrementAttempts,
} from '../db/rewardIssuanceRepository';
import { getActiveCampaign } from '../db/campaignRepository';
import { distributeRewards } from '../../blockchain/sendRewards';

// ---------------------------------------------------------------------------
// Idempotency key generation
// ---------------------------------------------------------------------------

/**
 * The HMAC secret used to sign idempotency keys.
 * Use a dedicated env var so key-space is isolated from JWT/encryption secrets.
 * Falls back to a development-only placeholder — always set in production.
 */
const IDEMPOTENCY_HMAC_SECRET =
  process.env.IDEMPOTENCY_HMAC_SECRET ||
  process.env.JWT_SECRET ||
  'dev-insecure-idempotency-secret';

/**
 * Generates a collision-resistant HMAC-SHA256 idempotency key from a
 * canonical payload.
 *
 * The canonical form is a JSON-serialised object with keys in a fixed order
 * so the same logical request always produces the same key, regardless of the
 * input field order.
 *
 * @param {{
 *   merchantId:  number | string,
 *   userId?:     number | string | null,
 *   campaignId:  number | string,
 *   actionId:    number | string,
 *   amount:      number | string,
 * }} payload
 * @returns {string}  64-character lowercase hex digest
 */
export function generateIdempotencyKey({ merchantId, userId, campaignId, actionId, amount }) {
  const canonical = JSON.stringify({
    merchantId: String(merchantId),
    userId:     userId != null ? String(userId) : null,
    campaignId: String(campaignId),
    actionId:   String(actionId),
    amount:     String(amount),
  });

  return crypto
    .createHmac('sha256', IDEMPOTENCY_HMAC_SECRET)
    .update(canonical)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Enqueue a reward issuance job
// ---------------------------------------------------------------------------

/**
 * Enqueues a reward issuance job.
 *
 * The idempotency key is generated internally via HMAC-SHA256 over the
 * canonical payload — callers must NOT supply a raw key string.
 *
 * @param {{
 *   merchantId:    number | string,
 *   campaignId:    number,
 *   userId?:       number | null,
 *   actionId:      number | string,
 *   walletAddress: string,
 *   amount:        number | string,
 * }} params
 * @returns {Promise<{ queued: boolean, issuanceId?: number, duplicate?: boolean }>}
 */
export async function enqueueRewardIssuance(params) {
  const { merchantId, campaignId, userId, actionId, walletAddress, amount } = params;

  const idempotencyKey = generateIdempotencyKey({
    merchantId,
    userId,
    campaignId,
    actionId,
    amount,
  });

  // Check for existing record — return early if already processed
  const existing = await getIssuanceByKey(idempotencyKey);
  if (existing) {
    return { queued: false, duplicate: true, issuanceId: existing.id, status: existing.status };
  }

  // Persist pending record before enqueuing (guarantees DB row exists when worker runs)
  const issuanceParams = { idempotencyKey, campaignId, userId, walletAddress, amount };
  const issuance = await createIssuance(issuanceParams);
  if (!issuance) {
    // Race condition: another process inserted the same key
    const race = await getIssuanceByKey(idempotencyKey);
    return { queued: false, duplicate: true, issuanceId: race?.id, status: race?.status };
  }

  await rewardIssuanceQueue.add(
    'issue-reward',
    { issuanceId: issuance.id, ...issuanceParams },
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
export async function processRewardIssuance(job) {
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

    // Invalidate balance cache for the beneficiary wallet
    await cacheService.invalidateBalanceCache(walletAddress);

    return { confirmed: true, txHash };
  } catch (err) {
    // On the final attempt, mark as failed; otherwise let BullMQ retry
    if (job.attemptsMade >= (job.opts.attempts ?? 3) - 1) {
      await markFailed(issuanceId, err.message);
    }
    throw err; // re-throw so BullMQ handles backoff / dead-letter
  }
}
