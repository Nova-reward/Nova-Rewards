const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/authenticateUser');

/**
 * PATCH /api/notifications/read-all
 * Stateless acknowledgement — client resets unreadCount on 200.
 * Auth: Bearer JWT required.
 */
router.patch('/read-all', authenticateUser, (req, res) => {
  res.json({ success: true });
});

module.exports = router;
