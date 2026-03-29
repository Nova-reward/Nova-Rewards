const router = require('express').Router();
const { getContractEvents, getContractEventById } = require('../db/contractEventRepository');
const { authenticateMerchant } = require('../middleware/authenticateMerchant');

/**
 * GET /api/contract-events
 * Returns paginated contract events for admin inspection.
 * Requirements: #182
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
 * GET /api/contract-events/:id
 * Returns a specific contract event by ID.
 * Requirements: #182
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
