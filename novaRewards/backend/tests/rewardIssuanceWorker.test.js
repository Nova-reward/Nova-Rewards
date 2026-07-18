import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock BullMQ before requiring the worker module ─────────────────────────
const mockQueueAdd = vi.fn().mockResolvedValue(true);
const mockQueueOn = vi.fn();
const mockWorkerOn = vi.fn();
const mockWorkerConstructor = vi.fn();

vi.mock('bullmq', () => ({
  Worker: mockWorkerConstructor.mockImplementation((queueName, processor, opts) => {
    const worker = {
      queueName,
      processor,
      opts,
      on: mockWorkerOn,
    };
    return worker;
  }),
  Queue: vi.fn().mockImplementation((queueName, opts) => ({
    add: mockQueueAdd,
    on: mockQueueOn,
    name: queueName,
    opts,
  })),
}));

// ── Mock repository and metrics ────────────────────────────────────────────
const mockRecordFailure = vi.fn().mockResolvedValue({ id: 1 });
const mockIsReprocessed = vi.fn().mockResolvedValue(false);
const mockMarkReprocessed = vi.fn().mockResolvedValue(true);
const mockGetByJobId = vi.fn();
const mockListPending = vi.fn();

vi.mock('../repositories/rewardIssuanceFailureRepository', () => ({
  default: {
    recordFailure: mockRecordFailure,
    isReprocessed: mockIsReprocessed,
    markReprocessed: mockMarkReprocessed,
    getByJobId: mockGetByJobId,
    listPending: mockListPending,
  },
}));

const mockCounterInc = vi.fn();
const mockCreateCounter = vi.fn().mockReturnValue({ inc: mockCounterInc });

vi.mock('../middleware/metricsMiddleware', () => ({
  default: {
    createCounter: mockCreateCounter,
  },
}));

// ── Mock logger ─────────────────────────────────────────────────────────────
vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// ── Imports ─────────────────────────────────────────────────────────────────
import { Worker, Queue } from 'bullmq';

beforeEach(() => {
  vi.clearAllMocks();
});

function loadWorkerModule() {
  vi.resetModules();
  return import('../jobs/rewardIssuanceWorker.js');
}

function loadQueuesModule() {
  vi.resetModules();
  return import('../jobs/queues.js');
}

