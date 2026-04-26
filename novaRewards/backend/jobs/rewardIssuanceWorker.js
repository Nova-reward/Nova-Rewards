/**
 * BullMQ worker for the reward-issuance queue.
 * Registers the processor and handles dead-letter (permanently failed) jobs.
 */

const { Worker, Queue } = require('bullmq');
const { processRewardIssuance } = require('../services/rewardIssuanceService');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
};

// Dead-letter queue — receives jobs that exhausted all retries
const rewardDLQ = new Queue('reward-issuance-dlq', { connection });

const worker = new Worker(
  'reward-issuance',
  async (job) => processRewardIssuance(job),
  {
    connection,
    concurrency: parseInt(process.env.REWARD_WORKER_CONCURRENCY) || 5,
  }
);

worker.on('failed', async (job, err) => {
  if (!job) return;
  const maxAttempts = job.opts?.attempts ?? 3;
  if (job.attemptsMade >= maxAttempts) {
    console.error(`[RewardWorker] Job ${job.id} permanently failed after ${job.attemptsMade} attempts:`, err.message);
    await rewardDLQ.add('dead-letter', { ...job.data, failedReason: err.message });
  }
});

worker.on('completed', (job) => {
  console.log(`[RewardWorker] Job ${job.id} completed`);
});

worker.on('error', (err) => {
  console.error('[RewardWorker] Worker error:', err.message);
});

module.exports = { worker, rewardDLQ };
