const router = require('express').Router();
const { authenticateUser, requireAdmin } = require('../middleware/authenticateUser');
const {
  getStats, listUsers,
  createReward, updateReward, deleteReward, getRewardById,
} = require('../db/adminRepository');

// All admin routes require a valid user token AND admin role
router.use(authenticateUser, requireAdmin);

/**
 * GET /api/admin/stats
 * Aggregate platform counts: users, points issued, redemptions, active rewards.
 * Requirements: #186
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
 * GET /api/admin/users?search=&page=1&limit=20
 * Paginated user list, searchable by email or name.
 * Requirements: #186
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
 * POST /api/admin/rewards
 * Create a new reward entry.
 * Requirements: #186
 */
router.post('/rewards', async (req, res, next) => {
  try {
    const { name, cost, stock, isActive } = req.body;
    if (!name || cost == null) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'name and cost are required' });
    }
    const reward = await createReward({ name, cost, stock, isActive });
    res.status(201).json({ success: true, data: reward });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/rewards/:id
 * Update reward details (name, cost, stock, isActive).
 * Requirements: #186
 */
router.patch('/rewards/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const reward = await updateReward(id, req.body);
    if (!reward) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Reward not found' });
    }
    res.json({ success: true, data: reward });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/rewards/:id
 * Soft-delete a reward.
 * Requirements: #186
 */
router.delete('/rewards/:id', async (req, res, next) => {
  try {
    const deleted = await deleteReward(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Reward not found' });
    }
    res.json({ success: true, message: 'Reward deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
