const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/authenticateUser');
const { query } = require('../db');

/**
 * PATCH /api/notifications/read-all
 * Stateless acknowledgement — client resets unreadCount on 200.
 */
router.patch('/read-all', authenticateUser, (req, res) => {
  res.json({ success: true });
});

/**
 * GET /api/notifications/preferences
 * Returns the user's email notification preferences.
 */
router.get('/preferences', authenticateUser, async (req, res) => {
  try {
    const result = await query(
      'SELECT notification_preferences FROM users WHERE id = $1',
      [req.user.id]
    );
    const prefs = result.rows[0]?.notification_preferences ?? {
      rewards: true,
      redemptions: true,
      campaigns: false,
      referrals: true,
      system: false,
    };
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

/**
 * PUT /api/notifications/preferences
 * Saves the user's email notification preferences.
 */
router.put('/preferences', authenticateUser, async (req, res) => {
  const allowed = ['rewards', 'redemptions', 'campaigns', 'referrals', 'system'];
  const prefs = {};
  for (const key of allowed) {
    if (typeof req.body[key] === 'boolean') prefs[key] = req.body[key];
  }
  try {
    await query(
      'UPDATE users SET notification_preferences = $1 WHERE id = $2',
      [JSON.stringify(prefs), req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

module.exports = router;
