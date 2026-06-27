const { cleanupStaleFlags } = require('../services/featureFlagService');
const logger = require('../lib/logger');

/** Runs daily at midnight to remove expired feature flags */
async function runFlagCleanup() {
  try {
    const deleted = await cleanupStaleFlags();
    if (deleted > 0) logger.info('[featureFlagCleanup] removed stale flags', { count: deleted });
  } catch (err) {
    logger.error('[featureFlagCleanup] error', { error: err.message });
  }
}

function startFlagCleanupJob() {
  // Run once at startup, then every 24 hours
  runFlagCleanup();
  setInterval(runFlagCleanup, 24 * 60 * 60 * 1000);
}

module.exports = { startFlagCleanupJob };
