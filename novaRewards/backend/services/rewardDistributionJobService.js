const crypto = require('crypto');

const DEFAULT_QUEUE_KEY = 'reward-distribution:queue';
const DEFAULT_JOB_KEY_PREFIX = 'reward-distribution:job:';
const DEFAULT_MAX_RETRIES = 3;

function createRewardDistributionJobService({
  redis,
  processRecipient,
  queueKey = DEFAULT_QUEUE_KEY,
  jobKeyPrefix = DEFAULT_JOB_KEY_PREFIX,
  maxRetries = DEFAULT_MAX_RETRIES,
}) {
  if (!redis) {
    throw new Error('redis client is required');
  }

  if (typeof processRecipient !== 'function') {
    throw new Error('processRecipient must be a function');
  }

  function getJobKey(jobId) {
    return `${jobKeyPrefix}${jobId}`;
  }

  async function saveJob(job) {
    job.updatedAt = new Date().toISOString();
    await redis.set(getJobKey(job.id), JSON.stringify(job));
    return job;
  }

  async function getJobStatus(jobId) {
    const raw = await redis.get(getJobKey(jobId));
    return raw ? JSON.parse(raw) : null;
  }

  async function enqueueJob({
    merchantId,
    campaignId,
    amount,
    recipients,
    metadata = {},
  }) {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('recipients must be a non-empty array');
    }

    const normalizedRecipients = recipients.map((recipient) => (
      typeof recipient === 'string' ? { id: recipient } : recipient
    ));

    const job = {
      id: crypto.randomUUID(),
      merchantId: merchantId ?? null,
      campaignId: campaignId ?? null,
      amount,
      metadata,
      status: 'queued',
      recipients: normalizedRecipients,
      pendingRecipients: normalizedRecipients,
      successfulRecipients: [],
      failedRecipients: [],
      failureHistory: [],
      retryCount: 0,
      attemptsMade: 0,
      maxRetries,
      lastError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };

    await saveJob(job);
    await redis.rPush(queueKey, job.id);
    return job;
  }

  async function processNextJob() {
    const jobId = await redis.lPop(queueKey);
    if (!jobId) return null;

    const job = await getJobStatus(jobId);
    if (!job) return null;

    job.status = 'processing';
    job.attemptsMade += 1;
    job.startedAt = job.startedAt || new Date().toISOString();
    job.failedRecipients = [];
    job.lastError = null;
    await saveJob(job);

    const successes = [];
    const failures = [];

    for (const recipient of job.pendingRecipients) {
      try {
        await processRecipient({
          jobId: job.id,
          merchantId: job.merchantId,
          campaignId: job.campaignId,
          amount: job.amount,
          recipient,
          metadata: job.metadata,
          attemptNumber: job.attemptsMade,
        });
        successes.push(recipient);
      } catch (error) {
        failures.push({
          recipient,
          message: error.message,
        });
      }
    }

    if (successes.length > 0) {
      const seen = new Set(job.successfulRecipients.map((recipient) => recipient.id));
      for (const recipient of successes) {
        if (!seen.has(recipient.id)) {
          job.successfulRecipients.push(recipient);
          seen.add(recipient.id);
        }
      }
    }

    if (failures.length === 0) {
      job.pendingRecipients = [];
      job.failedRecipients = [];
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      await saveJob(job);
      return job;
    }

    job.failedRecipients = failures;
    job.failureHistory.push({
      attemptNumber: job.attemptsMade,
      failures,
      recordedAt: new Date().toISOString(),
    });
    job.lastError = failures[0].message;

    if (job.retryCount < job.maxRetries) {
      job.retryCount += 1;
      job.status = 'retrying';
      job.pendingRecipients = failures.map((failure) => failure.recipient);
      await saveJob(job);
      await redis.rPush(queueKey, job.id);
      return job;
    }

    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.pendingRecipients = failures.map((failure) => failure.recipient);
    await saveJob(job);
    return job;
  }

  async function getQueueLength() {
    return redis.lLen(queueKey);
  }

  async function clearAll() {
    const jobIds = await redis.lRange(queueKey, 0, -1);
    const keys = jobIds.map((jobId) => getJobKey(jobId));
    await redis.del(queueKey);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  }

  return {
    enqueueJob,
    processNextJob,
    getJobStatus,
    getQueueLength,
    clearAll,
  };
}

module.exports = {
  DEFAULT_MAX_RETRIES,
  createRewardDistributionJobService,
};
