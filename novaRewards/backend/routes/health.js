const express = require('express');
const router = express.Router();
const { runHealthChecks } = require('../services/healthCheckService');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check with dependency status
 *     description: Returns status of all critical dependencies (PostgreSQL, Redis, Stellar RPC) with latency
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Health status (always 200; inspect `data.status` for degraded/unhealthy)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                     checks:
 *                       type: object
 *                     responseTime:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     uptime:
 *                       type: string
 *                     environment:
 *                       type: string
 */
router.get('/', async (req, res) => {
  try {
    const healthData = await runHealthChecks();
    res.json({ success: true, data: healthData });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Returns 200 when all critical dependencies are available, 503 otherwise
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: All critical dependencies are available
 *       503:
 *         description: One or more critical dependencies are unavailable
 */
router.get('/ready', async (req, res) => {
  try {
    const healthData = await runHealthChecks();
    const { database, cache, stellar } = healthData.checks;

    const allReady =
      database.status !== 'unhealthy' &&
      cache.status !== 'unhealthy' &&
      stellar.status !== 'unhealthy';

    const statusCode = allReady ? 200 : 503;
    res.status(statusCode).json({
      success: allReady,
      data: {
        status: allReady ? 'ready' : 'not_ready',
        checks: { database, cache, stellar },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'not_ready',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check (all checks including disk and memory)
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: System is healthy or degraded
 *       503:
 *         description: System is unhealthy
 */
router.get('/detailed', async (req, res) => {
  try {
    const healthData = await runHealthChecks();
    const statusCode = healthData.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json({
      success: healthData.status !== 'unhealthy',
      data: healthData,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

module.exports = router;
