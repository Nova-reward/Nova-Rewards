require('dotenv').config();
const { validateEnv } = require('./middleware/validateEnv');

validateEnv();

require('./db/index');

const express = require('express');
const cors = require('cors');
const { connectRedis } = require('./lib/redis');
const { startLeaderboardCacheWarmer } = require('./jobs/leaderboardCacheWarmer');
const { startDailyLoginBonusJob } = require('./jobs/dailyLoginBonus');
const { globalLimiter, authLimiter } = require('./middleware/rateLimiter');

const app = express();

// Configure CORS based on environment
const corsOptions = process.env.NODE_ENV === 'production' && process.env.ALLOWED_ORIGIN
  ? { origin: process.env.ALLOWED_ORIGIN }
  : {}; // Open CORS for development

app.use(cors(corsOptions));
app.use(express.json());

// Rate limiting — global default, stricter on auth endpoints
app.use(globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

// Routes (wired in as they are implemented)
app.use('/api/merchants', require('./routes/merchants'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/rewards', require('./routes/rewards'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/trustline', require('./routes/trustline'));
app.use('/api/users', require('./routes/users'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/admin', require('./routes/admin'));

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
app.listen(PORT, async () => {
  await connectRedis();
  startLeaderboardCacheWarmer();
  startDailyLoginBonusJob();
  console.log(`NovaRewards backend running on port ${PORT}`);
});

module.exports = app;
