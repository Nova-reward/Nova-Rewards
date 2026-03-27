const router = require('express').Router();
const { query } = require('../db/index');
const { isValidStellarAddress } = require('../../blockchain/stellarService');

/**
 * GET /api/users/:walletAddress/points
 * Calculates and returns the current point balance for a user.
 * Points = Sum(distributions) - Sum(redemptions)
 */
router.get('/:walletAddress/points', async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    if (!isValidStellarAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'walletAddress must be a valid Stellar public key',
      });
    }

    // Calculate balance from transactions table
    const result = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN tx_type = 'distribution' AND to_wallet = $1 THEN amount ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN tx_type = 'redemption'   AND from_wallet = $1 THEN amount ELSE 0 END), 0) AS balance
       FROM transactions
       WHERE to_wallet = $1 OR from_wallet = $1`,
      [walletAddress]
    );

    const balance = parseFloat(result.rows[0].balance || 0);

    res.json({
      success: true,
      data: {
        walletAddress,
        balance: balance < 0 ? 0 : balance, // Points shouldn't be negative in this context
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
