'use strict';
const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { createHash } = require('crypto');
const { validateCreateMerchant, validateUpdateMerchant } = require('../dtos/merchantDto');
const { createMerchant, getMerchantById, updateMerchant } = require('../db/merchantRepository');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

/**
 * POST /merchants
 * Register a new merchant. Returns the merchant record plus a one-time plain-text API key.
 */
router.post('/', async (req, res, next) => {
  try {
    const { valid, errors } = validateCreateMerchant(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, error: 'validation_error', message: errors.join('; ') });
    }

    const { name, walletAddress, businessCategory } = req.body;
    const apiKey = uuidv4().replace(/-/g, '');
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    const merchant = await createMerchant({ name, walletAddress, businessCategory, apiKeyHash });

    res.status(201).json({ success: true, data: { ...merchant, api_key: apiKey } });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'duplicate_merchant',
        message: 'A merchant with this wallet address is already registered',
      });
    }
    next(err);
  }
});

/**
 * GET /merchants/:id
 * Returns merchant profile and active campaigns.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'id must be a positive integer' });
    }

    const merchant = await getMerchantById(id);
    if (!merchant) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Merchant not found' });
    }

    res.json({ success: true, data: merchant });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /merchants/:id
 * Update merchant profile. Authenticated merchant can only update their own record.
 */
router.patch('/:id', authenticateMerchant, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'id must be a positive integer' });
    }

    if (req.merchant.id !== id) {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'You can only update your own merchant profile' });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Request body must not be empty' });
    }

    const { valid, errors } = validateUpdateMerchant(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, error: 'validation_error', message: errors.join('; ') });
    }

    const updated = await updateMerchant(id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Backward-compat alias: POST /merchants/register → POST /merchants
router.post('/register', async (req, res, next) => {
  try {
    const { valid, errors } = validateCreateMerchant(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, error: 'validation_error', message: errors.join('; ') });
    }

    const { name, walletAddress, businessCategory } = req.body;
    const apiKey = uuidv4().replace(/-/g, '');
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    const merchant = await createMerchant({ name, walletAddress, businessCategory, apiKeyHash });
    res.status(201).json({ success: true, data: { ...merchant, api_key: apiKey } });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'duplicate_merchant',
        message: 'A merchant with this wallet address is already registered',
      });
    }
    next(err);
  }
});

module.exports = router;
