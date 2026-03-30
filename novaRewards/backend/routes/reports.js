const router = require('express').Router();
const { getReport } = require('../services/reportingService');
const { toCSV, toPDF, flattenReportData } = require('../services/reportExporter');
const { scheduleReport, listSchedules, cancelSchedule, VALID_TYPES, VALID_INTERVALS } = require('../jobs/reportScheduler');
const { authenticateUser, requireAdmin } = require('../middleware/authenticateUser');

const VALID_FORMATS = ['csv', 'pdf'];

// All report endpoints require authentication + admin role
router.use(authenticateUser, requireAdmin);

/**
 * GET /api/reports/:type
 * Returns a cached or freshly generated report.
 * Query params are forwarded as report filters (e.g. merchantId, startDate, endDate).
 */
router.get('/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `type must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    const report = await getReport(type, req.query);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/:type/export?format=csv|pdf
 * Exports a report as a downloadable file.
 */
router.get('/:type/export', async (req, res, next) => {
  try {
    const { type } = req.params;
    const { format = 'csv', ...params } = req.query;

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `type must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    if (!VALID_FORMATS.includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `format must be one of: ${VALID_FORMATS.join(', ')}`,
      });
    }

    const report = await getReport(type, params);
    const filename = `nova-${type}-report-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'csv') {
      const rows = flattenReportData(report);
      const csv = toCSV(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    // PDF
    const pdf = toPDF(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    return res.send(pdf);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reports/schedule
 * Schedules an automated recurring report.
 * Body: { id, type, interval, params }
 */
router.post('/schedule', async (req, res, next) => {
  try {
    const { id, type, interval, params = {} } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'id (string) is required',
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `type must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    if (!VALID_INTERVALS.includes(interval)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `interval must be one of: ${VALID_INTERVALS.join(', ')}`,
      });
    }

    const schedule = scheduleReport(id, type, interval, params);
    res.status(201).json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/schedule
 * Lists all active scheduled reports.
 */
router.get('/schedule', (req, res) => {
  res.json({ success: true, data: listSchedules() });
});

/**
 * DELETE /api/reports/schedule/:id
 * Cancels a scheduled report.
 */
router.delete('/schedule/:id', (req, res) => {
  const removed = cancelSchedule(req.params.id);
  if (!removed) {
    return res.status(404).json({ success: false, error: 'not_found', message: 'Schedule not found' });
  }
  res.json({ success: true, data: { id: req.params.id, cancelled: true } });
});

module.exports = router;
