const { query } = require('./index');

async function createNotification({ userId, type, title, message, payload = null }) {
     const result = await query(
          `INSERT INTO notifications (user_id, type, title, message, payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
          [userId, type, title, message, payload ? JSON.stringify(payload) : null]
     );
     return result.rows[0];
}

async function getNotificationsForUser(userId, { page = 1, limit = 20 } = {}) {
     const offset = (page - 1) * limit;
     const countResult = await query(
          'SELECT COUNT(*) as total FROM notifications WHERE user_id = $1',
          [userId]
     );
     const total = parseInt(countResult.rows[0].total, 10);

     const data = await query(
          `SELECT * FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
          [userId, limit, offset]
     );

     return { data: data.rows, total, page, limit };
}

async function markNotificationAsRead(notificationId) {
     const { rows } = await query(
          `UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *`,
          [notificationId]
     );
     return rows[0] || null;
}

async function markAllNotificationsAsRead(userId) {
     await query(
          `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
          [userId]
     );
}

module.exports = {
     createNotification,
     getNotificationsForUser,
     markNotificationAsRead,
     markAllNotificationsAsRead,
};
