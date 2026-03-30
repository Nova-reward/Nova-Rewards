const { query } = require('./index');

async function logAudit({ entityType, entityId = null, action, performedBy = null, details = null, source = null }) {
     const result = await query(
          `INSERT INTO audit_logs
       (entity_type, entity_id, action, performed_by, details, source)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
          [entityType, entityId, action, performedBy, details ? JSON.stringify(details) : null, source]
     );
     return result.rows[0];
}

async function getAuditLogs({ entityType, entityId, page = 1, limit = 20 } = {}) {
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

     const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
     const offset = (page - 1) * limit;

     const countResult = await query(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`, params);
     const total = parseInt(countResult.rows[0].total, 10);

     const dataResult = await query(
          `SELECT * FROM audit_logs ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
          [...params, limit, offset]
     );

     return { data: dataResult.rows, total, page, limit };
}

module.exports = {
     logAudit,
     getAuditLogs,
};
