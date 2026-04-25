const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/authenticateUser');
const { query } = require('../db');

const { getNotificationsForUser, markAllNotificationsAsRead, markNotificationAsRead } = require('../db/notificationRepository');

/**
 * GET /api/notifications
 * Returns the user's notifications.
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { page, limit } = req.query;
    const notifications = await getNotificationsForUser(req.user.id, { page: page || 1, limit: limit || 50 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read.
 */
router.patch('/read-all', authenticateUser, async (req, res) => {
  try {
    await markAllNotificationsAsRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', authenticateUser, async (req, res) => {
  try {
    await markNotificationAsRead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
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
