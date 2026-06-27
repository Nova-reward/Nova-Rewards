const {
  createEncryptedBackup,
  getBackupConfig,
  pruneExpiredBackups,
} = require('../services/backupService');
const logger = require('../lib/logger');

function msUntilNextScheduledRun(now = new Date(), schedule = getBackupConfig().schedule) {
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    schedule.hour,
    schedule.minute,
    0,
    0
  ));

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - now.getTime();
}

async function runBackupCycle(now = new Date(), reason = 'scheduled') {
  const manifest = await createEncryptedBackup({ now, reason });
  const pruned = await pruneExpiredBackups(now);
  logger.info('[backup] cycle complete', { backupId: manifest.backupId, pruned: pruned.length });
  return { manifest, pruned };
}

function startBackupJob() {
  const config = getBackupConfig();
  if (!config.enabled) {
    logger.info('[backup] disabled; skipping scheduler startup');
    return null;
  }

  function scheduleNext() {
    const delay = msUntilNextScheduledRun(new Date(), config.schedule);

    setTimeout(async () => {
      try {
        await runBackupCycle(new Date(), 'scheduled');
      } catch (err) {
        logger.error('[backup] scheduled backup failed', { error: err.message });
      } finally {
        scheduleNext();
      }
    }, delay);

    logger.info('[backup] next run scheduled', { schedule: config.schedule.value, nextRunInSec: Math.round(delay / 1000) });
  }

  scheduleNext();
  return config.schedule;
}

module.exports = {
  msUntilNextScheduledRun,
  runBackupCycle,
  startBackupJob,
};
