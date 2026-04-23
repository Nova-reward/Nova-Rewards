'use strict';

/**
 * SecurityAlertService
 *
 * Delivers security alerts to the monitoring system via structured JSON log
 * lines tagged with `security_event: true`. Loki scrapes stdout/stderr and
 * Grafana alert rules fire when `security_event=true` entries appear.
 *
 * Retry logic: up to 3 attempts with exponential back-off (1s, 2s, 4s).
 * Delivery failure is logged to the application error log and does NOT
 * affect the HTTP response — `send` always resolves.
 */
class SecurityAlertService {
  /**
   * Emit a structured security alert log entry.
   *
   * @param {Object} payload - The security event payload.
   * @param {string} payload.action        - Event type, e.g. 'PRIVILEGE_ESCALATION_ATTEMPT'
   * @param {number} payload.performedBy   - User ID of the actor
   * @param {string} payload.entityId      - Target endpoint path
   * @param {Object} payload.details       - { method, role, ip }
   * @param {string} payload.timestamp     - UTC ISO-8601 timestamp
   * @param {number} [attempt=1]           - Current attempt number (1-indexed)
   * @returns {Promise<void>}              - Always resolves; never throws
   */
  static async send(payload, attempt = 1) {
    try {
      const logEntry = {
        level: 'warn',
        security_event: true,
        event_type: payload.action,
        user_id: payload.performedBy,
        target_endpoint: payload.entityId,
        method: payload.details?.method,
        role: payload.details?.role,
        ip: payload.details?.ip,
        timestamp: payload.timestamp,
      };

      // Emit the structured log line — Loki scrapes stdout/stderr
      console.warn(JSON.stringify(logEntry));
    } catch (err) {
      if (attempt < 3) {
        // Exponential back-off: 1s, 2s, 4s (2^(attempt-1) * 1000 ms)
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        await SecurityAlertService._sleep(delayMs);
        return SecurityAlertService.send(payload, attempt + 1);
      }

      // Max retries exhausted — log final failure and give up
      console.error(
        '[SecurityAlertService] Failed to deliver security alert after 3 attempts:',
        err
      );
    }
  }

  /**
   * Sleep for the given number of milliseconds.
   * Extracted to a static method so tests can spy on / replace it.
   *
   * @param {number} ms
   * @returns {Promise<void>}
   */
  static _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = SecurityAlertService;
