/**
 * BullMQ worker for the reward-issuance queue.
 * Registers the processor and handles dead-letter (permanently failed) jobs.
 *
 * Shutdown order (coordinated with server.js):
 *   1. worker.close()    — drains in-flight jobs and stops accepting new ones
 *   2. rewardDLQ.close() — closes the DLQ queue connection
 *   (DB pool is closed afterwards by server.js once this resolves)
 */

const { Worker, Queue } = require('bullmq');
const { processRewardIssuance } = require('../services/rewardIssuanceService');
const rewardIssuanceRepository = require('../db/rewardIssuanceRepository');
const { handleRewardIssuanceFailure } = require('./queues');
const logger = require('../lib/logger');

/** Maximum milliseconds to wait for the worker + DLQ to close cleanly. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
};

// Dead-letter queue — receives jobs that exhausted all retries
const rewardDLQ = new Queue('reward-issuance-dlq', { connection });

const worker = new Worker(
  'reward-issuance',
  async (job) => {
    // ── Idempotency guard ───────────────────────────────────────
    const { rewardId } = job.data;
    if (rewardId) {
      const existing = await rewardIssuanceRepository.getByRewardId(rewardId);
      if (existing?.status === 'completed') {
        logger.info('[RewardWorker] Reward already issued; skipping', { rewardId, jobId: job.id });
        return { status: 'skipped', rewardId };
      }
    }

    return processRewardIssuance(job);
  },
  {
    connection,
    concurrency: parseInt(process.env.REWARD_WORKER_CONCURRENCY) || 5,
  }
);

worker.on('failed', async (job, err) => {
  if (!job) return;
  const maxAttempts = job.opts?.attempts ?? 3;
  if (job.attemptsMade >= maxAttempts) {
    logger.error('[RewardWorker] job permanently failed', {
      jobId: job.id,
      attempts: job.attemptsMade,
      error: err.message,
    });
    await rewardDLQ.add('dead-letter', { ...job.data, failedReason: err.message });

    // Persist to reward_issuance_failures + increment the Prometheus counter.
    // This is the event that actually fires in production — see the NOTE on
    // handleRewardIssuanceFailure in queues.js.
    await handleRewardIssuanceFailure(job, err);
  }
});

worker.on('completed', (job) => {
  logger.info('[RewardWorker] job completed', { jobId: job.id });
});

worker.on('error', (err) => {
  logger.error('[RewardWorker] worker error', { error: err.message });
});

/**
 * Gracefully shuts down the BullMQ worker and DLQ queue.
 *
 * Called by the coordinated shutdown sequence in server.js BEFORE the DB
 * pool is closed, so any in-flight DLQ persistence completes safely.
 *
 * Enforces a {@link SHUTDOWN_TIMEOUT_MS} ms timeout so the process never
 * hangs indefinitely waiting for Redis.
 *
 * @returns {Promise<void>}
 */
async function shutdownWorker() {
  logger.info('[RewardWorker] starting graceful shutdown', { timeoutMs: SHUTDOWN_TIMEOUT_MS });

  const closeWork = async () => {
    logger.info('[RewardWorker] closing worker…');
    await worker.close();
    logger.info('[RewardWorker] worker closed');

    logger.info('[RewardWorker] closing DLQ queue…');
    await rewardDLQ.close();
    logger.info('[RewardWorker] DLQ queue closed');
  };

  const timeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`[RewardWorker] shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms`)),
      SHUTDOWN_TIMEOUT_MS
    )
  );

  try {
    await Promise.race([closeWork(), timeout]);
    logger.info('[RewardWorker] shutdown complete');
  } catch (err) {
    logger.error('[RewardWorker] shutdown error', { error: err.message });
    throw err;
  }
}

module.exports = { worker, rewardDLQ, shutdownWorker };
