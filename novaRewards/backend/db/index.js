const { Pool } = require('pg');
const logger = require('../lib/logger');

// Single shared connection pool for the entire backend
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool configuration
  min: 2,              // Minimum connections in pool
  max: 10,             // Maximum connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log pool events for monitoring
pool.on('connect', () => {
  logger.debug('[DB Pool] new client connected');
});

pool.on('error', (err) => {
  logger.error('[DB Pool] error', { error: err.message });
});

pool.on('acquire', () => {
  logger.debug('[DB Pool] client acquired');
});

pool.on('remove', () => {
  logger.debug('[DB Pool] client removed');
});

setInterval(() => {
  logger.debug('[DB Pool] status', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  });
}, 60000);

/**
 * Executes a parameterized SQL query against the PostgreSQL database.
 *
 * @param {string} text   - SQL query string with $1, $2 ... placeholders
 * @param {Array}  params - Parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 250) {
      logger.warn('[DB Query] slow query', { durationMs: duration, query: text.substring(0, 100) });
    }
    return result;
  } catch (error) {
    logger.error('[DB Query] error', { error: error.message });
    throw error;
  }
}

// Get pool status
function getPoolStatus() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    min: 2,
    max: 10,
  };
}

module.exports = { pool, query, getPoolStatus };
