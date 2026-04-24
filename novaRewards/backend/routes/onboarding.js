const router = require('express').Router();
const { query } = require('../db/index');
const { authenticateUser } = require('../middleware/authenticateUser');

/**
 * POST /api/users/onboarding/complete
 * Marks the authenticated user's onboarding as completed.
 * Triggers a welcome reward if WELCOME_REWARD_POINTS is configured.
 */
router.post('/onboarding/complete', authenticateUser, async (req, res) => {
  const userId = req.user.id;

  try {
    // Idempotent: only update if not already completed
    const result = await query(
      `UPDATE users
          SET onboarding_completed = TRUE,
              onboarding_completed_at = NOW()
        WHERE id = $1
          AND (onboarding_completed IS NULL OR onboarding_completed = FALSE)
        RETURNING id, onboarding_completed_at`,
      [userId]
    );

    const justCompleted = result.rows.length > 0;

    // Optional welcome reward — only on first completion
    const welcomePoints = parseInt(process.env.WELCOME_REWARD_POINTS, 10) || 0;
    if (justCompleted && welcomePoints > 0) {
      await query(
        `INSERT INTO point_transactions (user_id, points, type, description, created_at)
         VALUES ($1, $2, 'welcome_reward', 'Welcome reward for completing onboarding', NOW())`,
        [userId, welcomePoints]
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        alreadyCompleted: !justCompleted,
        welcomeRewardGranted: justCompleted && welcomePoints > 0,
        welcomePoints: justCompleted ? welcomePoints : 0,
      },
    });
  } catch (err) {
    console.error('onboarding/complete error:', err);
    return res.status(500).json({ success: false, error: 'server_error', message: 'Failed to record onboarding completion' });
  }
});

module.exports = router;
