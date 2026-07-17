/**
 * BullMQ worker for the reward-issuance queue.
 * Registers the processor and handles dead-letter (permanently failed) jobs.
 */

const { Worker, Queue } = require('bullmq');
const { processRewardIssuance } = require('../services/rewardIssuanceService');
const rewardIssuanceRepository = require('../repositories/rewardIssuanceRepository');
const logger = require('../lib/logger');

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
    logger.error('[RewardWorker] job permanently failed', { jobId: job.id, attempts: job.attemptsMade, error: err.message });
    await rewardDLQ.add('dead-letter', { ...job.data, failedReason: err.message });
  }
});

worker.on('completed', (job) => {
  logger.info('[RewardWorker] job completed', { jobId: job.id });
});

worker.on('error', (err) => {
  logger.error('[RewardWorker] worker error', { error: err.message });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[RewardWorker] SIGTERM received, closing...');
  await worker.close();
  await rewardDLQ.close();
  process.exit(0);
});

module.exports = { worker, rewardDLQ };