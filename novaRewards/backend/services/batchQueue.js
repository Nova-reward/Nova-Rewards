const { Queue, Worker, QueueEvents } = require('bullmq');
const bcrypt = require('bcryptjs');
const { recordPointTransaction } = require('../db/pointTransactionRepository');
const { query } = require('../db/index');

const VALID_REWARD_TYPES = new Set(['earned', 'bonus', 'referral']);
const SALT_ROUNDS = 12;

// ── Shared Redis connection config ────────────────────────────────────────
const connection = { url: process.env.REDIS_URL || 'redis://localhost:6379' };

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: false, // retain for inspection
  removeOnFail: false,
};

// ── Queues ────────────────────────────────────────────────────────────────
const rewardQueue = new Queue('batch-reward-distribution', { connection, defaultJobOptions });
const importQueue = new Queue('batch-user-import',         { connection, defaultJobOptions });

// ── Worker: batch reward distribution ────────────────────────────────────
// Job payload: { items: [{ userId, rewardAmount, rewardType, description?, campaignId? }] }
const rewardWorker = new Worker('batch-reward-distribution', async (job) => {
  const { items } = job.data;
  const total = items.length;
  let succeeded = 0;
  const failed = [];

  console.log(`[batch-rewards] job ${job.id} started — ${total} items`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const type = VALID_REWARD_TYPES.has(item.rewardType) ? item.rewardType : 'earned';
      await recordPointTransaction({
        userId:      item.userId,
        type,
        amount:      item.rewardAmount,
        description: item.description ?? `Batch reward distribution (job ${job.id})`,
        campaignId:  item.campaignId  ?? null,
      });
      succeeded++;
    } catch (err) {
      failed.push({ index: i, userId: item.userId, reason: err.message });
    }
    await job.updateProgress(Math.round(((i + 1) / total) * 100));
  }

  const summary = { total, succeeded, failed: failed.length, failedItems: failed };
  console.log(`[batch-rewards] job ${job.id} complete — ${succeeded}/${total} succeeded, ${failed.length} failed`);
  return summary;
}, { connection });

// ── Worker: batch user import ─────────────────────────────────────────────
// Job payload: { items: [{ email, password, firstName, lastName }] }
const importWorker = new Worker('batch-user-import', async (job) => {
  const { items } = job.data;
  const total = items.length;
  let imported = 0;
  const skipped = [];

  console.log(`[batch-import] job ${job.id} started — ${total} items`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Validate required fields
    if (!item.email || !item.password || !item.firstName || !item.lastName) {
      skipped.push({ index: i, email: item.email, reason: 'Missing required fields: email, password, firstName, lastName' });
      await job.updateProgress(Math.round(((i + 1) / total) * 100));
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
      skipped.push({ index: i, email: item.email, reason: 'Invalid email format' });
      await job.updateProgress(Math.round(((i + 1) / total) * 100));
      continue;
    }

    try {
      const passwordHash = await bcrypt.hash(item.password, SALT_ROUNDS);
      await query(
        `INSERT INTO users (email, password_hash, first_name, last_name)
         VALUES ($1, $2, $3, $4)`,
        [item.email.trim().toLowerCase(), passwordHash, item.firstName.trim(), item.lastName.trim()]
      );
      imported++;
    } catch (err) {
      const reason = err.code === '23505' ? 'Email already exists' : err.message;
      skipped.push({ index: i, email: item.email, reason });
    }
    await job.updateProgress(Math.round(((i + 1) / total) * 100));
  }

  const summary = { total, imported, skipped: skipped.length, skippedItems: skipped };
  console.log(`[batch-import] job ${job.id} complete — ${imported}/${total} imported, ${skipped.length} skipped`);
  return summary;
}, { connection });

// ── Worker error logging ──────────────────────────────────────────────────
for (const [name, worker] of [['batch-rewards', rewardWorker], ['batch-import', importWorker]]) {
  worker.on('failed', (job, err) => {
    console.error(`[${name}] job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
  });
}

module.exports = { rewardQueue, importQueue };
