const { Queue } = require('bullmq');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
};

// Define queues with specific retry logic
const rewardIssuanceQueue = new Queue('reward-issuance', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
  },
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

// Setup Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(rewardIssuanceQueue),
    new BullMQAdapter(transactionSubmissionQueue),
    new BullMQAdapter(webhookDeliveryQueue),
  ],
  serverAdapter: serverAdapter,
});

module.exports = {
  rewardIssuanceQueue,
  transactionSubmissionQueue,
  webhookDeliveryQueue,
  serverAdapter,
};
