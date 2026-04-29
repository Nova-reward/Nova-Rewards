const { v4: uuidv4 } = require('uuid');

/**
 * Middleware to generate and propagate trace IDs.
 * Requirements: #366 Distributed Tracing
 */
function tracingMiddleware(req, res, next) {
  // Check if trace ID already exists (e.g., from upstream service or client)
  const incomingTraceId = req.header('x-trace-id');
  const traceId = incomingTraceId || uuidv4();

  // Attach traceId to the request object for use in services and logging
  req.traceId = traceId;

  // Add traceId to the response headers for observability
  res.setHeader('x-trace-id', traceId);

  // We can also create a basic "span" start time here if needed
  req.startTime = Date.now();

  next();
}

/**
 * Helper to log a trace span event.
 * In a real-world scenario, this would send data to Jaeger/Zipkin/Honeycomb.
 */
function logSpan(req, name, attributes = {}) {
  const duration = Date.now() - (req.startTime || Date.now());
  const logMessage = {
    message: `[Trace Span] ${name}`,
    traceId: req.traceId,
    durationMs: duration,
    ...attributes,
  };
  
  // For now, log to console in a structured way (or use a logger like winston/pino)
  console.log(JSON.stringify(logMessage));
}

module.exports = { tracingMiddleware, logSpan };
