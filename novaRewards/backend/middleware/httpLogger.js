'use strict';

const logger = require('../lib/logger');

/**
 * Logs every HTTP request/response in structured JSON with correlationId.
 * Depends on correlationMiddleware running first.
 */
function httpLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('http request', {
      correlationId: req.correlationId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}

module.exports = { httpLogger };
