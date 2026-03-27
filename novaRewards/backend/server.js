require('dotenv').config();
const { validateEnv } = require('./middleware/validateEnv');

// Validate all required env vars before anything else — halts if any are missing
validateEnv();

const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
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
app.use('/api/users', require('./routes/users'));

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
