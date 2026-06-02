const { getLeaderboard } = require('../db/leaderboardRepository');
const cacheService = require('../services/cacheService');

const CACHE_TTL = 300;
const PERIODS = ['weekly', 'alltime'];

/**
 * Pre-warms leaderboard cache for all periods.
 * Called by cron every 5 minutes and on startup.
 * Requirements: #358 Caching Layer
 */
async function warmLeaderboardCache() {
  for (const period of PERIODS) {
    try {
      const { rankings } = await getLeaderboard(period, 50, null);
      await cacheService.set(`leaderboard:${period}`, rankings, CACHE_TTL);
      console.log(`[leaderboard] cache warmed for period=${period}`);
    } catch (err) {
      console.error(`[leaderboard] cache warm failed for period=${period}`, err);
    }
  }
}

/**
 * Starts the cron job that pre-warms the leaderboard cache every 5 minutes.
 */
function startLeaderboardCacheWarmer() {
  warmLeaderboardCache(); // warm immediately on startup
  setInterval(warmLeaderboardCache, CACHE_TTL * 1000);
}

module.exports = { startLeaderboardCacheWarmer, warmLeaderboardCache };
