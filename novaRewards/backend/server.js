'use strict';

require("dotenv").config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const logger = require("./lib/logger");
const { validateEnv } = require("./middleware/validateEnv");
const { tracingMiddleware } = require('./middleware/tracingMiddleware');
const { metricsMiddleware, registry } = require('./middleware/metricsMiddleware');
const { auditMiddleware } = require('./middleware/auditMiddleware');
const {
  globalLimiter,
  loginLimiter,
  refreshLimiter,
  authLimiter,
} = require('./middleware/rateLimiter');
const {
  legacyApi,
  versionedApi,
  versionsHandler,
  migrationGuideHandler,
} = require('./middleware/apiVersioning');
const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestMonitor, errorMonitor } = require('./monitoring/requestMonitor');
const { connectRedis } = require('./lib/redis');
const { startLeaderboardCacheWarmer } = require('./jobs/leaderboardCacheWarmer');
const { startDailyLoginBonusJob } = require('./jobs/dailyLoginBonus');
const { startWebhookRetryJob } = require('./jobs/webhookRetry');

// Validate environment variables on startup
validateEnv();

// Initialize DB pool connection
require("./db/index");

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS based on environment
const corsOptions =
  process.env.NODE_ENV === "production" && process.env.ALLOWED_ORIGIN
    ? { origin: process.env.ALLOWED_ORIGIN }
    : {};

const { compressionMiddleware } = require('./middleware/compressionMiddleware');

app.use(compressionMiddleware);

app.use(cors(corsOptions));

// Security headers (OWASP standards via Helmet)
app.use(
  helmet({
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hidePoweredBy: true,
    contentSecurityPolicy: false,
  })
);

// Tracing and correlation ID propagation
app.use(tracingMiddleware);

// Morgan HTTP request logging (configured per environment)
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(
  morgan(morganFormat, {
    stream: { write: (message) => logger.info(message.trim()) },
    skip: () => process.env.NODE_ENV === 'test',
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Observability and Audit logging
app.use(metricsMiddleware);
app.use(auditMiddleware);

// Global and auth rate limiters
app.use(globalLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/v1/auth/login", loginLimiter);
app.use("/api/auth/refresh", refreshLimiter);
app.use("/api/v1/auth/refresh", refreshLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/v1/auth/forgot-password", authLimiter);

// Monitoring timing middleware
app.use(requestMonitor);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
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

  router.use('/auth', require('./routes/auth'));
  router.use('/auth', require('./routes/stellarAuth'));
  router.use('/merchants', require('./routes/merchants'));
  router.use('/merchants/:id/api-keys', require('./routes/merchantApiKeys'));
  router.use('/campaigns', require('./routes/campaigns'));
  router.use('/campaigns', require('./routes/campaignAnalytics'));
  router.use('/rewards', require('./routes/rewards'));
  router.use('/redemptions', require('./routes/redemptions'));
  router.use('/transactions', require('./routes/transactions'));
  router.use('/transactions', require('./routes/stellarTransaction'));
  router.use('/trustline', require('./routes/trustline'));
  router.use('/fee-estimate', require('./routes/feeEstimate'));
  router.use('/users', require('./routes/users'));
  router.use('/users', require('./routes/onboarding'));
  router.use('/wallet', require('./routes/wallet'));
  router.use('/contract-events', require('./routes/contractEvents'));
  router.use('/admin/email-logs', require('./routes/emailLogs'));
  router.use('/leaderboard', require('./routes/leaderboard'));
  router.use('/admin', require('./routes/admin'));
  router.use('/drops', require('./routes/drops'));
  router.use('/analytics', require('./routes/analytics'));
  router.use('/analytics/campaigns', require('./routes/campaignAggregateAnalytics'));
  router.use('/notifications', require('./routes/notifications'));
  router.use('/search', require('./routes/search'));
  router.use('/webhooks', require('./routes/webhooks'));
  router.use('/governance', require('./routes/governance'));
  router.use('/jobs', require('./routes/jobs'));

  // Bull Board UI (requires admin auth)
  const { serverAdapter } = require('./jobs/queues');
  const { authenticateUser, requireAdmin } = require('./middleware/authenticateUser');
  router.use('/admin/queues', authenticateUser, requireAdmin, serverAdapter.getRouter());

  return router;
}

// API Versioning and Routing
app.get('/api/versions', legacyApi, versionsHandler);
app.get('/api/v1/versions', versionedApi('v1'), versionsHandler);
app.get('/api/versioning', legacyApi, migrationGuideHandler);
app.get('/api/v1/versioning', versionedApi('v1'), migrationGuideHandler);
app.use('/api/v1', versionedApi('v1'), buildApiRouter());
app.use(/^\/api(?!\/v\d+(?:\/|$))/, legacyApi, buildApiRouter());

// Swagger/OpenAPI docs (Non-production only)
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
if (process.env.NODE_ENV !== "production") {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api/docs/openapi.json", (req, res) => res.json(swaggerSpec));
  app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api/v1/docs/openapi.json", (req, res) => res.json(swaggerSpec));
}

// Error monitoring middleware
app.use(errorMonitor);

// 404 catch-all (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last with 4 arguments)
app.use(globalErrorHandler);

// Only start the server when this file is run directly (not when required by tests)
if (require.main === module) {
  app.listen(PORT, async () => {
    await connectRedis();
    startLeaderboardCacheWarmer();
    startDailyLoginBonusJob();
    startWebhookRetryJob();
    require("./services/redemptionEventListener").registerRedemptionEventListener();
    require("./jobs/webhookHandler");
    require("./jobs/rewardIssuanceWorker");
    require("./jobs/rewardDistributionWorker");
    logger.info(`NovaRewards backend running on port ${PORT}`);
    logger.info(`✅ Health check: http://localhost:${PORT}/health`);
    logger.info(`✅ Detailed health: http://localhost:${PORT}/health/detailed`);
    logger.info(`✅ Pool status: http://localhost:${PORT}/pool-status`);
  });
}

module.exports = app;