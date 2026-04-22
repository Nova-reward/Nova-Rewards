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
} = require('../db/campaignRepository');
const {
  registerCampaign,
  updateCampaign: updateCampaignOnChain,
  pauseCampaign,
} = require('../services/sorobanService');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

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
