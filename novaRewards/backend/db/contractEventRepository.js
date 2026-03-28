const { query } = require('./index');

/**
 * Records a contract event for audit logging.
 * Requirements: #182
 *
 * @param {object} params
 * @param {string} params.contractId
 * @param {string} params.eventType - 'mint' | 'claim' | 'stake' | 'unstake'
 * @param {object} params.eventData
 * @param {string} [params.transactionHash]
 * @param {number} [params.ledgerSequence]
 * @returns {Promise<object>} The inserted event row
 */
async function recordContractEvent({
  contractId,
  eventType,
  eventData,
  transactionHash,
  ledgerSequence,
}) {
  const result = await query(
    `INSERT INTO contract_events
       (contract_id, event_type, event_data, transaction_hash, ledger_sequence)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [contractId, eventType, JSON.stringify(eventData), transactionHash, ledgerSequence]
  );
  return result.rows[0];
}

/**
 * Marks a contract event as processed.
 * Requirements: #182
 *
 * @param {number} eventId
 * @returns {Promise<object>}
 */
async function markEventProcessed(eventId) {
  const result = await query(
    `UPDATE contract_events
     SET status = 'processed', processed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [eventId]
  );
  return result.rows[0];
}

/**
 * Marks a contract event as failed and increments retry count.
 * Requirements: #182
 *
 * @param {number} eventId
 * @param {string} errorMessage
 * @returns {Promise<object>}
 */
async function markEventFailed(eventId, errorMessage) {
  const result = await query(
    `UPDATE contract_events
     SET status = 'failed', 
         error_message = $2,
         retry_count = retry_count + 1
     WHERE id = $1
     RETURNING *`,
    [eventId, errorMessage]
  );
  return result.rows[0];
}

/**
 * Gets pending contract events that need to be retried.
 * Requirements: #182
 *
 * @param {number} maxRetries - Maximum retry count before giving up
 * @returns {Promise<object[]>}
 */
async function getPendingEvents(maxRetries = 5) {
  const result = await query(
    `SELECT * FROM contract_events
     WHERE status = 'pending'
        OR (status = 'failed' AND retry_count < $1)
     ORDER BY created_at ASC`,
    [maxRetries]
  );
  return result.rows;
}

/**
 * Gets contract events with pagination and filtering.
 * Requirements: #182
 *
 * @param {object} params
 * @param {string} [params.contractId]
 * @param {string} [params.eventType]
 * @param {number} params.page
 * @param {number} params.limit
 * @returns {Promise<{data: object[], total: number, page: number, limit: number}>}
 */
async function getContractEvents({ contractId, eventType, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (contractId) {
    conditions.push(`contract_id = $${paramIndex++}`);
    params.push(contractId);
  }

  if (eventType) {
    conditions.push(`event_type = $${paramIndex++}`);
    params.push(eventType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM contract_events ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated data
  const dataResult = await query(
    `SELECT * FROM contract_events
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
 * Gets a contract event by ID.
 * Requirements: #182
 *
 * @param {number} eventId
 * @returns {Promise<object|null>}
 */
async function getContractEventById(eventId) {
  const result = await query(
    'SELECT * FROM contract_events WHERE id = $1',
    [eventId]
  );
  return result.rows[0] || null;
}

module.exports = {
  recordContractEvent,
  markEventProcessed,
  markEventFailed,
  getPendingEvents,
  getContractEvents,
  getContractEventById,
};
