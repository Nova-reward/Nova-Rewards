const os = require('os');
const { pool } = require('../db');
const { client: redisClient } = require('../lib/redis');
const { Horizon } = require('stellar-sdk');

// Horizon server instance
const server = new Horizon.Server(
  process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org'
);

/**
 * Check database connectivity and response time
 * @returns {Promise<{status: string, responseTime: number, error: string|null}>}
 */
async function checkDatabase() {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const responseTime = Date.now() - start;
    
    return {
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      responseTime,
      error: null,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: null,
      error: error.message,
    };
  }
}

/**
 * Check Redis cache connectivity and response time
 * @returns {Promise<{status: string, responseTime: number, error: string|null}>}
 */
async function checkCache() {
  try {
    const start = Date.now();
    await redisClient.ping();
    const responseTime = Date.now() - start;
    
    return {
      status: responseTime < 500 ? 'healthy' : 'degraded',
      responseTime,
      error: null,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: null,
      error: error.message,
    };
  }
}

/**
 * Check Stellar Horizon API connectivity and response time
 * @returns {Promise<{status: string, responseTime: number, error: string|null, network: string}>}
 */
async function checkStellar() {
  try {
    const start = Date.now();
    const ledgerResponse = await server.ledgers().limit(1).order('desc').call();
    const responseTime = Date.now() - start;
    
    return {
      status: responseTime < 2000 ? 'healthy' : 'degraded',
      responseTime,
      error: null,
      network: process.env.HORIZON_URL || 'testnet',
      latestLedger: ledgerResponse.records[0]?.sequence || null,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: null,
      error: error.message,
      network: process.env.HORIZON_URL || 'testnet',
      latestLedger: null,
    };
  }
}

/**
 * Check disk space availability
 * Note: Cross-platform disk space checking requires native modules
 * This provides basic info available through Node.js
 * @returns {Promise<{status: string, available: string, total: string, percentUsed: string}>}
 */
async function checkDisk() {
  try {
    // For production use, consider installing 'diskusage' or 'check-disk-space' npm package
    // For now, we'll provide a basic check
    const tmpDir = os.tmpdir();
    
    return {
      status: 'healthy',
      available: 'N/A (requires diskusage module)',
      total: 'N/A (requires diskusage module)',
      percentUsed: 'N/A (requires diskusage module)',
      note: 'Install "check-disk-space" package for detailed disk metrics',
    };
  } catch (error) {
    return {
      status: 'unknown',
      available: null,
      total: null,
      percentUsed: null,
      error: error.message,
    };
  }
}

/**
 * Check memory usage
 * @returns {Promise<{status: string, free: string, total: string, percentUsed: string, processMemory: object}>}
 */
async function checkMemory() {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const percentUsed = ((usedMem / totalMem) * 100).toFixed(2);
    
    // Get process-specific memory usage
    const processMemUsage = process.memoryUsage();
    
    return {
      status: percentUsed < 85 ? 'healthy' : 'degraded',
      free: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
      total: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
      percentUsed: `${percentUsed}%`,
      processMemory: {
        rss: `${(processMemUsage.rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(processMemUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(processMemUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        external: `${(processMemUsage.external / 1024 / 1024).toFixed(2)} MB`,
      },
    };
  } catch (error) {
    return {
      status: 'unknown',
      free: null,
      total: null,
      percentUsed: null,
      error: error.message,
    };
  }
}

/**
 * Run all health checks and return comprehensive status
 * @returns {Promise<{status: string, checks: object, responseTime: string, timestamp: string, uptime: string, environment: string}>}
 */
async function runHealthChecks() {
  const startTime = Date.now();
  
  // Run all checks in parallel for faster response
  const [database, cache, stellar, disk, memory] = await Promise.all([
    checkDatabase(),
    checkCache(),
    checkStellar(),
    checkDisk(),
    checkMemory(),
  ]);
  
  const checks = { database, cache, stellar, disk, memory };
  
  // Determine overall status
  let overallStatus = 'healthy';
  
  if (database.status === 'unhealthy' || cache.status === 'unhealthy') {
    overallStatus = 'unhealthy';
  } else if (
    database.status === 'degraded' ||
    cache.status === 'degraded' ||
    stellar.status === 'degraded' ||
    stellar.status === 'unhealthy' ||
    memory.status === 'degraded'
  ) {
    overallStatus = 'degraded';
  }
  
  const totalResponseTime = Date.now() - startTime;
  
  return {
    status: overallStatus,
    checks,
    responseTime: `${totalResponseTime}ms`,
    timestamp: new Date().toISOString(),
    uptime: `${process.uptime().toFixed(2)}s`,
    environment: process.env.NODE_ENV || 'development',
  };
}

module.exports = {
  checkDatabase,
  checkCache,
  checkStellar,
  checkDisk,
  checkMemory,
  runHealthChecks,
};
