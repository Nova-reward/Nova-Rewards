const net = require('net');

function canReachRedis(host, port, timeoutMs = 300) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
  });
}

const redisUrl = process.env.TEST_REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const parsedRedisUrl = new URL(redisUrl);
const redisHost = parsedRedisUrl.hostname;
const redisPort = parseInt(parsedRedisUrl.port || '6379', 10);
const requireRedis = process.env.REQUIRE_REDIS_FOR_TESTS === '1';

let createClient;

try {
  ({ createClient } = require('redis'));
} catch {
  // Skip the suite when backend dependencies are not installed locally.
}

const describeRedis = createClient ? describe : describe.skip;

describeRedis('reward distribution job service (Redis integration)', () => {
  const {
    createRewardDistributionJobService,
    DEFAULT_MAX_RETRIES,
  } = require('../services/rewardDistributionJobService');

  let redisAvailable = false;
  let redis;
  let service;
  let processor;
  let queueKey;
  let jobKeyPrefix;

  beforeAll(async () => {
    redisAvailable = await canReachRedis(redisHost, redisPort);
    if (!redisAvailable) {
      if (requireRedis) {
        throw new Error(`Redis is required for this suite but no server was reachable at ${redisUrl}`);
      }
      console.warn(`Skipping Redis integration assertions: no Redis server reachable at ${redisUrl}`);
      return;
    }

    redis = createClient({ url: redisUrl });
    await redis.connect();
  });

  afterAll(async () => {
    if (redis?.isOpen) {
      await redis.quit();
    }
  });

  beforeEach(async () => {
    if (!redisAvailable) return;

    processor = jest.fn();
    queueKey = `test:reward-distribution:queue:${Date.now()}:${Math.random()}`;
    jobKeyPrefix = `test:reward-distribution:job:${Date.now()}:${Math.random()}:`;
    service = createRewardDistributionJobService({
      redis,
      processRecipient: (payload) => processor(payload),
      queueKey,
      jobKeyPrefix,
    });
    await redis.del(queueKey);
  });

  afterEach(async () => {
    if (!redisAvailable) return;

    const keys = await redis.keys(`${jobKeyPrefix}*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }
    await redis.del(queueKey);
    jest.clearAllMocks();
  });

  test('retries a failed job up to 3 times before a later success completes it', async () => {
    if (!redisAvailable) return;

    processor
      .mockRejectedValueOnce(new Error('temporary failure 1'))
      .mockRejectedValueOnce(new Error('temporary failure 2'))
      .mockRejectedValueOnce(new Error('temporary failure 3'))
      .mockResolvedValueOnce({ txHash: 'tx-4' });

    const job = await service.enqueueJob({
      merchantId: 10,
      campaignId: 42,
      amount: '50',
      recipients: [{ id: 'wallet-1' }],
    });

    for (let attempt = 1; attempt <= DEFAULT_MAX_RETRIES; attempt += 1) {
      const processed = await service.processNextJob();
      expect(processed.status).toBe('retrying');
      expect(processed.retryCount).toBe(attempt);
      expect(await service.getQueueLength()).toBe(1);
    }

    const completed = await service.processNextJob();
    const status = await service.getJobStatus(job.id);

    expect(completed.status).toBe('completed');
    expect(status.status).toBe('completed');
    expect(status.retryCount).toBe(3);
    expect(status.attemptsMade).toBe(4);
    expect(status.successfulRecipients).toEqual([{ id: 'wallet-1' }]);
    expect(status.failureHistory).toHaveLength(3);
    expect(await service.getQueueLength()).toBe(0);
    expect(processor).toHaveBeenCalledTimes(4);
  });

  test('marks a job as failed after it exhausts all retries', async () => {
    if (!redisAvailable) return;

    processor.mockRejectedValue(new Error('permanent failure'));

    const job = await service.enqueueJob({
      merchantId: 11,
      campaignId: 99,
      amount: '75',
      recipients: [{ id: 'wallet-fail' }],
    });

    for (let attempt = 1; attempt <= DEFAULT_MAX_RETRIES; attempt += 1) {
      const processed = await service.processNextJob();
      expect(processed.status).toBe('retrying');
      expect(processed.retryCount).toBe(attempt);
    }

    const failed = await service.processNextJob();
    const status = await service.getJobStatus(job.id);

    expect(failed.status).toBe('failed');
    expect(status.status).toBe('failed');
    expect(status.retryCount).toBe(3);
    expect(status.attemptsMade).toBe(4);
    expect(status.failedRecipients).toEqual([
      {
        recipient: { id: 'wallet-fail' },
        message: 'permanent failure',
      },
    ]);
    expect(await service.getQueueLength()).toBe(0);
  });

  test('records partial failures and retries only the recipients that still failed', async () => {
    if (!redisAvailable) return;

    const failuresByRecipient = new Map([
      ['wallet-b', 1],
    ]);

    processor.mockImplementation(async ({ recipient }) => {
      const remainingFailures = failuresByRecipient.get(recipient.id) || 0;
      if (remainingFailures > 0) {
        failuresByRecipient.set(recipient.id, remainingFailures - 1);
        throw new Error(`failed:${recipient.id}`);
      }
      return { txHash: `tx:${recipient.id}` };
    });

    const job = await service.enqueueJob({
      merchantId: 12,
      campaignId: 77,
      amount: '10',
      recipients: [{ id: 'wallet-a' }, { id: 'wallet-b' }, { id: 'wallet-c' }],
    });

    const firstPass = await service.processNextJob();
    const firstStatus = await service.getJobStatus(job.id);

    expect(firstPass.status).toBe('retrying');
    expect(firstStatus.successfulRecipients).toEqual([{ id: 'wallet-a' }, { id: 'wallet-c' }]);
    expect(firstStatus.failedRecipients).toEqual([
      {
        recipient: { id: 'wallet-b' },
        message: 'failed:wallet-b',
      },
    ]);
    expect(firstStatus.pendingRecipients).toEqual([{ id: 'wallet-b' }]);

    const secondPass = await service.processNextJob();
    const finalStatus = await service.getJobStatus(job.id);

    expect(secondPass.status).toBe('completed');
    expect(finalStatus.status).toBe('completed');
    expect(finalStatus.successfulRecipients).toEqual([
      { id: 'wallet-a' },
      { id: 'wallet-c' },
      { id: 'wallet-b' },
    ]);
    expect(finalStatus.failureHistory).toHaveLength(1);
    expect(processor).toHaveBeenCalledTimes(4);
  });

  test('job status is queryable and reflects queued, processing, and completed states', async () => {
    if (!redisAvailable) return;

    let releaseProcessing;
    const processingGate = new Promise((resolve) => {
      releaseProcessing = resolve;
    });

    processor.mockImplementation(async () => {
      await processingGate;
      return { txHash: 'tx-gated' };
    });

    const job = await service.enqueueJob({
      merchantId: 13,
      campaignId: 88,
      amount: '15',
      recipients: [{ id: 'wallet-status' }],
    });

    const queuedStatus = await service.getJobStatus(job.id);
    expect(queuedStatus.status).toBe('queued');

    const inFlight = service.processNextJob();
    await new Promise((resolve) => setImmediate(resolve));

    const processingStatus = await service.getJobStatus(job.id);
    expect(processingStatus.status).toBe('processing');
    expect(processingStatus.attemptsMade).toBe(1);

    releaseProcessing();
    await inFlight;

    const completedStatus = await service.getJobStatus(job.id);
    expect(completedStatus.status).toBe('completed');
    expect(completedStatus.completedAt).toEqual(expect.any(String));
  });
});
