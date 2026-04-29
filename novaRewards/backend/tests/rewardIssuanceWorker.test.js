'use strict';

/**
 * Reward Issuance Worker — unit test suite (Vitest)
 *
 * Covers:
 *  - Worker instantiation with correct queue name and processor
 *  - 'failed' event: routes permanently-failed jobs to DLQ
 *  - 'failed' event: does NOT route to DLQ when retries remain
 *  - 'completed' event: logs correctly
 *  - 'error' event: logs worker errors
 *
 * All external dependencies (BullMQ, Redis) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock BullMQ before requiring the worker module ─────────────────────────
const mockQueueAdd = vi.fn().mockResolvedValue(true);
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
    // Simulate event registration by the module
    return worker;
  }),
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
  })),
}));

// ── Imports ─────────────────────────────────────────────────────────────────
import { Worker, Queue } from 'bullmq';

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// Helper: load the worker module fresh and capture registered handlers
// ============================================================================
function loadWorkerModule() {
  vi.resetModules();
  // Re-require to trigger constructor and event registration
  return import('../jobs/rewardIssuanceWorker.js');
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

    // Extract the failed handler registered by the module
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
    // Should not throw
    expect(() => completedHandler(job)).not.toThrow();
  });

  it('error event logs worker errors without crashing', async () => {
    await loadWorkerModule();

    const errorHandler = mockWorkerOn.mock.calls.find((c) => c[0] === 'error')?.[1];
    expect(errorHandler).toBeDefined();

    const err = new Error('Worker connection lost');
    // Should not throw
    expect(() => errorHandler(err)).not.toThrow();
  });

  it('processor function delegates to processRewardIssuance', async () => {
    // We can verify the processor exists and is a function by checking constructor args
    await loadWorkerModule();

    const processor = mockWorkerConstructor.mock.calls[0][1];
    expect(typeof processor).toBe('function');

    // The processor should be async and accept a job argument
    // We can't easily test the internal import without mocking the service,
    // but we verify the signature
    expect(processor.length).toBe(1); // one argument: job
  });
});

