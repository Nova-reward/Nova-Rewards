const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../db/index');

/**
 * GET /api/users/me
 * Returns the authenticated user's profile.
 * Frozen accounts still receive their data — freeze only blocks write operations.
 * Requirements: profile endpoint
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, wallet_address, role, is_frozen, referral_code, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'User not found' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        id: row.id,
        walletAddress: row.wallet_address,
        role: row.role,
        isFrozen: row.is_frozen,
        referralCode: row.referral_code,
        createdAt: row.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
