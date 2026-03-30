const { cleanupStaleFlags } = require('../services/featureFlagService');

/** Runs daily at midnight to remove expired feature flags */
async function runFlagCleanup() {
  try {
    const deleted = await cleanupStaleFlags();
    if (deleted > 0) console.log(`[featureFlagCleanup] removed ${deleted} stale flag(s)`);
  } catch (err) {
    console.error('[featureFlagCleanup] error:', err.message);
  }
}

function startFlagCleanupJob() {
  // Run once at startup, then every 24 hours
  runFlagCleanup();
  setInterval(runFlagCleanup, 24 * 60 * 60 * 1000);
}

module.exports = { startFlagCleanupJob };
