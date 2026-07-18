const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/index');
const { isValidStellarAddress } = require('../../blockchain/stellarService');
const { log } = require('../monitoring/eventsLogger');

/**
 * POST /api/merchants/register
 * Registers a new merchant and returns their record with a generated API key.
 * Requirements: 7.1
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name, walletAddress, businessCategory } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'name is required',
      });
    }

    if (!walletAddress || !isValidStellarAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'walletAddress must be a valid Stellar public key',
      });
    }

    const apiKey = uuidv4().replace(/-/g, ''); // 32-char hex key

    const result = await query(
      `INSERT INTO merchants (name, wallet_address, business_category, api_key)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, wallet_address, business_category, api_key, created_at`,
      [name.trim(), walletAddress, businessCategory || null, apiKey]
    );

    res.status(201).json({ success: true, data: result.rows[0] });

    // Log domain event (fire-and-forget after response)
    log.merchantRegistered({
      merchantId: result.rows[0].id,
      name: result.rows[0].name,
      walletAddress: result.rows[0].wallet_address,
    });
  } catch (err) {
    if (err.code === '23505') {
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
