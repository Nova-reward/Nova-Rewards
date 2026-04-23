const { query } = require('./index');

/**
 * Logs an audit event with full context.
 * 
 * @param {object} params
 * @param {string} params.entityType - Entity being acted upon (e.g. 'user', 'campaign', 'reward')
 * @param {number} [params.entityId] - ID of the entity
 * @param {string} params.action - Action performed (e.g. 'login', 'create', 'update', 'delete')
 * @param {number} [params.performedBy] - User ID who performed the action
 * @param {string} [params.actorType='user'] - 'user' | 'admin' | 'merchant' | 'system'
 * @param {number} [params.merchantId] - Merchant ID if action was by a merchant
 * @param {object} [params.details] - Additional context (will be JSON stringified)
 * @param {string} [params.source] - Source system/service
 * @param {string} [params.ipAddress] - Client IP address
 * @param {string} [params.userAgent] - Client user agent
 * @param {string} [params.httpMethod] - HTTP method (GET, POST, etc.)
 * @param {string} [params.endpoint] - API endpoint path
 * @param {number} [params.statusCode] - HTTP response status code
 * @param {number} [params.durationMs] - Request duration in milliseconds
 * @returns {Promise<object>} The inserted audit log row
 */
async function logAudit({
  entityType,
  entityId = null,
  action,
  performedBy = null,
  actorType = 'user',
  merchantId = null,
  details = null,
  source = null,
  ipAddress = null,
  userAgent = null,
  httpMethod = null,
  endpoint = null,
  statusCode = null,
  durationMs = null,
}) {
  const result = await query(
    `INSERT INTO audit_logs
       (entity_type, entity_id, action, performed_by, actor_type, merchant_id,
        details, source, ip_address, user_agent, http_method, endpoint,
        status_code, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      entityType,
      entityId,
      action,
      performedBy,
      actorType,
      merchantId,
      details ? JSON.stringify(details) : null,
      source,
      ipAddress,
      userAgent,
      httpMethod,
      endpoint,
      statusCode,
      durationMs,
    ]
  );
  return result.rows[0];
}

/**
 * Retrieves audit logs with comprehensive filtering.
 * 
 * @param {object} filters
 * @param {string} [filters.entityType] - Filter by entity type
 * @param {number} [filters.entityId] - Filter by entity ID
 * @param {string} [filters.action] - Filter by action
 * @param {number} [filters.performedBy] - Filter by user ID
 * @param {string} [filters.actorType] - Filter by actor type
 * @param {number} [filters.merchantId] - Filter by merchant ID
 * @param {string} [filters.startDate] - ISO date string (inclusive)
 * @param {string} [filters.endDate] - ISO date string (inclusive)
 * @param {number} [filters.statusCode] - Filter by HTTP status code
 * @param {string} [filters.httpMethod] - Filter by HTTP method
 * @param {string} [filters.endpoint] - Filter by endpoint (partial match)
 * @param {string} [filters.ipAddress] - Filter by IP address
 * @param {number} [filters.page=1] - Page number
 * @param {number} [filters.limit=50] - Items per page (max 500)
 * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
 */
async function getAuditLogs(filters = {}) {
  const {
    entityType,
    entityId,
    action,
    performedBy,
    actorType,
    merchantId,
    startDate,
    endDate,
    statusCode,
    httpMethod,
    endpoint,
    ipAddress,
    page = 1,
    limit = 50,
  } = filters;

  const conditions = [];
  const params = [];
  let i = 1;

  if (entityType) {
    conditions.push(`entity_type = $${i++}`);
    params.push(entityType);
  }

  if (entityId != null) {
    conditions.push(`entity_id = $${i++}`);
    params.push(entityId);
  }

  if (action) {
    conditions.push(`action = $${i++}`);
    params.push(action);
  }

  if (performedBy != null) {
    conditions.push(`performed_by = $${i++}`);
    params.push(performedBy);
  }

  if (actorType) {
    conditions.push(`actor_type = $${i++}`);
    params.push(actorType);
  }

  if (merchantId != null) {
    conditions.push(`merchant_id = $${i++}`);
    params.push(merchantId);
  }

  if (startDate) {
    conditions.push(`created_at >= $${i++}`);
    params.push(startDate);
  }

  if (endDate) {
    conditions.push(`created_at <= $${i++}`);
    params.push(endDate);
  }

  if (statusCode != null) {
    conditions.push(`status_code = $${i++}`);
    params.push(statusCode);
  }

  if (httpMethod) {
    conditions.push(`http_method = $${i++}`);
    params.push(httpMethod.toUpperCase());
  }

  if (endpoint) {
    conditions.push(`endpoint ILIKE $${i++}`);
    params.push(`%${endpoint}%`);
  }

  if (ipAddress) {
    conditions.push(`ip_address = $${i++}`);
    params.push(ipAddress);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const offset = (Math.max(1, page) - 1) * safeLimit;

  const countResult = await query(
    `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  const dataResult = await query(
    `SELECT
       id, entity_type, entity_id, action, performed_by, actor_type, merchant_id,
       details, source, ip_address, user_agent, http_method, endpoint,
       status_code, duration_ms, created_at
     FROM audit_logs ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, safeLimit, offset]
  );

  return { data: dataResult.rows, total, page: Math.max(1, page), limit: safeLimit };
}

/**
 * Exports audit logs as CSV for compliance reporting.
 * 
 * @param {object} filters - Same filters as getAuditLogs
 * @returns {Promise<string>} CSV string
 */
async function exportAuditLogsCSV(filters = {}) {
  // Fetch all matching records (up to 10,000 for safety)
  const result = await getAuditLogs({ ...filters, page: 1, limit: 10000 });
  
  const headers = [
    'ID',
    'Timestamp',
    'Actor Type',
    'Performed By',
    'Merchant ID',
    'Entity Type',
    'Entity ID',
    'Action',
    'HTTP Method',
    'Endpoint',
    'Status Code',
    'Duration (ms)',
    'IP Address',
    'User Agent',
    'Source',
    'Details',
  ];

  const rows = result.data.map((log) => [
    log.id,
    log.created_at,
    log.actor_type || '',
    log.performed_by || '',
    log.merchant_id || '',
    log.entity_type || '',
    log.entity_id || '',
    log.action || '',
    log.http_method || '',
    log.endpoint || '',
    log.status_code || '',
    log.duration_ms || '',
    log.ip_address || '',
    log.user_agent ? `"${log.user_agent.replace(/"/g, '""')}"` : '',
    log.source || '',
    log.details ? `"${JSON.stringify(log.details).replace(/"/g, '""')}"` : '',
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  return csv;
}

