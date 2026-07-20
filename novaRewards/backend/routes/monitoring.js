/**
 * Monitoring API routes.
 *
 * GET /api/monitoring/metrics   — current metrics snapshot
 * GET /api/monitoring/events    — recent domain events (filterable)
 * GET /api/monitoring/alerts    — current alert states + optional history
 *
 * All endpoints return the standard { success, data } envelope used
 * throughout the Nova Rewards API.
 */

const router = require('express').Router();
const metrics = require('../monitoring/metricsCollector');
const { getEvents, countEvents } = require('../monitoring/eventsLogger');
const { evaluate, getAlertHistory } = require('../monitoring/alertsEngine');

// ── GET /api/monitoring/metrics ───────────────────────────────────────────────

/**
 * Returns a full metrics snapshot.
 *
 * Response shape:
 * {
 *   success: true,
 *   data: {
 *     timestamp: string,
 *     uptime: number,          // seconds
 *     counters: object,
 *     gauges: object,
 *     errorRate: number,       // percent
 *     responseTimes: object,   // per-route p50/p95/p99/avg/min/max/count
 *   }
 * }
 */
router.get('/metrics', (req, res) => {
  res.json({ success: true, data: metrics.snapshot() });
});

// ── GET /api/monitoring/events ────────────────────────────────────────────────

/**
 * Returns recent domain events, newest first.
 *
 * Query params:
 *   type     {string}  - filter by event type  (e.g. 'reward.distributed')
 *   severity {string}  - filter by severity    (info | warn | error)
 *   limit    {number}  - max results (default 50, max 200)
 *   offset   {number}  - pagination offset (default 0)
 *
 * Response shape:
 * {
 *   success: true,
 *   data: {
 *     events: object[],
 *     total: number,
 *     limit: number,
 *     offset: number,
 *   }
 * }
 */
router.get('/events', (req, res) => {
  const { type, severity } = req.query;
  const limit  = Math.min(parseInt(req.query.limit  ?? '50', 10), 200);
  const offset = Math.max(parseInt(req.query.offset ?? '0',  10), 0);

  const events = getEvents({ type, severity, limit, offset });
  const total  = countEvents({ type, severity });

  res.json({
    success: true,
    data: { events, total, limit, offset },
  });
});

// ── GET /api/monitoring/alerts ────────────────────────────────────────────────

/**
 * Evaluates all alert rules and returns current states.
 *
 * Query params:
 *   history  {boolean|'true'} - also include the last 50 alert transitions
 *
 * Response shape:
 * {
 *   success: true,
 *   data: {
 *     alerts: object[],        // current state per rule
 *     firing: number,          // count of currently firing alerts
 *     history?: object[],      // present only when ?history=true
 *   }
 * }
 */
router.get('/alerts', (req, res) => {
  const alerts = evaluate(); // also updates alertState in-place
  const firing = alerts.filter((a) => a.state === 'firing').length;

  const data = { alerts, firing };
  if (req.query.history === 'true') {
    data.history = getAlertHistory(50);
  }

  res.json({ success: true, data });
});

module.exports = router;
