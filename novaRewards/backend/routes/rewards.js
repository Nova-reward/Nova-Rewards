const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { distributeRewards } = require('../services/distributeRewards');
const { verifyTrustline } = require('../services/stellar');
const logger = require('../config/logger');

// Rate limiter for distribute endpoint
const distributeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many distribution requests. Please try again later.',
  },
});

// POST /api/rewards/distribute - Distribute rewards to user
router.post('/distribute', distributeRateLimiter, async (req, res) => {
  try {
    const { walletAddress, amount, campaignId } = req.body;

    if (!walletAddress || !amount) {
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

    // Verify trustline exists
    const hasTrustline = await verifyTrustline(walletAddress);
    if (!hasTrustline) {
      return res.status(400).json({
        success: false,
        error: 'no_trustline',
        message: 'Recipient does not have a NOVA trustline. Please add NOVA trustline first.',
      });
    }

    // Distribute rewards
    const result = await distributeRewards({
      recipient: walletAddress,
      amount,
      campaignId,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      txHash: result.txHash,
      message: 'Rewards distributed successfully',
    });
  } catch (error) {
    logger.error('Error distributing rewards:', error);
    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: error.message || 'Failed to distribute rewards',
    });
  }
});

module.exports = router;
