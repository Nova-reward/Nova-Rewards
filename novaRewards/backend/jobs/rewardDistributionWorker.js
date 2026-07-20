'use strict';

const { Worker } = require('bullmq');
const { processCampaignDistribution } = require('../services/campaignDistributionService');
const logger = require('../lib/logger');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
};

const worker = new Worker(
  'reward-distribution',
  async (job) => {
    const { campaignId, recipients, defaultAmount } = job.data;

    logger.info('[DistributionWorker] starting job', {
      jobId: job.id,
      campaignId,
      recipientCount: recipients.length,
    });

    const result = await processCampaignDistribution({ campaignId, recipients, defaultAmount });

    logger.info('[DistributionWorker] job finished', {
      jobId: job.id,
      campaignId,
      succeeded: result.succeeded.length,
      failed: result.failed.length,
    });

    return result;
  },
  {
    connection,
    concurrency: parseInt(process.env.DISTRIBUTION_WORKER_CONCURRENCY) || 2,
  },
);

worker.on('failed', (job, err) => {
  logger.error('[DistributionWorker] job failed', {
    jobId: job?.id,
    campaignId: job?.data?.campaignId,
    error: err.message,
  });
});

worker.on('error', (err) => {
  logger.error('[DistributionWorker] worker error', { error: err.message });
});

module.exports = { worker };
