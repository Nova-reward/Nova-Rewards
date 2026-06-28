const logger = require('./lib/logger');
const express = require('express');
const router = express.Router();
const campaignRepository = require('../db/campaignRepository');

// Create a new campaign
router.post('/', async (req, res) => {
  try {
    const validation = campaignRepository.validateCampaign(req.body);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }
    const campaign = await campaignRepository.createCampaign(req.body);
    res.status(201).json(campaign);
  } catch (error) {
    logger.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Get campaigns for a merchant
router.get('/merchant/:merchantId', async (req, res) => {
  try {
    const campaigns = await campaignRepository.getCampaignsByMerchant(req.params.merchantId);
    res.json(campaigns);
  } catch (error) {
    logger.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

module.exports = router;
