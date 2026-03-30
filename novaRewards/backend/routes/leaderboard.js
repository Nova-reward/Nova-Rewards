const router = require('express').Router();
const { getLeaderboard } = require('../db/leaderboardRepository');
const { client } = require('../lib/redis');
const { authenticateUser } = require('../middleware/authenticateUser');

const CACHE_TTL = 300; // 5 minutes
const VALID_PERIODS = ['weekly', 'alltime'];

/**
 * GET /api/leaderboard?period=weekly|alltime&limit=50
 * Returns top-N users by earned points. Appends current user's rank if outside top N.
 * Cache key: leaderboard:${period}  TTL: 5 min
 * Requirements: #185
 */
router.get('/', authenticateUser, async (req, res, next) => {
  try {
    const period = VALID_PERIODS.includes(req.query.period) ? req.query.period : 'weekly';
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const cacheKey = `leaderboard:${period}`;

    // Try cache first (rankings only — current-user rank is always live)
    const cached = await client.get(cacheKey);
    let rankings;
    if (cached) {
      rankings = JSON.parse(cached);
    } else {
      const result = await getLeaderboard(period, limit, null);
      rankings = result.rankings;
      await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(rankings));
    }

    // Always resolve current user's rank live (personalised, not cacheable globally)
    const inTop = rankings.some((r) => r.user_id === req.user.id);
    let currentUser = null;
    if (!inTop) {
      const result = await getLeaderboard(period, limit, req.user.id);
      currentUser = result.currentUser;
    }

    res.json({
      success: true,
      data: {
        period,
        rankings,
        ...(currentUser && { currentUser }),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
