const router = require('express').Router();
const { getLeaderboard } = require('../db/leaderboardRepository');
const { client } = require('../lib/redis');
const { authenticateUser } = require('../middleware/authenticateUser');

const CACHE_TTL = 300; // 5 minutes
const VALID_PERIODS = ['weekly', 'alltime'];

/**
 * @openapi
 * /leaderboard:
 *   get:
 *     tags: [Leaderboard]
 *     summary: Get top users by earned points
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [weekly, alltime], default: weekly, example: weekly }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 100, example: 50 }
 *     responses:
 *       200:
 *         description: Leaderboard rankings.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     period: { type: string, example: weekly }
 *                     rankings:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/LeaderboardEntry' }
 *                     currentUser: { $ref: '#/components/schemas/LeaderboardEntry' }
 *       401:
 *         description: Unauthenticated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
