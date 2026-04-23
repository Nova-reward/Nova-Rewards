const router = require('express').Router();
const {
  validateCampaign,
  createCampaign,
  getCampaignsByMerchant,
  getCampaignById,
} = require('../db/campaignRepository');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');
const { getRedisClient } = require('../cache/redisClient');
const { metrics } = require('../middleware/metricsMiddleware');

const CAMPAIGN_TTL = 60; // 60s TTL per issue #576

/**
 * Cache helpers with hit/miss metric tracking.
 */
async function cacheGet(key) {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    if (val !== null) {
      metrics.cacheHits.inc({ key_type: 'campaign' });
      return JSON.parse(val);
    }
    metrics.cacheMisses.inc({ key_type: 'campaign' });
    return null;
  } catch {
    metrics.cacheMisses.inc({ key_type: 'campaign' });
    return null;
  }
}

async function cacheSet(key, value) {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', CAMPAIGN_TTL);
  } catch { /* non-fatal */ }
}

async function cacheDel(key) {
  const redis = getRedisClient();
  if (!redis) return;
  try { await redis.del(key); } catch { /* non-fatal */ }
}

/**
 * @openapi
 * /campaigns:
 *   post:
 *     tags: [Campaigns]
 *     summary: Create a reward campaign
 *     security:
 *       - merchantApiKey: []
 */
router.post('/', authenticateMerchant, async (req, res, next) => {
  try {
    const { name, rewardRate, startDate, endDate } = req.body;
    const merchantId = req.merchant.id;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'name is required' });
    }

    const { valid, errors } = validateCampaign({ rewardRate, startDate, endDate });
    if (!valid) {
      return res.status(400).json({ success: false, error: 'validation_error', message: errors.join('; ') });
    }

    const campaign = await createCampaign({ merchantId, name: name.trim(), rewardRate, startDate, endDate });

    // Invalidate merchant campaign list cache on creation
    await cacheDel(`campaigns:merchant:${merchantId}`);

    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /campaigns:
 *   get:
 *     tags: [Campaigns]
 *     summary: List campaigns for the authenticated merchant (cached 60s)
 *     security:
 *       - merchantApiKey: []
 */
router.get('/', authenticateMerchant, async (req, res, next) => {
  try {
    const merchantId = req.merchant.id;
    const cacheKey = `campaigns:merchant:${merchantId}`;

    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const campaigns = await getCampaignsByMerchant(merchantId);
    await cacheSet(cacheKey, campaigns);

    res.json({ success: true, data: campaigns, cached: false });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /campaigns/{merchantId}:
 *   get:
 *     tags: [Campaigns]
 *     summary: List campaigns for a given merchant ID (cached 60s)
 */
router.get('/:merchantId', async (req, res, next) => {
  try {
    const merchantId = parseInt(req.params.merchantId, 10);
    if (isNaN(merchantId) || merchantId <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'merchantId must be a positive integer' });
    }

    const cacheKey = `campaigns:merchant:${merchantId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const campaigns = await getCampaignsByMerchant(merchantId);
    await cacheSet(cacheKey, campaigns);

    res.json({ success: true, data: campaigns, cached: false });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.cacheDel = cacheDel; // exported for use in rewards route invalidation
