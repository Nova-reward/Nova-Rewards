require("dotenv").config();
const { validateEnv } = require("./middleware/validateEnv");

validateEnv();

require("./db/index");

const express = require("express");
const cors = require("cors");
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

const app = express();

// Configure CORS based on environment
const corsOptions =
  process.env.NODE_ENV === "production" && process.env.ALLOWED_ORIGIN
    ? { origin: process.env.ALLOWED_ORIGIN }
    : {}; // Open CORS for development

app.use(cors(corsOptions));
app.use(express.json());
app.use(tracingMiddleware);
app.use(metricsMiddleware);

// Handle JSON parse errors (malformed/empty body with Content-Type: application/json)
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: "validation_error",
      message: "Invalid JSON in request body",
    });
  }
  next(err);
});

// Rate limiting — fixed-window global baseline
app.use(globalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);

// Health check
app.get("/health", (req, res) => {
  res.json({ success: true, data: { status: "ok" } });
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

// Routes (wired in as they are implemented)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/merchants', require('./routes/merchants'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/rewards', require('./routes/rewards'));
app.use('/api/redemptions', require('./routes/redemptions'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/trustline', require('./routes/trustline'));
app.use('/api/users', require('./routes/users'));
app.use('/api/contract-events', require('./routes/contractEvents'));
app.use('/api/admin/email-logs', require('./routes/emailLogs'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/drops', require('./routes/drops'));
app.use('/api/analytics', require('./routes/analytics'));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/merchants", require("./routes/merchants"));
app.use("/api/campaigns", require("./routes/campaigns"));
app.use("/api/rewards", require("./routes/rewards"));
app.use("/api/redemptions", require("./routes/redemptions"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/trustline", require("./routes/trustline"));
app.use("/api/users", require("./routes/users"));
app.use("/api/wallet", require("./routes/wallet"));
app.use("/api/contract-events", require("./routes/contractEvents"));
app.use("/api/admin/email-logs", require("./routes/emailLogs"));
app.use("/api/leaderboard", require("./routes/leaderboard"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/drops", require("./routes/drops"));
app.use("/api/search", require("./routes/search"));
app.use("/api/webhooks", require("./routes/webhooks"));

// Swagger/OpenAPI docs
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api/docs/openapi.json", (req, res) => res.json(swaggerSpec));

// Global error handler — returns consistent error envelope
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    error: err.code || "internal_error",
    message: err.message || "An unexpected error occurred",
  });
});

const PORT = process.env.PORT || 3001;

// Only start the server when this file is run directly (not when required by tests)
if (require.main === module) {
  app.listen(PORT, async () => {
    await connectRedis();
    startLeaderboardCacheWarmer();
    startDailyLoginBonusJob();
    startWebhookRetryJob();
    // Register event listeners
    require("./services/redemptionEventListener").registerRedemptionEventListener();
    console.log(`NovaRewards backend running on port ${PORT}`);
  });
}

module.exports = app;
