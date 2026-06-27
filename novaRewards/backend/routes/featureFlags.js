const router = require('express').Router();
const { authenticateUser, requireAdmin } = require('../middleware/authenticateUser');
const svc = require('../services/featureFlagService');

/** GET /api/feature-flags — list all (admin) */
router.get('/', authenticateUser, requireAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await svc.listFlags() });
  } catch (err) { next(err); }
});

/** POST /api/feature-flags — create (admin) */
router.post('/', authenticateUser, requireAdmin, async (req, res, next) => {
  try {
    const { key, enabled, rollout_pct, variants, metadata, expires_at } = req.body;
    if (!key) return res.status(400).json({ success: false, error: 'validation_error', message: 'key is required' });
    const flag = await svc.createFlag({ key, enabled, rollout_pct, variants, metadata, expires_at });
    res.status(201).json({ success: true, data: flag });
  } catch (err) { next(err); }
});

/** GET /api/feature-flags/:key — get one (admin) */
router.get('/:key', authenticateUser, requireAdmin, async (req, res, next) => {
  try {
    const flag = await svc.getFlag(req.params.key);
    if (!flag) return res.status(404).json({ success: false, error: 'not_found' });
    res.json({ success: true, data: flag });
  } catch (err) { next(err); }
});

/** PATCH /api/feature-flags/:key — update (admin) */
router.patch('/:key', authenticateUser, requireAdmin, async (req, res, next) => {
  try {
    const flag = await svc.updateFlag(req.params.key, req.body);
    if (!flag) return res.status(404).json({ success: false, error: 'not_found' });
    res.json({ success: true, data: flag });
  } catch (err) { next(err); }
});

/** DELETE /api/feature-flags/:key — delete (admin) */
router.delete('/:key', authenticateUser, requireAdmin, async (req, res, next) => {
  try {
    const deleted = await svc.deleteFlag(req.params.key);
    if (!deleted) return res.status(404).json({ success: false, error: 'not_found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

/** POST /api/feature-flags/:key/evaluate — evaluate for current user */
router.post('/:key/evaluate', authenticateUser, async (req, res, next) => {
  try {
    const result = await svc.evaluate(req.params.key, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/** GET /api/feature-flags/:key/analytics — evaluation stats (admin) */
router.get('/:key/analytics', authenticateUser, requireAdmin, async (req, res, next) => {
  try {
    const data = await svc.getFlagAnalytics(req.params.key, req.query.since || '7 days');
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/** POST /api/feature-flags/cleanup — delete stale flags (admin) */
router.post('/cleanup', authenticateUser, requireAdmin, async (req, res, next) => {
  try {
    const deleted = await svc.cleanupStaleFlags();
    res.json({ success: true, data: { deleted } });
  } catch (err) { next(err); }
});

module.exports = router;
