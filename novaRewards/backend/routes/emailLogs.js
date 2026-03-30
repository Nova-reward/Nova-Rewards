const router = require('express').Router();
const { getEmailLogs, getEmailLogById } = require('../db/emailLogRepository');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

/**
 * @openapi
 * /admin/email-logs:
 *   get:
 *     tags: [Admin]
 *     summary: List paginated email logs
 *     security:
 *       - merchantApiKey: []
 *     parameters:
 *       - in: query
 *         name: recipientEmail
 *         schema: { type: string, format: email, example: alice@example.com }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [redemption_confirmation, milestone_achieved, welcome, password_reset] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [queued, sent, delivered, failed] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100, example: 20 }
 *     responses:
 *       200:
 *         description: Paginated email logs.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/EmailLog' }
 *                 total: { type: integer, example: 120 }
 *                 page: { type: integer, example: 1 }
 *                 limit: { type: integer, example: 20 }
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Missing or invalid API key.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
 * @openapi
 * /admin/email-logs/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get a specific email log by ID
 *     security:
 *       - merchantApiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 300 }
 *     responses:
 *       200:
 *         description: Email log entry.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/EmailLog' }
 *       400:
 *         description: Invalid id.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Log not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
