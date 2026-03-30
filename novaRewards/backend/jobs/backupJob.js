const {
  createEncryptedBackup,
  getBackupConfig,
  pruneExpiredBackups,
} = require('../services/backupService');

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
  console.log(`[backup] created ${manifest.backupId}; pruned=${pruned.length}`);
  return { manifest, pruned };
}

function startBackupJob() {
  const config = getBackupConfig();
  if (!config.enabled) {
    console.log('[backup] disabled; skipping scheduler startup');
    return null;
  }

  function scheduleNext() {
    const delay = msUntilNextScheduledRun(new Date(), config.schedule);

    setTimeout(async () => {
      try {
        await runBackupCycle(new Date(), 'scheduled');
      } catch (err) {
        console.error('[backup] scheduled backup failed', err);
      } finally {
        scheduleNext();
      }
    }, delay);

    console.log(`[backup] next run at ${config.schedule.value} UTC in ${Math.round(delay / 1000)}s`);
  }

  scheduleNext();
  return config.schedule;
}

module.exports = {
  msUntilNextScheduledRun,
  runBackupCycle,
  startBackupJob,
};
