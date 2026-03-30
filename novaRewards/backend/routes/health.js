const express = require('express');
const router = express.Router();
const { runHealthChecks } = require('../services/healthCheckService');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Returns a simple status indicating the server is running
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 */
router.get('/', (req, res) => {
  res.json({ 
    success: true, 
    data: { status: 'ok' } 
  });
});

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Comprehensive health check including database, cache, external services, disk, and memory
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: System is healthy or degraded
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
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     responseTime:
 *                       type: string
 *                       example: "150ms"
 *                     uptime:
 *                       type: string
 *                       example: "3600.50s"
 *                     environment:
 *                       type: string
 *                       example: production
 *       503:
 *         description: System is unhealthy
 */
router.get('/detailed', async (req, res) => {
  try {
    const healthData = await runHealthChecks();
    
    // Determine HTTP status code based on overall health
    const statusCode = 
      healthData.status === 'healthy' ? 200 : 
      healthData.status === 'degraded' ? 200 : 
      503;

    res.status(statusCode).json({
      success: healthData.status !== 'unhealthy',
      data: healthData,
    });
  } catch (error) {
    console.error('Health check failed:', error);
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
