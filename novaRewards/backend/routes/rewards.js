const router = require('express').Router();
<<<<<<< Testing-—-Property-Tests-Write-property-test-for-merchant-totals-consistency-(Property-12)
const { getActiveCampaign } = require('../db/campaignRepository');
const rateLimit = require('express-rate-limit');
=======
const { createHash } = require('crypto');
>>>>>>> main
const { query } = require('../db/index');
const { getCampaignById, getActiveCampaign } = require('../db/campaignRepository');
const { recordTransaction } = require('../db/transactionRepository');
const { distributeRewards } = require('../../blockchain/sendRewards');
const { isValidStellarAddress } = require('../../blockchain/stellarService');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

/**
 * Rate limiter: max 20 requests per minute per IP on the distribute endpoint.
 * Closes: #123
 */
const distributeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
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
router.post('/distribute', authenticateMerchant, async (req, res, next) => {
  try {
    const { customerWallet, amount, campaignId } = req.body;

    if (!customerWallet || !isValidStellarAddress(customerWallet)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'customerWallet must be a valid Stellar public key',
      });
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'amount must be a positive number',
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

    // Distribute via Stellar — throws on no_trustline or insufficient_balance
    const { txHash } = await distributeRewards({
      toWallet: customerWallet,
      amount: String(amount),
    });

    // Record in database
    const tx = await recordTransaction({
      txHash,
      txType: 'distribution',
      amount,
      fromWallet: process.env.DISTRIBUTION_PUBLIC,
      toWallet: customerWallet,
      merchantId: req.merchant.id,
      campaignId: campaign.id,
    });

    res.json({ success: true, txHash, transaction: tx });
  } catch (err) {
    if (err.code === 'no_trustline') {
      return res.status(400).json({
        success: false,
        error: 'no_trustline',
        message: err.message,
      });
    }
    if (err.code === 'insufficient_balance') {
      return res.status(400).json({
        success: false,
        error: 'insufficient_balance',
        message: err.message,
      });
    }
    next(err);
  }
});

module.exports = router;
