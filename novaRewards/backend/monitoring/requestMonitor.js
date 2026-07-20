/**
 * Express monitoring middleware.
 *
 * Wraps every inbound request to:
 *   1. Count total requests and per-route requests
 *   2. Track response time and record histogram samples
 *   3. Count 4xx / 5xx errors
 *   4. Track in-flight (concurrent) requests via a gauge
 *   5. Log application errors to the events logger
 */

const metrics = require('./metricsCollector');
const { logEvent } = require('./eventsLogger');

/**
 * Returns a route label string that normalises dynamic segments.
 * e.g. GET /api/transactions/GABC123 → "GET /api/transactions/:walletAddress"
 *
 * We rely on Express's `req.route` which is set after the router matches.
 * Before matching (e.g. 404s) we fall back to the raw URL path trimmed to 80 chars.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function routeLabel(req) {
  const path = (req.route && req.route.path) ? req.route.path : req.path.slice(0, 80);
  return `${req.method} ${path}`;
}

/**
 * Middleware: request timing, counters, histogram.
 * Mount BEFORE your routes.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requestMonitor(req, res, next) {
  const startedAt = Date.now();

  // Track in-flight requests
  metrics.increment('http.requests.inflight');
  metrics.setGauge('http.requests.inflight', metrics.getCounter('http.requests.inflight'));

  metrics.increment('http.requests.total');

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const label = routeLabel(req);
    const statusCode = res.statusCode;

    // Per-route counter
    metrics.increment(`http.route.${label}`);

    // Response-time histogram
    metrics.recordResponseTime(label, durationMs);

    // Error counters
    if (statusCode >= 500) {
      metrics.increment('http.requests.errors');
      metrics.increment('http.requests.errors.5xx');
    } else if (statusCode >= 400) {
      metrics.increment('http.requests.errors');
      metrics.increment('http.requests.errors.4xx');
    }

    // Decrement in-flight
    const inflight = Math.max(0, metrics.getCounter('http.requests.inflight') - 1);
    metrics.setGauge('http.requests.inflight', inflight);
  });

  next();
}

/**
 * Error-capture middleware — place AFTER all routes, BEFORE the global error handler.
 * Logs errors to the events logger and increments error counters before passing on.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorMonitor(err, req, res, next) {
  metrics.increment('http.requests.errors.unhandled');

  logEvent(
    'error.application',
    {
      method: req.method,
      path: req.path,
      errorCode: err.code ?? null,
      errorMessage: err.message ?? String(err),
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    },
    'error'
  );

  next(err); // hand off to the global error handler in server.js
}

module.exports = { requestMonitor, errorMonitor };
