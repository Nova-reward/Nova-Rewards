const { query } = require('./index');

/**
 * Records an email log entry.
 * Requirements: #184
 *
 * @param {object} params
 * @param {string} params.recipientEmail
 * @param {string} params.emailType - 'redemption_confirmation' | 'milestone_achieved' | 'welcome' | 'password_reset'
 * @param {string} params.subject
 * @returns {Promise<object>} The inserted log row
 */
async function createEmailLog({ recipientEmail, emailType, subject }) {
  const result = await query(
    `INSERT INTO email_logs
       (recipient_email, email_type, subject)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [recipientEmail, emailType, subject]
  );
  return result.rows[0];
}

/**
 * Updates email log status to 'sent'.
 * Requirements: #184
 *
 * @param {number} logId
 * @returns {Promise<object>}
 */
async function markEmailSent(logId) {
  const result = await query(
    `UPDATE email_logs
     SET status = 'sent', sent_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [logId]
  );
  return result.rows[0];
}

/**
 * Updates email log status to 'delivered'.
 * Requirements: #184
 *
 * @param {number} logId
 * @returns {Promise<object>}
 */
async function markEmailDelivered(logId) {
  const result = await query(
    `UPDATE email_logs
     SET status = 'delivered', delivered_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [logId]
  );
  return result.rows[0];
}

/**
 * Updates email log status to 'failed' with error message.
 * Requirements: #184
 *
 * @param {number} logId
 * @param {string} errorMessage
 * @returns {Promise<object>}
 */
async function markEmailFailed(logId, errorMessage) {
  const result = await query(
    `UPDATE email_logs
     SET status = 'failed', error_message = $2
     WHERE id = $1
     RETURNING *`,
    [logId, errorMessage]
  );
  return result.rows[0];
}

/**
 * Gets email logs with pagination and filtering.
 * Requirements: #184
 *
 * @param {object} params
 * @param {string} [params.recipientEmail]
 * @param {string} [params.emailType]
 * @param {string} [params.status]
 * @param {number} params.page
 * @param {number} params.limit
 * @returns {Promise<{data: object[], total: number, page: number, limit: number}>}
 */
async function getEmailLogs({ recipientEmail, emailType, status, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (recipientEmail) {
    conditions.push(`recipient_email = $${paramIndex++}`);
    params.push(recipientEmail);
  }

  if (emailType) {
    conditions.push(`email_type = $${paramIndex++}`);
    params.push(emailType);
  }

  if (status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM email_logs ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated data
  const dataResult = await query(
    `SELECT * FROM email_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return {
    data: dataResult.rows,
    total,
    page,
    limit,
  };
}

/**
 * Gets an email log by ID.
 * Requirements: #184
 *
 * @param {number} logId
 * @returns {Promise<object|null>}
 */
async function getEmailLogById(logId) {
  const result = await query(
    'SELECT * FROM email_logs WHERE id = $1',
    [logId]
  );
  return result.rows[0] || null;
}

module.exports = {
  createEmailLog,
  markEmailSent,
  markEmailDelivered,
  markEmailFailed,
  getEmailLogs,
  getEmailLogById,
};
