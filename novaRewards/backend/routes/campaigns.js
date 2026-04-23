const router = require('express').Router();
const {
  validateCampaign,
  createCampaign,
  confirmOnChain,
  markOnChainFailed,
  getCampaignById,
  getCampaignsByMerchant,
  updateCampaign,
  softDeleteCampaign,
  getPublicCampaigns,
  getPublicCampaignById,
  getPublicCampaignCategories,
} = require('../db/campaignRepository');
const {
  registerCampaign,
  updateCampaign: updateCampaignOnChain,
  pauseCampaign,
} = require('../services/sorobanService');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

// ---------------------------------------------------------------------------
// Public endpoints — no authentication required
// ---------------------------------------------------------------------------

/**
 * GET /campaigns/public
 * Returns a paginated list of campaigns for the public discovery page.
 *
 * Query params:
 *   page        number   (default 1)
 *   limit       number   (default 12, max 50)
 *   category    string
 *   rewardType  string
 *   status      active | paused | completed
 *   merchantId  number
 *   search      string   (matches campaign name or merchant name)
 *
 * @swagger
 * /campaigns/public:
 *   get:
 *     summary: Browse public campaigns
 *     tags: [Campaigns]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 12, maximum: 50 }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: rewardType
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, paused, completed] }
 *       - in: query
 *         name: merchantId
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated campaign list
 */
router.get('/public', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));

    const { category, rewardType, status, merchantId, search } = req.query;

    const VALID_STATUSES = ['active', 'paused', 'completed'];
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const result = await getPublicCampaigns({
      page,
      limit,
      category:   category   || undefined,
      rewardType: rewardType || undefined,
      status:     status     || undefined,
      merchantId: merchantId ? parseInt(merchantId, 10) : undefined,
      search:     search     || undefined,
    });

    res.json({
      success: true,
      data: result.campaigns,
      total: result.total,
      hasMore: result.hasMore,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /campaigns/categories
 * Returns distinct campaign categories for the filter sidebar.
 */
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await getPublicCampaignCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /campaigns/public/:id
 * Returns a single campaign by ID for the detail modal (no auth required).
 */
router.get('/public/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'id must be a positive integer',
      });
    }

    const campaign = await getPublicCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /campaigns — create campaign in DB then register on-chain
// ---------------------------------------------------------------------------
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

    // 1. Persist to DB first (on_chain_status = 'pending')
    const campaign = await createCampaign({ merchantId, name: name.trim(), rewardRate, startDate, endDate });

    // 2. Submit to Soroban; roll back (mark failed) on error
    let confirmed;
    try {
      const { txHash, contractCampaignId } = await registerCampaign({
        id: campaign.id,
        name: campaign.name,
        rewardRate: campaign.reward_rate,
        startDate: campaign.start_date,
        endDate: campaign.end_date,
      });
      confirmed = await confirmOnChain({ id: campaign.id, contractCampaignId, txHash });
    } catch (chainErr) {
      await markOnChainFailed(campaign.id);
      return res.status(502).json({
        success: false,
        error: 'chain_error',
        message: `On-chain registration failed: ${chainErr.message}`,
      });
    }

    res.status(201).json({ success: true, data: confirmed });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /campaigns/:id — return campaign including on-chain status
// ---------------------------------------------------------------------------
router.get('/:id', authenticateMerchant, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'id must be a positive integer' });
    }

    const campaign = await getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }

    // Merchants may only read their own campaigns
    if (campaign.merchant_id !== req.merchant.id) {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'Access denied' });
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /campaigns/:id — update mutable fields + on-chain update
// ---------------------------------------------------------------------------
router.patch('/:id', authenticateMerchant, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'id must be a positive integer' });
    }

    const campaign = await getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }
    if (campaign.merchant_id !== req.merchant.id) {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'Access denied' });
    }

    const { name, rewardRate } = req.body;
    if (name === undefined && rewardRate === undefined) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Provide at least one of: name, rewardRate' });
    }
    if (rewardRate !== undefined) {
      const { valid, errors } = validateCampaign({
        rewardRate,
        startDate: campaign.start_date,
        endDate: campaign.end_date,
      });
      if (!valid) {
        return res.status(400).json({ success: false, error: 'validation_error', message: errors.join('; ') });
      }
    }

    // Submit on-chain update first; only write to DB on success
    if (!campaign.contract_campaign_id) {
      return res.status(409).json({ success: false, error: 'chain_not_ready', message: 'Campaign is not yet confirmed on-chain' });
    }

    let txHash;
    try {
      ({ txHash } = await updateCampaignOnChain({
        contractCampaignId: campaign.contract_campaign_id,
        name,
        rewardRate,
      }));
    } catch (chainErr) {
      return res.status(502).json({
        success: false,
        error: 'chain_error',
        message: `On-chain update failed: ${chainErr.message}`,
      });
    }

    const updated = await updateCampaign(id, { name, rewardRate, txHash });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /campaigns/:id — pause on-chain then soft-delete in DB
// ---------------------------------------------------------------------------
router.delete('/:id', authenticateMerchant, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'id must be a positive integer' });
    }

    const campaign = await getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }
    if (campaign.merchant_id !== req.merchant.id) {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'Access denied' });
    }
    if (!campaign.contract_campaign_id) {
      return res.status(409).json({ success: false, error: 'chain_not_ready', message: 'Campaign is not yet confirmed on-chain' });
    }

    // Pause on-chain first; only soft-delete in DB on success
    let txHash;
    try {
      ({ txHash } = await pauseCampaign(campaign.contract_campaign_id));
    } catch (chainErr) {
      return res.status(502).json({
        success: false,
        error: 'chain_error',
        message: `On-chain pause failed: ${chainErr.message}`,
      });
    }

    await softDeleteCampaign(id, txHash);
    res.json({ success: true, data: { id, deleted: true } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /campaigns — list all campaigns for the authenticated merchant
// ---------------------------------------------------------------------------
router.get('/', authenticateMerchant, async (req, res, next) => {
  try {
    const campaigns = await getCampaignsByMerchant(req.merchant.id);
    res.json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
