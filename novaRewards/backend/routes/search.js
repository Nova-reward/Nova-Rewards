/**
 * Search routes
 *
 * GET  /api/search          — full-text + faceted search
 * GET  /api/search/suggest  — autocomplete suggestions
 * POST /api/search/click    — record a click-through event
 * GET  /api/search/analytics/top-queries  — admin: top queries
 * GET  /api/search/analytics/stats        — admin: aggregate stats
 * POST /api/search/reindex  — admin: trigger bulk reindex
 */

const router = require('express').Router();
const { authenticateUser, requireAdmin } = require('../middleware/authenticateUser');
const { search, suggest, bulkIndex, ensureIndices } = require('../services/searchService');
const { recordSearch, recordClick, getTopQueries, getSearchStats } = require('../db/searchAnalyticsRepository');
const { query: dbQuery } = require('../db/index');

// ---------------------------------------------------------------------------
// GET /api/search
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /search:
 *   get:
 *     summary: Full-text search across rewards, campaigns, and users
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [rewards, campaigns, users, all] }
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *       - in: query
 *         name: merchant_id
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Search results with facets
 */
router.get('/', authenticateUser, async (req, res, next) => {
  try {
    const q          = (req.query.q || '').trim();
    const entityType = req.query.type || 'all';
    const page       = Math.max(1, parseInt(req.query.page) || 1);
    const limit      = Math.min(50, parseInt(req.query.limit) || 20);

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Query parameter "q" is required',
      });
    }

    // Build optional filters
    const filters = {};
    if (req.query.is_active !== undefined) filters.is_active = req.query.is_active === 'true';
    if (req.query.merchant_id)             filters.merchant_id = parseInt(req.query.merchant_id);
    if (req.query.role)                    filters.role = req.query.role;

    const { hits, total, facets, durationMs } = await search({ q, entityType, filters, page, limit });

    // Fire-and-forget analytics — don't block the response
    recordSearch({
      userId:      req.user?.id,
      queryText:   q,
      entityType,
      resultCount: total,
      durationMs,
    }).catch((err) => console.error('[Search] analytics write failed:', err));

    res.json({
      success: true,
      data: {
        hits,
        total,
        page,
        limit,
        facets,
        durationMs,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/search/suggest
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /search/suggest:
 *   get:
 *     summary: Autocomplete suggestions
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [rewards, campaigns, users, all] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 5 }
 */
router.get('/suggest', async (req, res, next) => {
  try {
    const prefix     = (req.query.q || '').trim();
    const entityType = req.query.type || 'all';
    const limit      = Math.min(10, parseInt(req.query.limit) || 5);

    if (!prefix) {
      return res.json({ success: true, data: [] });
    }

    const suggestions = await suggest({ prefix, entityType, limit });
    res.json({ success: true, data: suggestions });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/search/click
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /search/click:
 *   post:
 *     summary: Record a click-through on a search result
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [analyticsId, clickedId, clickedType]
 *             properties:
 *               analyticsId: { type: integer }
 *               clickedId:   { type: integer }
 *               clickedType: { type: string }
 */
router.post('/click', authenticateUser, async (req, res, next) => {
  try {
    const { analyticsId, clickedId, clickedType } = req.body;

    if (!analyticsId || !clickedId || !clickedType) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'analyticsId, clickedId, and clickedType are required',
      });
    }

    await recordClick(analyticsId, clickedId, clickedType);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Admin analytics endpoints
// ---------------------------------------------------------------------------

router.get('/analytics/top-queries', authenticateUser, requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const since = req.query.since || '7 days';
    const rows  = await getTopQueries({ limit, since });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/analytics/stats', authenticateUser, requireAdmin, async (req, res, next) => {
  try {
    const stats = await getSearchStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/search/reindex  — admin only, triggers full reindex from Postgres
// ---------------------------------------------------------------------------

router.post('/reindex', authenticateUser, requireAdmin, async (req, res, next) => {
  try {
    await ensureIndices();

    const [rewards, campaigns, users] = await Promise.all([
      dbQuery('SELECT * FROM rewards   WHERE is_deleted = FALSE'),
      dbQuery('SELECT * FROM campaigns WHERE is_deleted = FALSE'),
      dbQuery('SELECT id, email, first_name, last_name, wallet_address, role, created_at FROM users WHERE is_deleted = FALSE'),
    ]);

    await Promise.all([
      bulkIndex('rewards',   rewards.rows),
      bulkIndex('campaigns', campaigns.rows),
      bulkIndex('users',     users.rows),
    ]);

    res.json({
      success: true,
      data: {
        rewards:   rewards.rows.length,
        campaigns: campaigns.rows.length,
        users:     users.rows.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
