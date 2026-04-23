const router = require('express').Router();
const { authenticateUser, requireAdmin } = require('../middleware/authenticateUser');
const {
  getStats, listUsers,
  createReward, updateReward, deleteReward, getRewardById,
} = require('../db/adminRepository');
const {
  buildRecoveryPlan,
  listBackups,
} = require('../services/backupService');
const { runBackupCycle } = require('../jobs/backupJob');
const {
  getAuditLogs,
  exportAuditLogsCSV,
  getAuditStats,
} = require('../db/auditLogRepository');

// All admin routes require a valid user token AND admin role
router.use(authenticateUser, requireAdmin);

/**
 * @openapi
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Get aggregate platform statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform stats.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/AdminStats' }
 *       401:
 *         description: Unauthenticated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: Admin role required.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Paginated user list, searchable by email or name
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string, example: alice }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100, example: 20 }
 *     responses:
 *       200:
 *         description: Paginated user list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/User' }
 *                     total: { type: integer, example: 1500 }
 *                     page: { type: integer, example: 1 }
 *                     limit: { type: integer, example: 20 }
 *       401:
 *         description: Unauthenticated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/users', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const { users, total } = await listUsers({ search: req.query.search, page, limit });
    res.json({ success: true, data: { users, total, page, limit } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/rewards:
 *   post:
 *     tags: [Admin]
 *     summary: Create a new reward
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, cost]
 *             properties:
 *               name: { type: string, example: "10% Off Voucher" }
 *               cost: { type: integer, example: 500 }
 *               stock: { type: integer, example: 100 }
 *               isActive: { type: boolean, example: true }
 *     responses:
 *       201:
 *         description: Reward created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Reward' }
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Unauthenticated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/rewards', async (req, res, next) => {
  try {
    const { name, cost, stock, isActive } = req.body;
    if (!name || cost == null) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'name and cost are required' });
    }
    const reward = await createReward({ name, cost, stock, isActive });

    logAudit({
      entityType: 'reward',
      entityId: reward.id,
      action: 'admin_create_reward',
      performedBy: req.user.id,
      actorType: 'admin',
      details: { name, cost, stock, isActive },
      source: 'POST /api/admin/rewards',
    }).catch((err) => console.error('[audit] admin_create_reward:', err.message));

    res.status(201).json({ success: true, data: reward });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/rewards/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update a reward
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 12 }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "15% Off Voucher" }
 *               cost: { type: integer, example: 600 }
 *               stock: { type: integer, example: 80 }
 *               isActive: { type: boolean, example: false }
 *     responses:
 *       200:
 *         description: Updated reward.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Reward' }
 *       404:
 *         description: Reward not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.patch('/rewards/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const reward = await updateReward(id, req.body);
    if (!reward) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Reward not found' });
    }

    logAudit({
      entityType: 'reward',
      entityId: id,
      action: 'admin_update_reward',
      performedBy: req.user.id,
      actorType: 'admin',
      details: req.body,
      source: `PATCH /api/admin/rewards/${id}`,
    }).catch((err) => console.error('[audit] admin_update_reward:', err.message));

    res.json({ success: true, data: reward });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/rewards/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Soft-delete a reward
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 12 }
 *     responses:
 *       200:
 *         description: Reward deleted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Reward deleted" }
 *       404:
 *         description: Reward not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.delete('/rewards/:id', async (req, res, next) => {
  try {
    const rewardId = parseInt(req.params.id);
    const deleted = await deleteReward(rewardId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Reward not found' });
    }

    logAudit({
      entityType: 'reward',
      entityId: rewardId,
      action: 'admin_delete_reward',
      performedBy: req.user.id,
      actorType: 'admin',
      source: `DELETE /api/admin/rewards/${rewardId}`,
    }).catch((err) => console.error('[audit] admin_delete_reward:', err.message));

    res.json({ success: true, message: 'Reward deleted' });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Audit Log Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Retrieve audit logs with filtering
 *     description: >
 *       Returns a paginated list of audit log entries. Supports filtering by
 *       entity, actor, action, date range, HTTP metadata, and IP address.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entityType
 *         schema: { type: string, example: user }
 *       - in: query
 *         name: entityId
 *         schema: { type: integer, example: 42 }
 *       - in: query
 *         name: action
 *         schema: { type: string, example: login }
 *       - in: query
 *         name: performedBy
 *         schema: { type: integer, example: 7 }
 *       - in: query
 *         name: actorType
 *         schema: { type: string, enum: [user, admin, merchant, system] }
 *       - in: query
 *         name: merchantId
 *         schema: { type: integer, example: 3 }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time, example: "2026-01-01T00:00:00Z" }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time, example: "2026-12-31T23:59:59Z" }
 *       - in: query
 *         name: statusCode
 *         schema: { type: integer, example: 401 }
 *       - in: query
 *         name: httpMethod
 *         schema: { type: string, enum: [GET, POST, PUT, PATCH, DELETE] }
 *       - in: query
 *         name: endpoint
 *         schema: { type: string, example: "/api/auth" }
 *       - in: query
 *         name: ipAddress
 *         schema: { type: string, example: "192.168.1.1" }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 500 }
 *     responses:
 *       200:
 *         description: Paginated audit log entries.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/AuditLog' }
 *                 total: { type: integer, example: 1500 }
 *                 page: { type: integer, example: 1 }
 *                 limit: { type: integer, example: 50 }
 */
router.get('/audit-logs', async (req, res, next) => {
  try {
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
    } = req.query;

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(500, parseInt(req.query.limit) || 50);

    const result = await getAuditLogs({
      entityType,
      entityId:    entityId    ? parseInt(entityId, 10)    : undefined,
      action,
      performedBy: performedBy ? parseInt(performedBy, 10) : undefined,
      actorType,
      merchantId:  merchantId  ? parseInt(merchantId, 10)  : undefined,
      startDate,
      endDate,
      statusCode:  statusCode  ? parseInt(statusCode, 10)  : undefined,
      httpMethod,
      endpoint,
      ipAddress,
      page,
      limit,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/audit-logs/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Get audit log statistics for compliance reporting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: actorType
 *         schema: { type: string, enum: [user, admin, merchant, system] }
 *     responses:
 *       200:
 *         description: Aggregated audit statistics.
 */
router.get('/audit-logs/stats', async (req, res, next) => {
  try {
    const { startDate, endDate, actorType } = req.query;
    const stats = await getAuditStats({ startDate, endDate, actorType });
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/audit-logs/export:
 *   get:
 *     tags: [Admin]
 *     summary: Export audit logs as CSV for compliance reporting
 *     description: >
 *       Streams a CSV file containing up to 10,000 audit log entries matching
 *       the provided filters. Suitable for regulatory compliance exports.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: actorType
 *         schema: { type: string, enum: [user, admin, merchant, system] }
 *       - in: query
 *         name: entityType
 *         schema: { type: string }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: CSV file download.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/audit-logs/export', async (req, res, next) => {
  try {
    const { startDate, endDate, actorType, entityType, action } = req.query;

    const csv = await exportAuditLogsCSV({ startDate, endDate, actorType, entityType, action });

    const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
