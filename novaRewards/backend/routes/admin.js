const router = require('express').Router();
const { authenticateUser, requireAdmin } = require('../middleware/authenticateUser');
const {
  getStats, listUsers,
  createReward, updateReward, deleteReward, getRewardById,
} = require('../db/adminRepository');
const {
  getCampaignById,
  softDeleteCampaign,
} = require('../db/campaignRepository');
const {
  buildRecoveryPlan,
  listBackups,
} = require('../services/backupService');
const { runBackupCycle } = require('../jobs/backupJob');
const AuditService = require('../services/auditService');
const { query } = require('../db/index');
const { unblock } = require('../middleware/abuseDetection');

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
    
    await AuditService.log({
      entityType: 'reward',
      entityId: reward.id,
      action: 'CREATE_REWARD',
      performedBy: req.user.id,
      afterState: reward,
      source: 'admin_api'
    });

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
    const beforeState = await getRewardById(id);
    if (!beforeState) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Reward not found' });
    }

    const reward = await updateReward(id, req.body);
    
    await AuditService.log({
      entityType: 'reward',
      entityId: reward.id,
      action: 'UPDATE_REWARD',
      performedBy: req.user.id,
      beforeState,
      afterState: reward,
      source: 'admin_api'
    });

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
    const id = parseInt(req.params.id);
    const beforeState = await getRewardById(id);
    const deleted = await deleteReward(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Reward not found' });
    }

    await AuditService.log({
      entityType: 'reward',
      entityId: id,
      action: 'DELETE_REWARD',
      performedBy: req.user.id,
      beforeState,
      afterState: { is_deleted: true },
      source: 'admin_api'
    });

    res.json({ success: true, message: 'Reward deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Retrieve audit logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entityType
 *         schema: { type: string }
 *       - in: query
 *         name: entityId
 *         schema: { type: integer }
 *       - in: query
 *         name: actor
 *         schema: { type: integer }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated audit logs.
 *       401:
 *         description: Unauthenticated.
 */
router.get('/audit-logs', async (req, res, next) => {
  try {
    const filters = {
      entityType: req.query.entityType,
      entityId: req.query.entityId ? parseInt(req.query.entityId) : null,
      actor: req.query.actor ? parseInt(req.query.actor) : null,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: Math.max(1, parseInt(req.query.page) || 1),
      limit: Math.min(100, parseInt(req.query.limit) || 20)
    };
    
    const logs = await AuditService.getLogs(filters);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/campaigns/{id}/pause:
 *   post:
 *     tags: [Admin]
 *     summary: Pause any campaign (admin override)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 3 }
 *     responses:
 *       200:
 *         description: Campaign paused.
 *       404:
 *         description: Campaign not found.
 */
router.post('/campaigns/:id/pause', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'id must be a positive integer' });
    }

    const campaign = await getCampaignById(id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    }

    const paused = await softDeleteCampaign(id, null);

    await AuditService.log({
      entityType: 'campaign',
      entityId: id,
      action: 'PAUSE_CAMPAIGN',
      performedBy: req.user.id,
      beforeState: campaign,
      afterState: paused,
      source: 'admin_api',
    });

    res.json({ success: true, data: paused });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/metrics:
 *   get:
 *     tags: [Admin]
 *     summary: Platform KPIs — total rewards issued, active campaigns, redemption totals
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform metrics.
 */
router.get('/metrics', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*)                          FROM users       WHERE is_deleted = FALSE)                          AS total_users,
        (SELECT COUNT(*)                          FROM campaigns   WHERE deleted_at IS NULL AND is_active = TRUE)     AS active_campaigns,
        (SELECT COUNT(*)                          FROM campaigns   WHERE deleted_at IS NULL)                          AS total_campaigns,
        (SELECT COALESCE(SUM(amount), 0)          FROM point_transactions WHERE type = 'earned')                     AS total_rewards_issued,
        (SELECT COUNT(*)                          FROM redemptions)                                                   AS total_redemptions,
        (SELECT COALESCE(SUM(points_spent), 0)    FROM redemptions)                                                  AS total_points_redeemed,
        (SELECT COUNT(*)                          FROM rewards     WHERE is_active = TRUE AND is_deleted = FALSE)     AS active_rewards
    `);

    await AuditService.log({
      entityType: 'metrics',
      entityId: null,
      action: 'VIEW_METRICS',
      performedBy: req.user.id,
      source: 'admin_api',
    });

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /admin/abuse/unblock/{identifier}:
 *   delete:
 *     tags: [Admin]
 *     summary: Manually unblock an IP or wallet flagged by abuse detection
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema: { type: string }
 *         description: IP address or wallet public key to unblock
 *     responses:
 *       200:
 *         description: Identifier unblocked.
 *       401:
 *         description: Unauthenticated.
 *       403:
 *         description: Admin role required.
 */
router.delete('/abuse/unblock/:identifier', async (req, res, next) => {
  try {
    const { identifier } = req.params;
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'identifier is required' });
    }
    await unblock(identifier);
    await AuditService.log({
      entityType: 'abuse_block',
      entityId: null,
      action: 'MANUAL_UNBLOCK',
      performedBy: req.user.id,
      afterState: { identifier, unblocked: true },
      source: 'admin_api',
    });
    res.json({ success: true, message: `${identifier} has been unblocked` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
