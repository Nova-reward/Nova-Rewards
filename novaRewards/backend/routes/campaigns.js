const router = require('express').Router();
const {
  validateCampaign,
  createCampaign,
  getCampaignsByMerchant,
} = require('../db/campaignRepository');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

/**
 * POST /api/campaigns
 * Creates a new reward campaign after validating inputs.
 * Requirements: 7.2, 7.3
 */
router.post('/', authenticateMerchant, async (req, res, next) => {
  try {
    const { name, rewardRate, startDate, endDate } = req.body;
    const merchantId = req.merchant.id;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'name is required',
      });
    }

    const { valid, errors } = validateCampaign({ rewardRate, startDate, endDate });
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: errors.join('; '),
      });
    }

    const campaign = await createCampaign({
      merchantId,
      name: name.trim(),
      rewardRate,
      startDate,
      endDate,
    });

    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/campaigns
 * Returns all campaigns for the authenticated merchant.
 * Requirements: 7.2
 */
router.get('/', authenticateMerchant, async (req, res, next) => {
  try {
    const campaigns = await getCampaignsByMerchant(req.merchant.id);
    res.json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/campaigns/:merchantId
 * Returns all campaigns for a given merchant.
 * Requirements: 7.2, 10.1
 */
router.get('/:merchantId', async (req, res, next) => {
  try {
    const merchantId = parseInt(req.params.merchantId, 10);
    if (isNaN(merchantId) || merchantId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'merchantId must be a positive integer',
      });
    }
    const campaigns = await getCampaignsByMerchant(merchantId);
    res.json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
