const { Queue } = require('bullmq');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const rewardIssuanceFailureRepository = require('../repositories/rewardIssuanceFailureRepository');
const metricsMiddleware = require('../middleware/metricsMiddleware');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
};

// ── Prometheus Counter ──────────────────────────────────────────────
const novaRewardDlqTotal = metricsMiddleware.createCounter(
  'nova_reward_dlq_total',
  'Total number of reward issuance jobs moved to DLQ after max retries',
  ['reason']
);

// Define queues with specific retry logic
const rewardIssuanceQueue = new Queue('reward-issuance', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false, // Keep failed jobs so the DLQ handler can process them
  },
});

// ── DLQ Event Handler ─────────────────────────────────────────────
// Persist permanently failed jobs to DB + Prometheus before removing from Redis
rewardIssuanceQueue.on('failed', async (job, err) => {
  const maxAttempts = job.opts?.attempts ?? 3;
  if (job.attemptsMade < maxAttempts) {
    return; // Will be retried, not DLQ yet
  }

  const reason = err?.name || err?.message || 'unknown';
  novaRewardDlqTotal.inc({ reason });

  try {
    await rewardIssuanceFailureRepository.recordFailure({
      jobId: job.id,
      payload: job.data,
      error: err,
      attempts: job.attemptsMade,
    });

    // Remove from Redis to prevent bloat; failure is now in DB
    await job.remove();

    logger.error('[RewardWorker] job permanently failed — moved to DLQ', {
      jobId: job.id,
      attempts: job.attemptsMade,
      error: err.message,
    });
  } catch (dlqErr) {
    // Critical: DLQ persistence itself failed. Alert immediately.
    logger.error('[RewardWorker] DLQ-CRITICAL: failed to persist DLQ entry', {
      jobId: job.id,
      dlqError: dlqErr.message,
    });
    // Do NOT remove job from queue so it doesn't disappear silently
  }
});

const transactionSubmissionQueue = new Queue('transaction-submission', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
  },
});

const webhookDeliveryQueue = new Queue('webhook-delivery', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
  },
});

// Campaign-level bulk distribution — one job per distribute request.
// removeOnComplete/removeOnFailed use count-based retention so GET /api/jobs/:jobId
// can query results after the job finishes.
const rewardDistributionQueue = new Queue('reward-distribution', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 500 },
    removeOnFailed: { count: 500 },
  },
});

// Setup Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(rewardIssuanceQueue),
    new BullMQAdapter(transactionSubmissionQueue),
    new BullMQAdapter(webhookDeliveryQueue),
    new BullMQAdapter(rewardDistributionQueue),
  ],
  serverAdapter: serverAdapter,
});

module.exports = {
  rewardIssuanceQueue,
  transactionSubmissionQueue,
  webhookDeliveryQueue,
  rewardDistributionQueue,
  serverAdapter,
  novaRewardDlqTotal,
};