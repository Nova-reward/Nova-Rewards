const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { createHash } = require('crypto');
const { query } = require('../db/index');
const { getCampaignById, getActiveCampaign } = require('../db/campaignRepository');
const { recordTransaction } = require('../db/transactionRepository');
const { distributeRewards } = require('../../blockchain/sendRewards');
const { isValidStellarAddress } = require('../../blockchain/stellarService');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');
const { verifyTrustline } = require('../../blockchain/trustline');
const { logAudit } = require('../db/auditLogRepository');

/**
 * Rate limiter: max 20 requests per minute per IP on the distribute endpoint.
 * Uses Redis as the backing store when REDIS_URL is set (production),
 * falling back to in-memory for local development.
 * Closes: #123
 */
const redisClient = getRedisClient();
const distributeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis store only when a client is available
  ...(redisClient && {
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: 'rl:distribute:',
    }),
  }),
  message: {
    success: false,
    error: 'rate_limit_exceeded',
    message: 'Too many requests. Please try again later.',
  },
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
router.post('/distribute', distributeRateLimiter, authenticateMerchant, async (req, res, next) => {
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

    // Audit log for reward distribution
    logAudit({
      entityType: 'reward',
      action: 'distribute_reward',
      actorType: 'merchant',
      merchantId: req.merchant.id,
      details: {
        recipientWallet,
        amount,
        campaignId,
        txHash: result.txHash,
      },
      source: 'POST /api/rewards/distribute',
    }).catch((err) => console.error('[audit] distribute_reward:', err.message));

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