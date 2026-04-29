'use strict';
/**
 * Campaign Analytics API — Issue #588
 *
 * GET /api/campaigns/:id/analytics
 *   Returns KPIs and time-series data for a campaign.
 *   Supports date range filtering and daily/weekly/monthly aggregation.
 *   Responds with JSON by default; CSV when Accept: text/csv is set.
 *
 * Query parameters:
 *   startDate   ISO date string  e.g. 2025-01-01
 *   endDate     ISO date string  e.g. 2025-12-31
 *   granularity daily | weekly | monthly  (default: daily)
 */
const router = require('express').Router({ mergeParams: true });
const { authenticateMerchant } = require('../middleware/authenticateMerchant');
const { getCampaignById } = require('../db/campaignRepository');
const {
  getCampaignAnalytics,
  getCampaignAnalyticsExportRows,
  parseAnalyticsParams,
} = require('../services/campaignAnalyticsService');
const { toCSV } = require('../services/reportExporter');

/**
 * Validates that :id is a positive integer and that the campaign belongs
 * to the authenticated merchant.
 */
async function resolveCampaign(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({
      success: false,
      error: 'validation_error',
      message: 'Campaign id must be a positive integer',
    });
    return null;
  }

  const campaign = await getCampaignById(id);
  if (!campaign) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Campaign not found' });
    return null;
  }

  if (campaign.merchant_id !== req.merchant.id) {
    res.status(403).json({ success: false, error: 'forbidden', message: 'Access denied' });
    return null;
  }

  return campaign;
}

/**
 * GET /api/campaigns/:id/analytics
 *
 * Returns campaign KPIs and time-series breakdown.
 * Set Accept: text/csv to receive a downloadable CSV export instead.
 *
 * @swagger
 * /campaigns/{id}/analytics:
 *   get:
 *     summary: Get campaign analytics
 *     tags: [Campaigns]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Campaign ID
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Filter from this date (inclusive)
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: Filter to this date (inclusive)
 *       - in: query
 *         name: granularity
 *         schema: { type: string, enum: [daily, weekly, monthly] }
 *         description: Time-series bucket size (default daily)
 *     responses:
 *       200:
 *         description: Campaign analytics payload or CSV file
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied
 *       404:
 *         description: Campaign not found
 */
router.get('/:id/analytics', authenticateMerchant, async (req, res, next) => {
  try {
    const campaign = await resolveCampaign(req, res);
    if (!campaign) return; // response already sent

    const { valid, errors, params } = parseAnalyticsParams(req.query);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: errors.join('; '),
      });
    }

    const acceptHeader = (req.headers.accept || '').toLowerCase();
    const wantsCSV = acceptHeader.includes('text/csv');

    if (wantsCSV) {
      // CSV export path
      const rows = await getCampaignAnalyticsExportRows(campaign.id, params);

      if (rows.length === 0) {
        // Return an empty CSV with headers rather than a blank body
        const emptyRow = {
          campaign_id: campaign.id,
          period: '',
          issued: 0,
          redeemed: 0,
          active_users: 0,
          total_issued: 0,
          total_redeemed: 0,
          unique_users: 0,
          avg_reward_value: 0,
          redemption_rate: 0,
        };
        const csv = toCSV([emptyRow]);
        res.set('Content-Type', 'text/csv');
        res.set(
          'Content-Disposition',
          `attachment; filename="campaign-${campaign.id}-analytics.csv"`
        );
        return res.send(csv);
      }

      const csv = toCSV(rows);
      res.set('Content-Type', 'text/csv');
      res.set(
        'Content-Disposition',
        `attachment; filename="campaign-${campaign.id}-analytics.csv"`
      );
      return res.send(csv);
    }

    // JSON path
    const analytics = await getCampaignAnalytics(campaign.id, params);
    return res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
