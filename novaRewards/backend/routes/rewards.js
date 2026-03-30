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

/**
 * Rate limiter: max 20 requests per minute per IP on the distribute endpoint.
 * Closes: #123
 */
const distributeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'test' ? 10000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'rate_limit_exceeded',
    message: 'Too many requests. Please try again later.',
  },
});

/**
 * POST /api/rewards/distribute
 * Distributes NOVA tokens to a customer wallet.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.4, 7.5
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
    const trustlineResult = await verifyTrustline(recipientWallet);
    const hasTrustline = trustlineResult === true || (trustlineResult && trustlineResult.exists === true);
    if (!hasTrustline) {
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