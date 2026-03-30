const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { createHash } = require('crypto');
const { query } = require('../db/index');
const { isValidStellarAddress } = require('../../blockchain/stellarService');

/**
 * @openapi
 * /merchants/register:
 *   post:
 *     tags: [Merchants]
 *     summary: Register a new merchant
 *     description: Returns the merchant record plus a one-time plain-text API key. Store it securely — it is never shown again.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, walletAddress]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Stellar Coffee Co.
 *               walletAddress:
 *                 type: string
 *                 example: GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN
 *               businessCategory:
 *                 type: string
 *                 example: Food & Beverage
 *     responses:
 *       201:
 *         description: Merchant registered.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Merchant'
 *                     - type: object
 *                       properties:
 *                         api_key: { type: string, example: "a1b2c3d4e5f6..." }
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: Wallet address already registered.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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

    const apiKey = uuidv4().replace(/-/g, ''); // 32-char hex key — returned once, never stored
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    const result = await query(
      `INSERT INTO merchants (name, wallet_address, business_category, api_key)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, wallet_address, business_category, created_at`,
      [name.trim(), walletAddress, businessCategory || null, apiKeyHash]
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
