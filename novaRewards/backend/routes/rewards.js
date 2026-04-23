const express = require('express');
const router = express.Router();
const { getCampaignById, getActiveCampaign } = require('../db/campaignRepository');
const { distributeRewards } = require('../../blockchain/sendRewards');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');
const { verifyTrustline } = require('../../blockchain/trustline');
const { slidingRewards } = require('../middleware/rateLimiter');
const { enqueueRewardIssuance } = require('../services/rewardIssuanceService');

/**
 * @openapi
 * /rewards/issue:
 *   post:
 *     tags: [Rewards]
 *     summary: Enqueue a reward issuance (idempotent)
 *     security:
 *       - merchantApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idempotencyKey, walletAddress, amount, campaignId]
 *             properties:
 *               idempotencyKey: { type: string }
 *               walletAddress:  { type: string }
 *               amount:         { type: number }
 *               campaignId:     { type: integer }
 *               userId:         { type: integer }
 *     responses:
 *       202: { description: Queued }
 *       200: { description: Duplicate — already processed }
 *       400: { description: Validation error }
 */
router.post('/issue', slidingRewards, authenticateMerchant, async (req, res, next) => {
  try {
    const { idempotencyKey, walletAddress, amount, campaignId, userId } = req.body;
    if (!idempotencyKey || !walletAddress || !amount || !campaignId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'idempotencyKey, walletAddress, amount, and campaignId are required',
      });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'amount must be > 0' });
    }

    const result = await enqueueRewardIssuance({ idempotencyKey, campaignId, userId, walletAddress, amount });

    if (result.duplicate) {
      return res.status(200).json({ success: true, duplicate: true, issuanceId: result.issuanceId, status: result.status });
    }
    res.status(202).json({ success: true, queued: true, issuanceId: result.issuanceId });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /rewards/distribute:
 *   post:
 *     tags: [Rewards]
 *     summary: Distribute NOVA tokens to a customer wallet
 *     security:
 *       - merchantApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress, amount]
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 example: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
 *               amount:
 *                 type: number
 *                 example: 50
 *               campaignId:
 *                 type: integer
 *                 example: 3
 *     responses:
 *       200:
 *         description: Tokens distributed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 txHash: { type: string, example: "a1b2c3d4..." }
 *       400:
 *         description: Validation error or no trustline.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Missing or invalid API key.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: Campaign does not belong to this merchant.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Campaign not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/distribute', slidingRewards, authenticateMerchant, async (req, res, next) => {
  try {
    const { walletAddress, customerWallet, amount, campaignId } = req.body;
    const recipientWallet = walletAddress || customerWallet;

    if (!recipientWallet || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: walletAddress and amount are required',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than zero',
      });
    }

    // Distinguish campaign not found vs inactive/expired for clearer client handling.
    const campaignExists = await getCampaignById(campaignId);
    if (!campaignExists) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Campaign does not exist',
      });
    }

    // Validate campaign is active and belongs to this merchant
    const campaign = await getActiveCampaign(campaignId);
    if (!campaign) {
      return res.status(400).json({
        success: false,
        error: 'invalid_campaign',
        message: 'Campaign is expired or inactive',
      });
    }

    if (campaign.merchant_id !== req.merchant.id) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: 'Campaign does not belong to this merchant',
      });
    }

    // Verify trustline exists
    const trustline = await verifyTrustline(walletAddress);
    if (!trustline?.exists) {
      return res.status(400).json({
        success: false,
        error: 'no_trustline',
        message: 'Recipient does not have a NOVA trustline. Please add NOVA trustline first.',
      });
    }

    // Distribute rewards
    const result = await distributeRewards({
      recipient: recipientWallet,
      amount,
      campaignId,
    });

    res.json({ success: true, txHash: result.txHash, transaction: result.tx });
  } catch (err) {
    if (err.code === 'no_trustline') {
      return res.status(400).json({
        success: false,
        error: 'no_trustline',
        message: err.message,
      });
    }
    
    console.error('Error distributing rewards:', err);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: err.message || 'Failed to distribute rewards',
    });
  }
});

module.exports = router;