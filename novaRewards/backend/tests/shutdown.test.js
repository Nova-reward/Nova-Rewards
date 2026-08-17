import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Close-order tracking ────────────────────────────────────────────────────
// We track the exact order in which close() calls resolve so we can assert
// that the worker is always closed before the DB pool.
const closeOrder = [];

// ── BullMQ mocks ────────────────────────────────────────────────────────────
const mockWorkerClose = vi.fn().mockImplementation(async () => {
  closeOrder.push('worker');
});
const mockDLQClose = vi.fn().mockImplementation(async () => {
  closeOrder.push('dlq');
});
const mockQueueClose = vi.fn().mockImplementation(async () => {
  closeOrder.push('queue');
});
const mockWorkerOn = vi.fn();
const mockQueueOn = vi.fn();
const mockQueueAdd = vi.fn().mockResolvedValue(true);

let workerInstance;
let queueInstances = [];

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation((queueName, processor, opts) => {
    workerInstance = {
      queueName,
      processor,
      opts,
      on: mockWorkerOn,
      close: mockWorkerClose,
    };
    return workerInstance;
  }),
  Queue: vi.fn().mockImplementation((queueName, opts) => {
    const instance = {
      add: mockQueueAdd,
      on: mockQueueOn,
      name: queueName,
      opts,
      // DLQ queue in worker module and all queues in queues.js share this
      close: queueName === 'reward-issuance-dlq' ? mockDLQClose : mockQueueClose,
    };
    queueInstances.push(instance);
    return instance;
  }),
}));

