const { v4: uuidv4 } = require('uuid');
const { asyncLocalStorage, getLogger } = require('../lib/logger');

/**
 * Middleware to generate and propagate trace IDs.
 * Requirements: #366 Distributed Tracing
 */
function tracingMiddleware(req, res, next) {
  // Check if trace ID already exists (e.g., from upstream service or client)
  const incomingTraceId = req.header('x-trace-id') || req.header('x-correlation-id');
  const correlationId = incomingTraceId || uuidv4();

  // Attach correlationId to the request object for use in services and logging
  req.correlationId = correlationId;

  // Add correlationId to the response headers for observability
  res.setHeader('x-correlation-id', correlationId);

  // We can also create a basic "span" start time here if needed
  req.startTime = Date.now();

  // Run the rest of the request handling inside an AsyncLocalStorage scope
  asyncLocalStorage.run({ correlationId }, () => {
    // attach a convenience getter to req so middleware like pino-http can pick it up if needed
    req.getCorrelationId = () => correlationId;
    next();
  });
}

/**
 * Helper to log a trace span event.
 * In a real-world scenario, this would send data to Jaeger/Zipkin/Honeycomb.
 */
function logSpan(req, name, attributes = {}) {
  const logger = getLogger();
  const duration = Date.now() - (req.startTime || Date.now());
  logger.info({ correlationId: req.correlationId, durationMs: duration, ...attributes }, `[Trace Span] ${name}`);
}

module.exports = { tracingMiddleware, logSpan };
