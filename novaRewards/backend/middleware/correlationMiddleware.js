'use strict';

const { v4: uuidv4 } = require('uuid');

const HEADER = 'x-correlation-id';

/**
 * Generates or propagates a correlation ID per request.
 * Attaches req.correlationId and echoes it in the response header.
 */
function correlationMiddleware(req, res, next) {
  req.correlationId = req.header(HEADER) || uuidv4();
  res.setHeader(HEADER, req.correlationId);
  next();
}

module.exports = { correlationMiddleware };
