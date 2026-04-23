const { query } = require('./index');

async function logAudit({ entityType, entityId = null, action, performedBy = null, details = null, source = null, beforeState = null, afterState = null }) {
     const result = await query(
          `INSERT INTO audit_logs
       (entity_type, entity_id, action, performed_by, details, source, before_state, after_state)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
          [entityType, entityId, action, performedBy, details ? JSON.stringify(details) : null, source, beforeState ? JSON.stringify(beforeState) : null, afterState ? JSON.stringify(afterState) : null]
     );
     return result.rows[0];
}


async function getAuditLogs({ entityType, entityId, actor, action, startDate, endDate, page = 1, limit = 20 } = {}) {
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

     if (actor != null) {
          conditions.push(`performed_by = $${i++}`);
          params.push(actor);
     }

     if (action) {
          conditions.push(`action = $${i++}`);
          params.push(action);
     }

     if (startDate) {
          conditions.push(`created_at >= $${i++}`);
          params.push(startDate);
     }

     if (endDate) {
          conditions.push(`created_at <= $${i++}`);
          params.push(endDate);
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