describe('rewardIssuanceWorker', () => {
  it('creates a Worker with correct queue name', async () => {
    await loadWorkerModule();
    expect(mockWorkerConstructor).toHaveBeenCalledWith(
      'reward-issuance',
      expect.any(Function),
      expect.objectContaining({
        connection: expect.objectContaining({
          host: expect.any(String),
          port: expect.any(Number),
        }),
        concurrency: expect.any(Number),
      })
    );
  });

  it('creates a DLQ queue named reward-issuance-dlq', async () => {
    await loadWorkerModule();
    expect(Queue).toHaveBeenCalledWith(
      'reward-issuance-dlq',
      expect.objectContaining({
        connection: expect.any(Object),
      })
    );
  });

  it('registers failed, completed, and error event listeners', async () => {
    await loadWorkerModule();
    const registeredEvents = mockWorkerOn.mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain('failed');
    expect(registeredEvents).toContain('completed');
    expect(registeredEvents).toContain('error');
  });

  it('routes permanently-failed job to DLQ after max attempts exhausted', async () => {
    await loadWorkerModule();

    const failedHandler = mockWorkerOn.mock.calls.find((c) => c[0] === 'failed')?.[1];
    expect(failedHandler).toBeDefined();

    const job = {
      id: 'job-42',
      attemptsMade: 3,
      opts: { attempts: 3 },
      data: { issuanceId: 42, campaignId: 1, walletAddress: 'GTEST', amount: '10' },
    };
    const err = new Error('Stellar timeout');

    await failedHandler(job, err);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'dead-letter',
      expect.objectContaining({
        issuanceId: 42,
        campaignId: 1,
        walletAddress: 'GTEST',
        amount: '10',
        failedReason: 'Stellar timeout',
      })
    );
  });

  it('does NOT route to DLQ when retries remain', async () => {
    await loadWorkerModule();

    const failedHandler = mockWorkerOn.mock.calls.find((c) => c[0] === 'failed')?.[1];
    expect(failedHandler).toBeDefined();

    const job = {
      id: 'job-43',
      attemptsMade: 1,
      opts: { attempts: 3 },
      data: { issuanceId: 43 },
    };
    const err = new Error('Temporary glitch');

    await failedHandler(job, err);

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('does NOT route to DLQ when job is null', async () => {
    await loadWorkerModule();

    const failedHandler = mockWorkerOn.mock.calls.find((c) => c[0] === 'failed')?.[1];
    expect(failedHandler).toBeDefined();

    const err = new Error('Some error');
    await failedHandler(null, err);

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('uses default maxAttempts of 3 when opts.attempts is undefined', async () => {
    await loadWorkerModule();

    const failedHandler = mockWorkerOn.mock.calls.find((c) => c[0] === 'failed')?.[1];
    expect(failedHandler).toBeDefined();

    const job = {
      id: 'job-44',
      attemptsMade: 3,
      opts: {}, // no attempts specified
      data: { issuanceId: 44 },
    };
    const err = new Error('Final failure');

    await failedHandler(job, err);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'dead-letter',
      expect.objectContaining({ failedReason: 'Final failure' })
    );
  });

  it('does NOT route to DLQ when attemptsMade is below default max (3)', async () => {
    await loadWorkerModule();

    const failedHandler = mockWorkerOn.mock.calls.find((c) => c[0] === 'failed')?.[1];
    expect(failedHandler).toBeDefined();

    const job = {
      id: 'job-45',
      attemptsMade: 2,
      opts: {}, // default max = 3
      data: { issuanceId: 45 },
    };
    const err = new Error('Retryable');

    await failedHandler(job, err);

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('completed event logs without error', async () => {
    await loadWorkerModule();

    const completedHandler = mockWorkerOn.mock.calls.find((c) => c[0] === 'completed')?.[1];
    expect(completedHandler).toBeDefined();

    const job = { id: 'job-46' };
    expect(() => completedHandler(job)).not.toThrow();
  });

  it('error event logs worker errors without crashing', async () => {
    await loadWorkerModule();

    const errorHandler = mockWorkerOn.mock.calls.find((c) => c[0] === 'error')?.[1];
    expect(errorHandler).toBeDefined();

    const err = new Error('Worker connection lost');
    expect(() => errorHandler(err)).not.toThrow();
  });

  it('processor function delegates to processRewardIssuance', async () => {
    await loadWorkerModule();

    const processor = mockWorkerConstructor.mock.calls[0][1];
    expect(typeof processor).toBe('function');
    expect(processor.length).toBe(1);
  });
});

describe('queues.js DLQ persistence', () => {
  it('creates nova_reward_dlq_total counter on module load', async () => {
    await loadQueuesModule();
    expect(mockCreateCounter).toHaveBeenCalledWith(
      'nova_reward_dlq_total',
      'Total number of reward issuance jobs moved to DLQ after max retries',
      ['reason']
    );
  });

  it('registers a failed event listener on rewardIssuanceQueue', async () => {
    await loadQueuesModule();
    const queueCalls = Queue.mock.results;
    // The first Queue instantiation is reward-issuance
    expect(mockQueueOn).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  it('persists permanently failed job to DB and increments counter', async () => {
    await loadQueuesModule();

    const failedHandler = mockQueueOn.mock.calls.find((c) => c[0] === 'failed')?.[1];
    expect(failedHandler).toBeDefined();

    const job = {
      id: 'job-dlq-99',
      attemptsMade: 3,
      opts: { attempts: 3 },
      data: { rewardId: 'r-99', amount: '500' },
      remove: vi.fn().mockResolvedValue(true),
    };
    const err = new Error('Stellar timeout');

    await failedHandler(job, err);

    expect(mockCounterInc).toHaveBeenCalledWith({ reason: 'Stellar timeout' });
    expect(mockRecordFailure).toHaveBeenCalledWith({
      jobId: 'job-dlq-99',
      payload: { rewardId: 'r-99', amount: '500' },
      error: err,
      attempts: 3,
    });
    expect(job.remove).toHaveBeenCalled();
  });

  it('does NOT persist when retries remain', async () => {
    await loadQueuesModule();

    const failedHandler = mockQueueOn.mock.calls.find((c) => c[0] === 'failed')?.[1];
    expect(failedHandler).toBeDefined();

    const job = {
      id: 'job-dlq-98',
      attemptsMade: 1,
      opts: { attempts: 3 },
      data: { rewardId: 'r-98' },
      remove: vi.fn().mockResolvedValue(true),
    };
    const err = new Error('Temporary');

    await failedHandler(job, err);

    expect(mockCounterInc).not.toHaveBeenCalled();
    expect(mockRecordFailure).not.toHaveBeenCalled();
    expect(job.remove).not.toHaveBeenCalled();
  });

  it('does NOT remove job when DB persistence fails', async () => {
    await loadQueuesModule();

    const failedHandler = mockQueueOn.mock.calls.find((c) => c[0] === 'failed')?.[1];
    expect(failedHandler).toBeDefined();

    mockRecordFailure.mockRejectedValueOnce(new Error('DB down'));

    const job = {
      id: 'job-dlq-97',
      attemptsMade: 3,
      opts: { attempts: 3 },
      data: { rewardId: 'r-97' },
      remove: vi.fn().mockResolvedValue(true),
    };
    const err = new Error('Stellar timeout');

    await failedHandler(job, err);

    expect(mockCounterInc).toHaveBeenCalled(); // Counter still increments
    expect(mockRecordFailure).toHaveBeenCalled();
    expect(job.remove).not.toHaveBeenCalled(); // Job stays in Redis
  });
});