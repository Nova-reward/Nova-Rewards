#!/usr/bin/env node

/**
 * Safe DLQ reprocessing script with idempotency protection.
 *
 * Usage:
 *   node scripts/reprocess-dlq.js --job-id <job-id>
 *   node scripts/reprocess-dlq.js --all-pending
 *   node scripts/reprocess-dlq.js --dry-run --all-pending
 */

const { Command } = require('commander');
const rewardIssuanceFailureRepository = require('../novaRewards/backend/repositories/rewardIssuanceFailureRepository');
const rewardIssuanceRepository = require('../novaRewards/backend/repositories/rewardIssuanceRepository');
const { rewardIssuanceQueue } = require('../novaRewards/backend/jobs/queues');

const program = new Command();

program
  .option('--job-id <id>', 'Reprocess a specific failed job by ID')
  .option('--all-pending', 'Reprocess all pending failures (oldest first)')
  .option('--dry-run', 'Show what would be reprocessed without enqueuing')
  .option('--max <n>', 'Max jobs to reprocess in --all-pending mode', '50')
  .parse();

const opts = program.opts();

async function reprocessSingle(failure, dryRun) {
  const { job_id: jobId, payload } = failure;

  // ── Idempotency guard ─────────────────────────────────────────
  const alreadyReprocessed = await rewardIssuanceFailureRepository.isReprocessed(jobId);
  if (alreadyReprocessed) {
    console.log(`[SKIP] Job ${jobId} already reprocessed.`);
    return { status: 'skipped', jobId };
  }

  // ── Core idempotency: has the reward already been issued? ─────
  const rewardAlreadyIssued = await rewardIssuanceRepository.isRewardCompleted(payload.rewardId);
  if (rewardAlreadyIssued) {
    console.log(`[SKIP] Reward ${payload.rewardId} already issued; marking reprocessed.`);
    if (!dryRun) {
      await rewardIssuanceFailureRepository.markReprocessed(jobId, 'already-completed');
    }
    return { status: 'already-issued', jobId };
  }

  if (dryRun) {
    console.log(`[DRY-RUN] Would re-enqueue job ${jobId} with payload:`, JSON.stringify(payload));
    return { status: 'dry-run', jobId };
  }

  // ── Re-enqueue ────────────────────────────────────────────────
  const newJob = await rewardIssuanceQueue.add('issue-reward', payload, {
    jobId: `${jobId}-reprocess-${Date.now()}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });

  await rewardIssuanceFailureRepository.markReprocessed(jobId, newJob.id);

  console.log(`[REQUEUED] Job ${jobId} → new job ${newJob.id}`);
  return { status: 'requeued', jobId, newJobId: newJob.id };
}

async function main() {
  try {
    if (opts.jobId) {
      const failure = await rewardIssuanceFailureRepository.getByJobId(opts.jobId);
      if (!failure) {
        console.error(`[ERROR] Job ${opts.jobId} not found in reward_issuance_failures.`);
        process.exit(1);
      }
      const result = await reprocessSingle(failure, opts.dryRun);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === 'skipped' ? 0 : 0);
    }

    if (opts.allPending) {
      const pending = await rewardIssuanceFailureRepository.listPending({ limit: parseInt(opts.max, 10) });
      console.log(`[INFO] Found ${pending.length} pending failures.`);

      const results = [];
      for (const failure of pending) {
        const result = await reprocessSingle(failure, opts.dryRun);
        results.push(result);
      }

      const summary = {
        total: results.length,
        requeued: results.filter((r) => r.status === 'requeued').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
        alreadyIssued: results.filter((r) => r.status === 'already-issued').length,
        dryRun: results.filter((r) => r.status === 'dry-run').length,
      };
      console.log('[SUMMARY]', JSON.stringify(summary, null, 2));
      process.exit(0);
    }

    program.help();
  } catch (err) {
    console.error('[FATAL]', err);
    process.exit(1);
  }
}

main();