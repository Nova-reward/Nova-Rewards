const CircuitBreaker = require('opossum');

/**
 * Service to manage circuit breakers for external service calls.
 * Requirements: #364 Resilience, #366 (trace correlation)
 */
class CircuitBreakerService {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Get or create a circuit breaker for a given name/function.
   */
  getBreaker(name, asyncFunc, options = {}) {
    if (this.breakers.has(name)) {
      return this.breakers.get(name);
    }

    const defaultOptions = {
      timeout: 10000,           // 10s default timeout
      errorThresholdPercentage: 50,  // open circuit if 50% attempts fail
      resetTimeout: 30000,      // wait 30s before reset attempt
    };

    const breaker = new CircuitBreaker(asyncFunc, { ...defaultOptions, ...options });

    // Monitoring circuits
    breaker.on('open', () => console.warn(`[Circuit Breaker] ${name} opened! Service is down.`));
    breaker.on('close', () => console.info(`[Circuit Breaker] ${name} closed. Service is back up.`));
    breaker.on('halfOpen', () => console.info(`[Circuit Breaker] ${name} half-open. Testing service recovery...`));

    this.breakers.set(name, breaker);
    return breaker;
  }

  /**
   * Convenience wrapper to execute a function with a circuit breaker and retry logic.
   */
  async execute(name, asyncFunc, fallback = null, options = {}) {
    const breaker = this.getBreaker(name, asyncFunc, options);
    
    if (fallback) {
      breaker.fallback(fallback);
    }

    const maxRetries = options.retries || 0;
    let attempt = 0;

    while (true) {
      try {
        return await breaker.fire();
      } catch (err) {
        if (attempt < maxRetries && breaker.status.closed) {
          attempt++;
          console.log(`[Circuit Breaker] Retrying ${name} (attempt ${attempt}/${maxRetries})...`);
          continue;
        }
        throw err;
      }
    }
  }
}

module.exports = new CircuitBreakerService();
