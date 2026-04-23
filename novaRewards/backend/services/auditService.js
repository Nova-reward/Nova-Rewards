const auditLogRepository = require('../db/auditLogRepository');

class AuditService {
     /**
      * Log an action to the audit logs
      * @param {Object} params
      * @param {string} params.entityType - e.g., 'campaign', 'reward', 'user'
      * @param {number|string} params.entityId - ID of the affected resource
      * @param {string} params.action - e.g., 'CREATE', 'UPDATE', 'DELETE'
      * @param {number} params.performedBy - User ID of the actor
      * @param {Object} [params.beforeState] - Previous state of the resource
      * @param {Object} [params.afterState] - New state of the resource
      * @param {string} [params.source] - e.g., 'admin_panel', 'api'
      * @param {Object} [params.details] - Any extra details
      */
     static async log({ entityType, entityId, action, performedBy, beforeState, afterState, source, details }) {
          try {
               return await auditLogRepository.logAudit({
                    entityType,
                    entityId,
                    action,
                    performedBy,
                    beforeState,
                    afterState,
                    source,
                    details
               });
          } catch (error) {
               // We don't want audit logging failure to crash the main transaction usually, 
               // but we should log it aggressively.
               console.error('AuditLogService Error:', error);
               throw error;
          }
     }

     /**
      * Query audit logs
      * @param {Object} filters
      */
     static async getLogs(filters) {
          return await auditLogRepository.getAuditLogs(filters);
     }
}

module.exports = AuditService;
