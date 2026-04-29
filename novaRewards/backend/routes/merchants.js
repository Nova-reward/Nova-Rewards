const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { createHash } = require('crypto');
const { query } = require('../db/index');
const { isValidStellarAddress } = require('../../blockchain/stellarService');
const { validateMerchantRegisterDto } = require('../dtos/merchantRegisterDto');

/**
 * POST /api/merchants/register
 * Registers a new merchant and returns their record with a generated API key.
 * Requirements: 7.1
 */
router.post('/register', async (req, res, next) => {
  try {
    // DTO validation: required fields, trimming, length limits, unknown field guard
    const { valid, errors } = validateMerchantRegisterDto(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: errors[0],
        details: errors,
      });
    }

    const { name, walletAddress, businessCategory } = req.body;

    // Trim inputs before use — DTO already confirmed they are valid strings
    const trimmedName          = name.trim();
    const trimmedWalletAddress = walletAddress.trim();

    if (!isValidStellarAddress(trimmedWalletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'walletAddress must be a valid Stellar public key',
      });
    }

    const apiKey = uuidv4().replace(/-/g, ''); // 32-char hex key — returned once, never stored
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    const result = await query(
      `INSERT INTO merchants (name, wallet_address, business_category, api_key)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, wallet_address, business_category, created_at`,
      [trimmedName, trimmedWalletAddress, businessCategory ? businessCategory.trim() || null : null, apiKeyHash]
    );

    res.status(201).json({ success: true, data: { ...result.rows[0], api_key: apiKey } });
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
