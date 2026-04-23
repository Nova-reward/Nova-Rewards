const client = require('prom-client');

const registry = new client.Registry();

// Collect default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register: registry });

// HTTP request duration histogram
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [registry],
});

// HTTP request counter
const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

// Active requests gauge
const activeRequests = new client.Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
  labelNames: ['method', 'route'],
  registers: [registry],
});

// Database query duration
const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5],
  registers: [registry],
});

// Redis operation duration
const redisOperationDuration = new client.Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Duration of Redis operations in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [registry],
});

// Cache hit/miss counters — issue #576
const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['key_type'],
  registers: [registry],
});

const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['key_type'],
  registers: [registry],
});

// Business metrics
const rewardsDistributed = new client.Counter({
  name: 'rewards_distributed_total',
  help: 'Total number of rewards distributed',
  labelNames: ['merchant_id'],
  registers: [registry],
});

const redemptionsProcessed = new client.Counter({
  name: 'redemptions_processed_total',
  help: 'Total number of redemptions processed',
  labelNames: ['status'],
  registers: [registry],
});

const userRegistrations = new client.Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
  registers: [registry],
});

function metricsMiddleware(req, res, next) {
  const start = process.hrtime();
  const route = req.route ? req.route.path : 'unknown';

  // Increment active requests
  activeRequests.inc({ method: req.method, route });

  res.on('finish', () => {
    const [sec, ns] = process.hrtime(start);
    const duration = sec + ns / 1e9;

    // Record metrics
    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );

    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    // Decrement active requests
    activeRequests.dec({ method: req.method, route });
  });

  next();
}

module.exports = {
  metricsMiddleware,
  registry,
  metrics: {
    httpRequestDuration,
    httpRequestTotal,
    activeRequests,
    dbQueryDuration,
    redisOperationDuration,
    rewardsDistributed,
    redemptionsProcessed,
    userRegistrations,
    cacheHits,
    cacheMisses,
  },
};
