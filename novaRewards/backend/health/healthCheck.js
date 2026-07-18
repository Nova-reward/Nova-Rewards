const logger = require('../lib/logger');
const { pool, getPoolStatus } = require('../db');

/**
 * Health check service that verifies all dependencies
 */
class HealthCheck {
  constructor() {
    this.checks = {
      db: this.checkDatabase.bind(this),
      stellar: this.checkStellar.bind(this),
    };
  }

  /**
   * Check database connectivity
   */
  async checkDatabase() {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1 as health_check');
      client.release();
      
      // Also check pool status
      const status = getPoolStatus();
      if (status.waitingCount > 5) {
        return { 
          status: 'degraded', 
          message: 'High connection waiting count',
          poolStatus: status
        };
      }
      
      return { 
        status: 'ok',
        poolStatus: status
      };
    } catch (error) {
      logger.error('[Health] Database check failed:', error.message);
      return { 
        status: 'down', 
        error: error.message 
      };
    }
  }

  /**
   * Check Stellar RPC connectivity
   */
  async checkStellar() {
    try {
      const stellarUrl = process.env.STELLAR_RPC_URL || 'https://horizon.stellar.org';
      
      // Try to fetch the health endpoint or a simple endpoint
      const response = await fetch(`${stellarUrl}/health`, {
        timeout: 5000,
        method: 'GET',
      });
      
      if (response.ok) {
        return { status: 'ok' };
      }
      return { 
        status: 'degraded', 
        message: `Stellar returned status: ${response.status}` 
      };
    } catch (error) {
      logger.error('[Health] Stellar check failed:', error.message);
      return { 
        status: 'degraded', 
        error: error.message 
      };
    }
  }

  /**
   * Run all health checks
   */
  async runAllChecks() {
    const dbResult = await this.checkDatabase();
    const stellarResult = await this.checkStellar();

    const results = {
      status: 'ok',
      db: dbResult,
      stellar: stellarResult,
      timestamp: new Date().toISOString(),
    };

    // Determine overall status
    if (dbResult.status === 'down' || stellarResult.status === 'down') {
      results.status = 'degraded';
    } else if (dbResult.status === 'degraded' || stellarResult.status === 'degraded') {
      results.status = 'degraded';
    }

    return results;
  }
}

module.exports = new HealthCheck();
