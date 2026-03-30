require('dotenv').config();
const { validateEnv } = require('./middleware/validateEnv');

validateEnv();

require('./db/index');

const http = require('http');
const express = require('express');
const cors = require('cors');
const { connectRedis } = require('./lib/redis');
const { startLeaderboardCacheWarmer } = require('./jobs/leaderboardCacheWarmer');
const { startDailyLoginBonusJob } = require('./jobs/dailyLoginBonus');
const { startWebhookRetryJob } = require('./jobs/webhookRetry');
const {
  globalLimiter, authLimiter,
  slidingGlobal, slidingAuth, slidingUser,
  slidingSearch, slidingWebhook, slidingRewards, slidingAdmin,
} = require('./middleware/rateLimiter');
const { metricsMiddleware, registry } = require('./middleware/metricsMiddleware');
const { initSocketIO } = require('./services/socketService');

const app = express();
const httpServer = http.createServer(app);

app.use(securityHeaders);

// Configure CORS based on environment
const corsOptions = process.env.NODE_ENV === 'production' && process.env.ALLOWED_ORIGIN
  ? { origin: process.env.ALLOWED_ORIGIN }
  : {}; // Open CORS for development

initSocketIO(httpServer, corsOptions);

app.use(cors(corsOptions));
app.use(express.json());
app.use(metricsMiddleware);

// Handle JSON parse errors (malformed/empty body with Content-Type: application/json)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'validation_error',
      message: 'Invalid JSON in request body',
    });
  }
  next(err);
});

// Rate limiting — fixed-window global baseline
app.use(globalLimiter);

// Sliding-window per-endpoint limits
app.use('/api/auth/login',           slidingAuth);
app.use('/api/auth/forgot-password', slidingAuth);
app.use('/api/auth',                 slidingUser);
app.use('/api/search',               slidingSearch);
app.use('/api/webhooks',             slidingWebhook);
app.use('/api/rewards/distribute',   slidingRewards);
app.use('/api/admin',                slidingAdmin);
app.use('/api',                      slidingGlobal);

// Legacy fixed-window auth limiter (belt-and-suspenders)
app.use('/api/auth/login',           authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Health check routes
app.use('/api/health', require('./routes/health'));

// Prometheus metrics scrape endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', registry.contentType);
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
app.use('/api/admin/batch', require('./routes/batch'));
app.use('/api/drops', require('./routes/drops'));
app.use('/api/search', require('./routes/search'));
app.use('/api/webhooks', require('./routes/webhooks'));

// Swagger/OpenAPI docs
// In production, gate /api/docs behind HTTP Basic Auth.
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

if (process.env.NODE_ENV === 'production') {
  const DOCS_USER = process.env.DOCS_USER || 'nova';
  const DOCS_PASS = process.env.DOCS_PASS;

  app.use('/api/docs', (req, res, next) => {
    if (!DOCS_PASS) return next(); // skip guard if password not configured
    const auth = req.headers.authorization || '';
    const [scheme, encoded] = auth.split(' ');
    if (scheme !== 'Basic' || !encoded) {
      res.set('WWW-Authenticate', 'Basic realm="Nova Rewards API Docs"');
      return res.status(401).send('Authentication required');
    }
    const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    if (user !== DOCS_USER || pass !== DOCS_PASS) {
      res.set('WWW-Authenticate', 'Basic realm="Nova Rewards API Docs"');
      return res.status(401).send('Invalid credentials');
    }
    next();
  });
}

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: { persistAuthorization: true },
  customSiteTitle: 'NovaRewards API Docs',
}));
app.get('/api/docs/openapi.json', (req, res) => res.json(swaggerSpec));

// Global error handler — returns consistent error envelope
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    error: err.code || 'internal_error',
    message: err.message || 'An unexpected error occurred',
  });
});

const PORT = process.env.PORT || 3001;

// Only start the server when this file is run directly (not when required by tests)
if (require.main === module) {
  httpServer.listen(PORT, async () => {
    await connectRedis();
    startLeaderboardCacheWarmer();
    startDailyLoginBonusJob();
    startWebhookRetryJob();
    // Register event listeners
    require('./services/redemptionEventListener').registerRedemptionEventListener();
    // Start batch processing workers
    require('./services/batchQueue');
    console.log(`NovaRewards backend running on port ${PORT}`);
  });
}

module.exports = app;
