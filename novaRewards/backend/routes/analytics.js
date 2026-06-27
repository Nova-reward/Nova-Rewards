const router = require('express').Router();
const analyticsService = require('../services/analyticsService');
const cacheService = require('../services/cacheService');

/**
 * POST /api/analytics/track
 * Tracks a user event.
 * Requirements: #362 Analytics Service
 */
router.post('/track', async (req, res, next) => {
  try {
    const { name, category, label, value, properties } = req.body;
    const userId = req.user ? req.user.id : null; // req.user populated by auth middleware

    const event = await analyticsService.trackEvent({
      userId,
      name,
      category,
      label,
      value,
      properties,
    });

    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/performance/:campaignId
 * Returns tracking metrics for a specific campaign.
 */
router.get('/performance/:campaignId', async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const stats = await analyticsService.getCampaignPerformance(campaignId);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/funnel/:funnelName
 * Returns funnel conversion counts.
 */
router.get('/funnel/:funnelName', async (req, res, next) => {
  try {
    const { funnelName } = req.params;
    const data = await analyticsService.getFunnelPerformance(funnelName);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analytics/health/cache
 * Returns cache health metrics.
 * Requirements: #358 Caching Layer
 */
router.get('/health/cache', async (req, res, next) => {
  try {
    const health = await cacheService.getHealth();
    res.json({ success: true, data: health });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
