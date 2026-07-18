const router = require('express').Router();
const { getContractEvents, getContractEventById } = require('../db/contractEventRepository');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

/**
 * @openapi
 * /contract-events:
 *   get:
 *     tags: [Contract Events]
 *     summary: List paginated contract events
 *     security:
 *       - merchantApiKey: []
 *     parameters:
 *       - in: query
 *         name: contractId
 *         schema: { type: string, example: CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [mint, claim, stake, unstake] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100, example: 20 }
 *     responses:
 *       200:
 *         description: Paginated contract events.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ContractEvent' }
 *                 total: { type: integer, example: 42 }
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
    const { contractId, type, page = 1, limit = 20 } = req.query;

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
    const validTypes = ['mint', 'claim', 'stake', 'unstake'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `type must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Get paginated contract events
    const result = await getContractEvents({
      contractId,
      eventType: type,
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
 * /contract-events/{id}:
 *   get:
 *     tags: [Contract Events]
 *     summary: Get a specific contract event by ID
 *     security:
 *       - merchantApiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 200 }
 *     responses:
 *       200:
 *         description: Contract event.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/ContractEvent' }
 *       400:
 *         description: Invalid id.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404:
 *         description: Event not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id', authenticateMerchant, async (req, res, next) => {
  try {
    const { id } = req.params;
    const eventId = parseInt(id, 10);

    if (isNaN(eventId) || eventId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'id must be a positive integer',
      });
    }

    const event = await getContractEventById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Contract event not found',
      });
    }

    res.json({
      success: true,
      data: event,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
