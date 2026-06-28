require("dotenv").config();
const logger = require("./lib/logger");
const { validateEnv } = require("./middleware/validateEnv");

validateEnv();

require("./db/index");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { connectRedis } = require("./lib/redis");
const {
  startLeaderboardCacheWarmer,
} = require("./jobs/leaderboardCacheWarmer");
const { startDailyLoginBonusJob } = require("./jobs/dailyLoginBonus");
const { startWebhookRetryJob } = require("./jobs/webhookRetry");
const { globalLimiter, authLimiter } = require("./middleware/rateLimiter");
const {
  metricsMiddleware,
  registry,
} = require("./middleware/metricsMiddleware");
const { tracingMiddleware } = require("./middleware/tracingMiddleware");
const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const {
  legacyApi,
  migrationGuideHandler,
  versionedApi,
  versionsHandler,
} = require('./middleware/apiVersioning');

// Import health check module
const healthCheck = require('./health/healthCheck');
const { getPoolStatus } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS based on environment
const corsOptions =
  process.env.NODE_ENV === "production" && process.env.ALLOWED_ORIGIN
    ? { origin: process.env.ALLOWED_ORIGIN }
    : {}; // Open CORS for development

app.use(cors(corsOptions));

// Security headers (OWASP)
app.use(
  helmet({
    // HSTS: 1 year, include subdomains, allow preload
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    // Prevent MIME-type sniffing
    noSniff: true,
    // Deny framing (clickjacking protection)
    frameguard: { action: 'deny' },
    // Referrer-Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Disable X-Powered-By
    hidePoweredBy: true,
    // CSP is handled by the frontend; disable helmet's default for the API
    contentSecurityPolicy: false,
  })
);
app.use(express.json());
app.use(tracingMiddleware);
app.use(metricsMiddleware);
app.use(require('./middleware/auditMiddleware').auditMiddleware);

// JSON parse errors are handled by globalErrorHandler below

// Rate limiting — fixed-window global baseline
app.use(globalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/forgot-password", authLimiter);

// Health / readiness checks — /health, /health/detailed, /ready
app.use('/health', require('./routes/health'));
app.get('/ready', require('./routes/health').readyHandler);

// Custom enhanced health check endpoint (overrides the basic one)
app.get('/health/detailed', async (req, res) => {
  try {
    const health = await healthCheck.runAllChecks();
    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('[Health] Error running checks:', error);
    res.status(503).json({
      status: 'degraded',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Pool status endpoint (for monitoring)
app.get('/pool-status', (req, res) => {
  try {
    const status = getPoolStatus();
    res.json({
      ...status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get pool status' });
  }
});

// Prometheus metrics scrape endpoint
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

function buildApiRouter() {
  const router = express.Router();

  // Routes (wired in as they are implemented)
  router.use('/auth', require('./routes/auth'));
  router.use('/merchants', require('./routes/merchants'));
  router.use('/campaigns', require('./routes/campaigns'));
  router.use('/campaigns', require('./routes/campaignAnalytics'));
  router.use('/rewards', require('./routes/rewards'));
  router.use('/redemptions', require('./routes/redemptions'));
  router.use('/transactions', require('./routes/transactions'));
  router.use('/trustline', require('./routes/trustline'));
  router.use('/users', require('./routes/users'));
  router.use('/users', require('./routes/onboarding'));
  router.use('/contract-events', require('./routes/contractEvents'));
  router.use('/admin/email-logs', require('./routes/emailLogs'));
  router.use('/leaderboard', require('./routes/leaderboard'));
  router.use('/admin', require('./routes/admin'));
  router.use('/drops', require('./routes/drops'));
  router.use('/analytics', require('./routes/analytics'));
  router.use('/notifications', require('./routes/notifications'));
  router.use("/auth", require("./routes/auth"));
  router.use("/auth", require("./routes/stellarAuth"));
  router.use("/merchants", require("./routes/merchants"));
  router.use("/campaigns", require("./routes/campaigns"));
  router.use("/rewards", require("./routes/rewards"));
  router.use("/redemptions", require("./routes/redemptions"));
  router.use("/transactions", require("./routes/transactions"));
  router.use("/transactions", require("./routes/stellarTransaction"));
  router.use("/fee-estimate", require("./routes/feeEstimate"));
  router.use("/trustline", require("./routes/trustline"));
  router.use("/users", require("./routes/users"));
  router.use("/wallet", require("./routes/wallet"));
  router.use("/contract-events", require("./routes/contractEvents"));
  router.use("/admin/email-logs", require("./routes/emailLogs"));
  router.use("/leaderboard", require("./routes/leaderboard"));
  router.use("/admin", require("./routes/admin"));

  // Bull Board UI (requires admin auth)
  // We will mount it using the serverAdapter from jobs/queues.js
  const { serverAdapter } = require('./jobs/queues');
  const { authenticateUser, requireAdmin } = require('./middleware/authenticateUser');
  router.use('/admin/queues', authenticateUser, requireAdmin, serverAdapter.getRouter());
  router.use("/drops", require("./routes/drops"));
  router.use("/search", require("./routes/search"));
  router.use("/webhooks", require("./routes/webhooks"));
  router.use("/merchants/:id/api-keys", require("./routes/merchantApiKeys"));
  router.use("/governance", require("./routes/governance"));
  router.use("/jobs", require("./routes/jobs"));

  return router;
}

app.get('/api/versions', legacyApi, versionsHandler);
app.get('/api/v1/versions', versionedApi('v1'), versionsHandler);
app.get('/api/versioning', legacyApi, migrationGuideHandler);
app.get('/api/v1/versioning', versionedApi('v1'), migrationGuideHandler);
app.use('/api/v1', versionedApi('v1'), buildApiRouter());
app.use(/^\/api(?!\/v\d+(?:\/|$))/, legacyApi, buildApiRouter());

// Swagger/OpenAPI docs
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
if (process.env.NODE_ENV !== "production") {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api/docs/openapi.json", (req, res) => res.json(swaggerSpec));
  app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api/v1/docs/openapi.json", (req, res) => res.json(swaggerSpec));
}

// 404 catch-all (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

// Only start the server when this file is run directly (not when required by tests)
if (require.main === module) {
  app.listen(PORT, async () => {
    await connectRedis();
    startLeaderboardCacheWarmer();
    startDailyLoginBonusJob();
    startWebhookRetryJob();
    // Register event listeners
    require("./services/redemptionEventListener").registerRedemptionEventListener();
    // Initialize Webhook Worker
    require("./jobs/webhookHandler");
    // Initialize Reward Issuance Worker
    require("./jobs/rewardIssuanceWorker");
    // Initialize Reward Distribution Worker (bulk campaign distribution)
    require("./jobs/rewardDistributionWorker");
    logger.info(`NovaRewards backend running on port ${PORT}`);
    logger.info(`✅ Health check: http://localhost:${PORT}/health`);
    logger.info(`✅ Detailed health: http://localhost:${PORT}/health/detailed`);
    logger.info(`✅ Pool status: http://localhost:${PORT}/pool-status`);
  });
}

module.exports = app;