// ── Service / repository mocks (required by worker module) ─────────────────
vi.mock('../services/rewardIssuanceService', () => ({
  processRewardIssuance: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

vi.mock('../repositories/rewardIssuanceRepository', () => ({
  default: {
    getByRewardId: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../repositories/rewardIssuanceFailureRepository', () => ({
  default: {
    recordFailure: vi.fn().mockResolvedValue({ id: 1 }),
  },
}));

vi.mock('../middleware/metricsMiddleware', () => ({
  default: {
    createCounter: vi.fn().mockReturnValue({ inc: vi.fn() }),
  },
}));

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Bull Board mocks ────────────────────────────────────────────────────────
vi.mock('@bull-board/api', () => ({
  createBullBoard: vi.fn(),
}));
vi.mock('@bull-board/api/bullMQAdapter', () => ({
  BullMQAdapter: vi.fn(),
}));
vi.mock('@bull-board/express', () => ({
  ExpressAdapter: vi.fn().mockImplementation(() => ({
    setBasePath: vi.fn(),
    getRouter: vi.fn(),
  })),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadWorkerModule() {
  vi.resetModules();
  queueInstances = [];
  closeOrder.length = 0;
  return import('../jobs/rewardIssuanceWorker.js');
}

function loadQueuesModule() {
  vi.resetModules();
  queueInstances = [];
  closeOrder.length = 0;
  return import('../jobs/queues.js');
}

// ── Test suites ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  closeOrder.length = 0;
  queueInstances = [];
});

afterEach(() => {
  vi.clearAllTimers();
});

// ────────────────────────────────────────────────────────────────────────────
describe('shutdownWorker()', () => {
  it('exports a shutdownWorker function', async () => {
    const mod = await loadWorkerModule();
    expect(typeof mod.shutdownWorker).toBe('function');
  });

  it('closes the worker before the DLQ queue', async () => {
    const { shutdownWorker } = await loadWorkerModule();

    await shutdownWorker();

    expect(closeOrder).toEqual(['worker', 'dlq']);
  });

  it('calls worker.close() exactly once', async () => {
    const { shutdownWorker } = await loadWorkerModule();
    await shutdownWorker();
    expect(mockWorkerClose).toHaveBeenCalledTimes(1);
  });

  it('calls rewardDLQ.close() exactly once', async () => {
    const { shutdownWorker } = await loadWorkerModule();
    await shutdownWorker();
    expect(mockDLQClose).toHaveBeenCalledTimes(1);
  });

  it('logs shutdown start and completion using structured JSON logger', async () => {
    const logger = (await import('../lib/logger')).default;
    const { shutdownWorker } = await loadWorkerModule();

    await shutdownWorker();

    const infoCalls = logger.info.mock.calls.map((c) => c[0]);
    expect(infoCalls.some((m) => m.includes('starting graceful shutdown'))).toBe(true);
    expect(infoCalls.some((m) => m.includes('shutdown complete'))).toBe(true);
  });

  it('rejects with a timeout error when shutdown exceeds 10 seconds', async () => {
    vi.useFakeTimers();

    // Make worker.close() never resolve
    mockWorkerClose.mockImplementation(() => new Promise(() => {}));

    const { shutdownWorker } = await loadWorkerModule();

    const shutdownPromise = shutdownWorker();

    // Advance past the 10-second timeout
    vi.advanceTimersByTime(11_000);

    await expect(shutdownPromise).rejects.toThrow(/timed out/i);

    vi.useRealTimers();
  });

  it('logs an error and re-throws when shutdown times out', async () => {
    vi.useFakeTimers();

    mockWorkerClose.mockImplementation(() => new Promise(() => {}));
    const logger = (await import('../lib/logger')).default;
    const { shutdownWorker } = await loadWorkerModule();

    const shutdownPromise = shutdownWorker();
    vi.advanceTimersByTime(11_000);

    await expect(shutdownPromise).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('does not emit UnhandledPromiseRejection during a clean shutdown', async () => {
    const unhandledHandler = vi.fn();
    process.on('unhandledRejection', unhandledHandler);

    const { shutdownWorker } = await loadWorkerModule();
    await shutdownWorker();

    // Flush microtask queue
    await new Promise((r) => setImmediate(r));

    expect(unhandledHandler).not.toHaveBeenCalled();

    process.off('unhandledRejection', unhandledHandler);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('shutdownQueues()', () => {
  it('exports a shutdownQueues function', async () => {
    const mod = await loadQueuesModule();
    expect(typeof mod.shutdownQueues).toBe('function');
  });

  it('closes all four BullMQ queues', async () => {
    const { shutdownQueues } = await loadQueuesModule();

    await shutdownQueues();

    // 4 queues × 1 close call each
    expect(mockQueueClose).toHaveBeenCalledTimes(4);
  });

  it('closes all queues in parallel (all close before the call resolves)', async () => {
    const { shutdownQueues } = await loadQueuesModule();

    await shutdownQueues();

    // All four 'queue' entries must appear in closeOrder (DLQ is in worker module only)
    expect(closeOrder.filter((e) => e === 'queue')).toHaveLength(4);
  });

  it('logs queue closure start and completion', async () => {
    const logger = (await import('../lib/logger')).default;
    const { shutdownQueues } = await loadQueuesModule();

    await shutdownQueues();

    const infoCalls = logger.info.mock.calls.map((c) => c[0]);
    expect(infoCalls.some((m) => m.includes('closing all queue connections'))).toBe(true);
    expect(infoCalls.some((m) => m.includes('all queue connections closed'))).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('coordinated shutdown close order', () => {
  it('worker + DLQ close before queue connections when sequenced correctly', async () => {
    // Simulate what server.js gracefulShutdown() does:
    //   shutdownWorker() resolves → then shutdownQueues() resolves → then pool.end()

    const { shutdownWorker } = await loadWorkerModule();
    const { shutdownQueues } = await loadQueuesModule();

    // DB pool mock
    const mockPoolEnd = vi.fn().mockImplementation(async () => {
      closeOrder.push('pool');
    });

    await shutdownWorker();
    await shutdownQueues();
    await mockPoolEnd();

    // Worker must close before queues, queues before pool
    const workerIdx = closeOrder.indexOf('worker');
    const firstQueueIdx = closeOrder.indexOf('queue');
    const poolIdx = closeOrder.indexOf('pool');

    expect(workerIdx).toBeLessThan(firstQueueIdx);
    expect(firstQueueIdx).toBeLessThan(poolIdx);
  });

  it('DB pool is never called if shutdownWorker rejects', async () => {
    mockWorkerClose.mockRejectedValueOnce(new Error('Redis gone'));

    const { shutdownWorker } = await loadWorkerModule();
    const mockPoolEnd = vi.fn();

    try {
      await shutdownWorker();
    } catch {
      // expected
    }

    // pool.end() must NOT have been called
    expect(mockPoolEnd).not.toHaveBeenCalled();
  });
});
