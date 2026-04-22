const router = require('express').Router();
const {
  validateCampaign,
  createCampaign,
  getCampaignsByMerchant,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  setCampaignStatus,
  getCampaignParticipants,
} = require('../db/campaignRepository');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

// POST /api/campaigns — Create a campaign
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
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns — List campaigns for authenticated merchant
router.get('/', authenticateMerchant, async (req, res, next) => {
  try {
    const campaigns = await getCampaignsByMerchant(req.merchant.id);
    res.json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id — Retrieve a single campaign
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'id must be a positive integer' });
    }
    const campaign = await getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }
    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

// PUT /api/campaigns/:id — Update a campaign
router.put('/:id', authenticateMerchant, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'id must be a positive integer' });
    }

    const { name, rewardRate, startDate, endDate } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'name is required' });
    }

    const { valid, errors } = validateCampaign({ rewardRate, startDate, endDate });
    if (!valid) {
      return res.status(400).json({ success: false, error: 'validation_error', message: errors.join('; ') });
    }

    const campaign = await updateCampaign(id, req.merchant.id, { name: name.trim(), rewardRate, startDate, endDate });
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }
    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/campaigns/:id — Delete a campaign
router.delete('/:id', authenticateMerchant, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'id must be a positive integer' });
    }

    const deleted = await deleteCampaign(id, req.merchant.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns/:id/activate — Activate a campaign
router.post('/:id/activate', authenticateMerchant, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'id must be a positive integer' });
    }

    const campaign = await setCampaignStatus(id, req.merchant.id, true);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }
    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns/:id/pause — Pause a campaign
router.post('/:id/pause', authenticateMerchant, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'id must be a positive integer' });
    }

    const campaign = await setCampaignStatus(id, req.merchant.id, false);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }
    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id/participants — List participants
router.get('/:id/participants', authenticateMerchant, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'id must be a positive integer' });
    }

    const campaign = await getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }

    const participants = await getCampaignParticipants(id);
    res.json({ success: true, data: participants });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
