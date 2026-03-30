const router = require('express').Router();
const {
  validateCampaign,
  createCampaign,
  getCampaignsByMerchant,
} = require('../db/campaignRepository');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

/**
 * @openapi
 * /campaigns:
 *   post:
 *     tags: [Campaigns]
 *     summary: Create a reward campaign
 *     security:
 *       - merchantApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, rewardRate, startDate, endDate]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Summer Loyalty Drive
 *               rewardRate:
 *                 type: number
 *                 example: 1.5
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-06-01"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-08-31"
 *     responses:
 *       201:
 *         description: Campaign created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Campaign' }
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Missing or invalid API key.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
 * @openapi
 * /campaigns:
 *   get:
 *     tags: [Campaigns]
 *     summary: List campaigns for the authenticated merchant
 *     security:
 *       - merchantApiKey: []
 *     responses:
 *       200:
 *         description: Campaign list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Campaign' }
 *       401:
 *         description: Missing or invalid API key.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
 * @openapi
 * /campaigns/{merchantId}:
 *   get:
 *     tags: [Campaigns]
 *     summary: List campaigns for a given merchant ID
 *     parameters:
 *       - in: path
 *         name: merchantId
 *         required: true
 *         schema: { type: integer, example: 7 }
 *     responses:
 *       200:
 *         description: Campaign list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Campaign' }
 *       400:
 *         description: Invalid merchantId.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
