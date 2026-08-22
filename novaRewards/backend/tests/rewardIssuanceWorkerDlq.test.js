'use strict';

/**
 * Integration tests: reward-issuance DLQ persistence path.
 *
 * Exercises the real BullMQ Worker + Queue against a real Redis instance and
 * the real `reward_issuance_failures` table against a real Postgres
 * instance — nothing here is mocked except `processRewardIssuance` (which
 * talks to Stellar).
 *
 * Requires the docker-compose test services:
 *   docker-compose -f docker-compose.test.yml up -d
 * ...and the `reward_issuance_failures` table (schema in
 * migrations/20260717000001_create_reward_issuance_failures.js) already
 * present in the target database — this repo doesn't currently have a
 * wired-up runner for that migration file, so create it manually against
 * your test DB if it's missing.
 *
 * rewardIssuanceWorker.js / jobs/queues.js read REDIS_HOST / REDIS_PORT
 * directly from process.env (default localhost:6379), and DATABASE_URL is
 * set by vitest.global-setup.js — override those in the environment if your
 * test services run elsewhere.
 *
 * By default the suite is skipped (with a warning) when Redis/Postgres
 * aren't reachable, matching tests/rewardDistributionJobService.redis.test.js.
 * Set REQUIRE_REDIS_FOR_TESTS=1 to fail hard instead of skipping (CI).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import net from 'net';
import crypto from 'crypto';

// ── Mock only the Stellar-talking processor; everything else (BullMQ,
// Postgres, the DLQ wiring) is real. ────────────────────────────────────
//
// rewardIssuanceWorker.js pulls this in via a plain CJS require(), reached
// through a dynamic import() rather than this file's own static import
// graph — vi.mock's hoisted interception doesn't reach a require() that
// deep, so instead we pre-seed Node's own require cache with a fake module
// before rewardIssuanceWorker.js ever requires the real one.
const mockProcessRewardIssuance = vi.fn();

function stubRequireCache(relativeSpecifier, fakeExports) {
  const resolvedPath = require.resolve(relativeSpecifier);
  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports: fakeExports,
  };
  return resolvedPath;
}

function canReach(host, port, timeoutMs = 500) {
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

async function pollUntil(conditionFn, { timeoutMs = 10000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await conditionFn();
    if (result) return result;
    if (Date.now() >= deadline) {
      throw new Error(`pollUntil: condition not met within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const requireInfra = process.env.REQUIRE_REDIS_FOR_TESTS === '1';

// Custom error type so the Prometheus `reason` label (which reads err.name)
// is something more meaningful than the generic "Error".
class StellarTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StellarTimeoutError';
  }
}

let infraAvailable = false;
let dbPool;
let queuesModule;
let workerModule;

async function insertedFailureFor(jobId) {
  const result = await dbPool.query('SELECT * FROM reward_issuance_failures WHERE job_id = $1', [jobId]);
  return result.rows[0] || null;
}

async function dlqCounterValue(reason) {
  const metric = await queuesModule.novaRewardDlqTotal.get();
  return metric.values.find((v) => v.labels?.reason === reason)?.value || 0;
}

beforeAll(async () => {
  const pgUrl = new URL(process.env.DATABASE_URL);
  const [redisUp, pgUp] = await Promise.all([
    canReach(REDIS_HOST, REDIS_PORT),
    canReach(pgUrl.hostname, parseInt(pgUrl.port || '5432', 10)),
  ]);
  infraAvailable = redisUp && pgUp;

  if (!infraAvailable) {
    const missing = [!redisUp && `Redis at ${REDIS_HOST}:${REDIS_PORT}`, !pgUp && `Postgres at ${pgUrl.host}`]
      .filter(Boolean)
      .join(', ');
    if (requireInfra) {
      throw new Error(`Required test infra unreachable: ${missing}. Run docker-compose -f docker-compose.test.yml up -d`);
    }
    console.warn(`Skipping rewardIssuanceWorker DLQ integration tests: ${missing} unreachable`);
    return;
  }

  // Import lazily (rather than statically) so a Redis/Postgres-less run
  // never constructs a real BullMQ Queue/Worker and never risks an
  // unhandled 'error' event from a doomed connection attempt.
  stubRequireCache('../services/rewardIssuanceService', {
    processRewardIssuance: (...args) => mockProcessRewardIssuance(...args),
  });

  queuesModule = await import('../jobs/queues.js');
  workerModule = await import('../jobs/rewardIssuanceWorker.js');

  const { Pool } = await import('pg');
  dbPool = new Pool({ connectionString: process.env.DATABASE_URL });

  await queuesModule.rewardIssuanceQueue.waitUntilReady();
  await workerModule.worker.waitUntilReady();
});

afterAll(async () => {
  if (!infraAvailable) return;

  await workerModule.shutdownWorker();
  await queuesModule.shutdownQueues();
  await dbPool.end();
});

describe('rewardIssuanceWorker DLQ persistence (integration)', () => {
  it('routes a job that fails all 3 attempts to the DLQ and persists it to reward_issuance_failures', async () => {
    if (!infraAvailable) return;

    const errorMessage = 'Simulated permanent Stellar failure';
    mockProcessRewardIssuance.mockRejectedValue(new StellarTimeoutError(errorMessage));

    const counterBefore = await dlqCounterValue('StellarTimeoutError');

    const testMarker = crypto.randomUUID();
    const job = await queuesModule.rewardIssuanceQueue.add(
      'issue-reward',
      { campaignId: 1, walletAddress: 'GTEST_ALWAYS_FAILS', amount: '10', testMarker },
      { attempts: 3, backoff: { type: 'fixed', delay: 50 } }
    );

    // 1. Job appears in the reward-issuance-dlq queue.
    const dlqEntry = await pollUntil(async () => {
      const jobs = await workerModule.rewardDLQ.getJobs(['waiting', 'active']);
      return jobs.find((j) => j.data?.testMarker === testMarker) || null;
    });
    expect(dlqEntry.data).toEqual(
      expect.objectContaining({
        campaignId: 1,
        walletAddress: 'GTEST_ALWAYS_FAILS',
        amount: '10',
        failedReason: errorMessage,
      })
    );

    // 2. Failure is persisted to reward_issuance_failures with the error message.
    const dbRow = await pollUntil(() => insertedFailureFor(job.id));
    expect(dbRow.attempts).toBe(3);
    expect(dbRow.error).toBe(errorMessage);
    expect(dbRow.payload).toEqual(
      expect.objectContaining({ campaignId: 1, walletAddress: 'GTEST_ALWAYS_FAILS', testMarker })
    );

    // 3. nova_reward_dlq_total incremented by 1 for this failure reason.
    const counterAfter = await dlqCounterValue('StellarTimeoutError');
    expect(counterAfter - counterBefore).toBe(1);

    expect(mockProcessRewardIssuance).toHaveBeenCalledTimes(3);
  }, 15000);

  it('does not route a job that succeeds on attempt 1 to the DLQ or the DB', async () => {
    if (!infraAvailable) return;

    mockProcessRewardIssuance.mockReset();
    mockProcessRewardIssuance.mockResolvedValue({ status: 'issued', txHash: 'tx-success' });

    const testMarker = crypto.randomUUID();
    const job = await queuesModule.rewardIssuanceQueue.add(
      'issue-reward',
      { campaignId: 2, walletAddress: 'GTEST_SUCCEEDS', amount: '5', testMarker },
      { attempts: 3, backoff: { type: 'fixed', delay: 50 } }
    );

    // Queue default is removeOnComplete: true, so a successful job disappears
    // from Redis once the Worker finishes with it — that's our completion signal.
    await pollUntil(async () => {
      const stillQueued = await queuesModule.rewardIssuanceQueue.getJob(job.id);
      return stillQueued === undefined;
    });

    expect(mockProcessRewardIssuance).toHaveBeenCalledTimes(1);

    const dlqJobs = await workerModule.rewardDLQ.getJobs(['waiting', 'active']);
    expect(dlqJobs.find((j) => j.data?.testMarker === testMarker)).toBeUndefined();

    const dbRow = await insertedFailureFor(job.id);
    expect(dbRow).toBeNull();
  }, 15000);
});