/**
 * Gets audit log statistics for dashboard/reporting.
 * 
 * @param {object} filters - Date range and actor filters
 * @returns {Promise<object>} Aggregated stats
 */
async function getAuditStats(filters = {}) {
  const { startDate, endDate, actorType } = filters;
  const conditions = [];
  const params = [];
  let i = 1;

  if (startDate) {
    conditions.push(`created_at >= $${i++}`);
    params.push(startDate);
  }

  if (endDate) {
    conditions.push(`created_at <= $${i++}`);
    params.push(endDate);
  }

  if (actorType) {
    conditions.push(`actor_type = $${i++}`);
    params.push(actorType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
       COUNT(*) AS total_events,
       COUNT(DISTINCT performed_by) FILTER (WHERE performed_by IS NOT NULL) AS unique_users,
       COUNT(DISTINCT merchant_id) FILTER (WHERE merchant_id IS NOT NULL) AS unique_merchants,
       COUNT(*) FILTER (WHERE status_code >= 400) AS error_count,
       COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) AS success_count,
       AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS avg_duration_ms,
       MAX(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS max_duration_ms
     FROM audit_logs ${whereClause}`,
    params
  );

  return result.rows[0];
}

module.exports = {
  logAudit,
  getAuditLogs,
  exportAuditLogsCSV,
  getAuditStats,
};
