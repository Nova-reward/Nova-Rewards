require('dotenv').config();
const { validateEnv } = require('./middleware/validateEnv');

// Validate all required env vars before anything else — halts if any are missing.
// This MUST run before requiring ./db/index because the Pool constructor reads
// DATABASE_URL immediately at require-time.
validateEnv();

// Safe to require db now — DATABASE_URL is guaranteed to be present
require('./db/index');

const express = require('express');
const cors = require('cors');

const app = express();

// Configure CORS based on environment
const corsOptions = process.env.NODE_ENV === 'production' && process.env.ALLOWED_ORIGIN
  ? { origin: process.env.ALLOWED_ORIGIN }
  : {}; // Open CORS for development

app.use(cors(corsOptions));
app.use(express.json());

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
app.listen(PORT, () => {
  console.log(`NovaRewards backend running on port ${PORT}`);
});

module.exports = app;
