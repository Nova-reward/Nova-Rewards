const router = require('express').Router();
const { getEmailLogs, getEmailLogById } = require('../db/emailLogRepository');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

/**
 * GET /api/admin/email-logs
 * Returns paginated email logs for admin debugging.
 * Requirements: #184
 */
router.get('/', authenticateMerchant, async (req, res, next) => {
  try {
    const { recipientEmail, type, status, page = 1, limit = 20 } = req.query;

    // Validate page parameter
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'page must be a positive integer',
      });
    }

    // Validate limit parameter
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'limit must be a positive integer between 1 and 100',
      });
    }

    // Validate type parameter if provided
    const validTypes = ['redemption_confirmation', 'milestone_achieved', 'welcome', 'password_reset'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `type must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Validate status parameter if provided
    const validStatuses = ['queued', 'sent', 'delivered', 'failed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Get paginated email logs
    const result = await getEmailLogs({
      recipientEmail,
      emailType: type,
      status,
      page: pageNum,
      limit: limitNum,
    });

    res.json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/email-logs/:id
 * Returns a specific email log by ID.
 * Requirements: #184
 */
router.get('/:id', authenticateMerchant, async (req, res, next) => {
  try {
    const { id } = req.params;
    const logId = parseInt(id, 10);

    if (isNaN(logId) || logId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'id must be a positive integer',
      });
    }

    const log = await getEmailLogById(logId);
    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Email log not found',
      });
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
