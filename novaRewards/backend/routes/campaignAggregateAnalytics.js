'use strict';
/**
 * Aggregate Campaign Analytics
 * GET /api/v1/analytics/campaigns/aggregate
 *
 * Returns platform-wide campaign KPIs for the authenticated merchant.
 * Merchants only see their own data. Admins can pass ?merchant_id to scope.
 */

const router = require('express').Router();
const { query } = require('../db/index');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');
const logger = require('../lib/logger');

// ---------------------------------------------------------------------------
// Helper: parse optional date range from query string
// ---------------------------------------------------------------------------
function parseDateRange(queryParams) {
  const { start_date, end_date } = queryParams;
  const errors = [];

  let parsedStart = null;
  let parsedEnd = null;

  if (start_date) {
    parsedStart = new Date(start_date);
    if (isNaN(parsedStart.getTime())) errors.push('start_date must be a valid ISO date');
  }

  if (end_date) {
    parsedEnd = new Date(end_date);
    if (isNaN(parsedEnd.getTime())) errors.push('end_date must be a valid ISO date');
  }

  if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
    errors.push('start_date must be before end_date');
  }

  return { parsedStart, parsedEnd, errors };
}

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/campaigns/aggregate
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /analytics/campaigns/aggregate:
 *   get:
 *     tags: [Analytics]
 *     summary: Get aggregated campaign analytics for the merchant
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema: { type: string, format: date }
 *         description: Filter campaigns created/updated from this date
 *       - in: query
 *         name: end_date
 *         schema: { type: string, format: date }
 *         description: Filter campaigns created/updated to this date
 *     responses:
 *       200:
 *         description: Aggregated analytics data
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/aggregate', authenticateMerchant, async (req, res, next) => {
  try {
    const merchantId = req.merchant.id;
    const { parsedStart, parsedEnd, errors } = parseDateRange(req.query);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: errors.join('; '),
      });
    }

    // Build dynamic WHERE clause for date range
    const conditions = ['c.merchant_id = $1'];
    const params = [merchantId];
    let paramIdx = 2;

    if (parsedStart) {
      conditions.push(`c.created_at >= $${paramIdx++}`);
      params.push(parsedStart.toISOString());
    }
    if (parsedEnd) {
      conditions.push(`c.created_at <= $${paramIdx++}`);
      params.push(parsedEnd.toISOString());
    }

    const whereClause = conditions.join(' AND ');

    // ── Main aggregation query ────────────────────────────────────────────
    const aggregateSQL = `
      SELECT
        COUNT(*)                                                          AS total_campaigns,
        COUNT(*) FILTER (WHERE c.status = 'active')                      AS active_campaigns,
        COUNT(*) FILTER (WHERE c.status = 'inactive'
                            OR c.status = 'expired'
                            OR (c.end_date IS NOT NULL AND c.end_date < NOW())) AS expired_campaigns,
        COALESCE(SUM(c.token_amount), 0)                                 AS total_token_allocation,
        COALESCE(SUM(c.tokens_issued), 0)                                AS total_tokens_issued,
        COALESCE(AVG(
          CASE WHEN c.token_amount > 0
               THEN (c.tokens_issued::numeric / c.token_amount) * 100
               ELSE 0
          END
        ), 0)                                                            AS avg_budget_utilization_pct
      FROM campaigns c
      WHERE ${whereClause}
    `;

    // ── Redemption aggregation ────────────────────────────────────────────
    const redemptionSQL = `
      SELECT
        COUNT(r.id)                                                       AS total_redemptions,
        COALESCE(SUM(r.amount), 0)                                        AS total_redeemed_tokens,
        COALESCE(
          COUNT(r.id)::numeric /
          NULLIF(COUNT(DISTINCT r.user_id), 0),
        0)                                                                AS avg_redemptions_per_user
      FROM redemptions r
      JOIN campaigns c ON r.campaign_id = c.id
      WHERE ${whereClause.replace(/c\./g, 'c.')}
    `;

    // ── Unique active users ───────────────────────────────────────────────
    const usersSQL = `
      SELECT COUNT(DISTINCT ri.user_id) AS unique_rewarded_users
      FROM reward_issuances ri
      JOIN campaigns c ON ri.campaign_id = c.id
      WHERE ${whereClause.replace(/c\./g, 'c.')}
        AND ri.status = 'confirmed'
    `;

    const [aggregateResult, redemptionResult, usersResult] = await Promise.all([
      query(aggregateSQL, params),
      query(redemptionSQL, params).catch(() => ({ rows: [{}] })),
      query(usersSQL, params).catch(() => ({ rows: [{}] })),
    ]);

    const agg = aggregateResult.rows[0] ?? {};
    const red = redemptionResult.rows[0] ?? {};
    const usr = usersResult.rows[0] ?? {};

    const totalAllocated = Number(agg.total_token_allocation ?? 0);
    const totalIssued = Number(agg.total_tokens_issued ?? 0);
    const totalRedeemed = Number(red.total_redeemed_tokens ?? 0);

    const redemptionRate =
      totalIssued > 0 ? Math.round((totalRedeemed / totalIssued) * 10000) / 100 : 0;

    return res.json({
      success: true,
      data: {
        campaigns: {
          total: Number(agg.total_campaigns ?? 0),
          active: Number(agg.active_campaigns ?? 0),
          expired: Number(agg.expired_campaigns ?? 0),
        },
        tokens: {
          total_allocated: totalAllocated,
          total_issued: totalIssued,
          total_redeemed: totalRedeemed,
          avg_budget_utilization_pct: Math.round(Number(agg.avg_budget_utilization_pct ?? 0) * 100) / 100,
        },
        redemptions: {
          total: Number(red.total_redemptions ?? 0),
          redemption_rate_pct: redemptionRate,
          avg_per_user: Math.round(Number(red.avg_redemptions_per_user ?? 0) * 100) / 100,
        },
        users: {
          unique_rewarded: Number(usr.unique_rewarded_users ?? 0),
        },
        filters: {
          merchant_id: merchantId,
          start_date: parsedStart ? parsedStart.toISOString() : null,
          end_date: parsedEnd ? parsedEnd.toISOString() : null,
        },
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('[CampaignAggregate] error', { error: err.message });
    next(err);
  }
});

module.exports = router;
