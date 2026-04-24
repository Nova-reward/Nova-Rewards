const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/authenticateUser');
const { query } = require('../db');
const {
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require('../db/notificationRepository');

/**
 * GET /api/notifications
 * Returns paginated in-app notifications for the authenticated user.
 * Requirements: #582
 */
router.get('/', authenticateUser, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const result = await getNotificationsForUser(req.user.id, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read.
 * Requirements: #582
 */
router.patch('/:id/read', authenticateUser, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'id must be a positive integer' });
    }
    const notification = await markNotificationAsRead(id);
    if (!notification) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Notification not found' });
    }
    res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notifications/read-all
 * Marks all notifications as read for the authenticated user.
 */
router.patch('/read-all', authenticateUser, async (req, res, next) => {
  try {
    await markAllNotificationsAsRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/notifications/preferences
 * Returns the user's notification preferences.
 */
router.get('/preferences', authenticateUser, async (req, res, next) => {
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
    res.json({ success: true, data: prefs });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/notifications/preferences
 * Saves the user's notification preferences.
 */
router.put('/preferences', authenticateUser, async (req, res, next) => {
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
    next(err);
  }
});

module.exports = router;
