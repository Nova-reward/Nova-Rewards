/**
 * Alerts engine for Nova Rewards.
 *
 * Evaluates a set of configurable rules against the current metrics snapshot
 * on each call. Fires an event when a rule transitions from OK → FIRING and
 * again when it resolves.
 *
 * Alert states: 'ok' | 'firing' | 'resolved'
 *
 * Built-in rules (all thresholds configurable via env vars):
 *   high_error_rate        - HTTP error rate > ALERT_ERROR_RATE_PCT  (default 10 %)
 *   slow_response_p95      - p95 response time > ALERT_P95_MS        (default 2000 ms)
 *   low_distribution_rate  - distributions in last window < ALERT_MIN_DISTRIBUTIONS (default 0, alerts only when metric exists)
 *   blockchain_errors      - blockchain error events > ALERT_BLOCKCHAIN_ERRORS  (default 5)
 */

const metrics = require('./metricsCollector');
const { logEvent } = require('./eventsLogger');

// ── Thresholds (env-configurable) ────────────────────────────────────────────
const THRESHOLDS = {
  errorRatePct:       parseFloat(process.env.ALERT_ERROR_RATE_PCT   ?? '10'),
  p95Ms:              parseFloat(process.env.ALERT_P95_MS            ?? '2000'),
  blockchainErrors:   parseInt(process.env.ALERT_BLOCKCHAIN_ERRORS   ?? '5', 10),
};

// ── Persistent alert state ────────────────────────────────────────────────────
/**
 * @type {Map<string, { id: string, state: string, firedAt: string|null, resolvedAt: string|null, message: string, severity: string }>}
 */
const alertState = new Map();

/**
 * History of alert transitions (ring buffer, last 200).
 * @type {object[]}
 */
let alertHistory = [];
const MAX_HISTORY = 200;

// ── Rule definitions ──────────────────────────────────────────────────────────

/**
 * Each rule returns { firing: boolean, message: string, severity: 'warn'|'error' }.
 * @type {Array<{ id: string, name: string, evaluate: (snap: object) => { firing: boolean, message: string, severity: string } }>}
 */
const rules = [
  {
    id: 'high_error_rate',
    name: 'High HTTP Error Rate',
    evaluate(snap) {
      const firing = snap.errorRate > THRESHOLDS.errorRatePct;
      return {
        firing,
        message: firing
          ? `HTTP error rate is ${snap.errorRate}% (threshold: ${THRESHOLDS.errorRatePct}%)`
          : `HTTP error rate is ${snap.errorRate}% — normal`,
        severity: 'error',
      };
    },
  },
  {
    id: 'slow_response_p95',
    name: 'Slow P95 Response Time',
    evaluate(snap) {
      // Find the worst p95 across all routes
      let worstP95 = 0;
      let worstRoute = '';
      for (const [route, stats] of Object.entries(snap.responseTimes ?? {})) {
        if (stats.p95 > worstP95) {
          worstP95 = stats.p95;
          worstRoute = route;
        }
      }
      const firing = worstP95 > THRESHOLDS.p95Ms;
      return {
        firing,
        message: firing
          ? `P95 response time for ${worstRoute} is ${worstP95}ms (threshold: ${THRESHOLDS.p95Ms}ms)`
          : `All route P95 response times are within threshold`,
        severity: 'warn',
      };
    },
  },
  {
    id: 'blockchain_errors',
    name: 'Elevated Blockchain Errors',
    evaluate(snap) {
      const count = snap.counters['events.error.blockchain'] ?? 0;
      const firing = count > THRESHOLDS.blockchainErrors;
      return {
        firing,
        message: firing
          ? `Blockchain errors: ${count} (threshold: ${THRESHOLDS.blockchainErrors})`
          : `Blockchain errors: ${count} — normal`,
        severity: 'error',
      };
    },
  },
  {
    id: 'no_distributions',
    name: 'No Reward Distributions',
    evaluate(snap) {
      const total = snap.counters['http.requests.total'] ?? 0;
      const dists = snap.counters['events.reward.distributed'] ?? 0;
      // Only fire when the server has served at least 20 requests but 0 distributions
      const firing = total >= 20 && dists === 0;
      return {
        firing,
        message: firing
          ? `No reward distributions recorded after ${total} requests`
          : `Distributions: ${dists}`,
        severity: 'warn',
      };
    },
  },
];

// ── Evaluation ────────────────────────────────────────────────────────────────

/**
 * Evaluate all rules against the current metrics snapshot.
 * Updates alert state and appends to history on transitions.
 *
 * @returns {object[]} current alert state for all rules
 */
function evaluate() {
  const snap = metrics.snapshot();
  const now = new Date().toISOString();

  for (const rule of rules) {
    const { firing, message, severity } = rule.evaluate(snap);
    const prev = alertState.get(rule.id);

    if (firing) {
      if (!prev || prev.state !== 'firing') {
        // Transition → FIRING
        const alert = {
          id: rule.id,
          name: rule.name,
          state: 'firing',
          severity,
          message,
          firedAt: now,
          resolvedAt: null,
        };
        alertState.set(rule.id, alert);
        _appendHistory({ ...alert, transitionAt: now });
        logEvent('alert.fired', { ruleId: rule.id, name: rule.name, message }, severity);
      } else {
        // Still firing — update message in case the value changed
        alertState.set(rule.id, { ...prev, message });
      }
    } else {
      if (prev && prev.state === 'firing') {
        // Transition → RESOLVED
        const alert = {
          id: rule.id,
          name: rule.name,
          state: 'resolved',
          severity: 'info',
          message,
          firedAt: prev.firedAt,
          resolvedAt: now,
        };
        alertState.set(rule.id, alert);
        _appendHistory({ ...alert, transitionAt: now });
        logEvent('alert.resolved', { ruleId: rule.id, name: rule.name }, 'info');
      } else if (!prev) {
        // First evaluation, rule is OK
        alertState.set(rule.id, {
          id: rule.id,
          name: rule.name,
          state: 'ok',
          severity: 'info',
          message,
          firedAt: null,
          resolvedAt: null,
        });
      }
    }
  }

  return getAlerts();
}

/**
 * Return current alert states for all rules.
 * @returns {object[]}
 */
function getAlerts() {
  evaluate._lastEval = Date.now();
  return rules.map((r) => alertState.get(r.id) ?? {
    id: r.id,
    name: r.name,
    state: 'ok',
    severity: 'info',
    message: 'Not yet evaluated',
    firedAt: null,
    resolvedAt: null,
  });
}

/**
 * Return the last N alert transition records.
 * @param {number} [limit=50]
 * @returns {object[]}
 */
function getAlertHistory(limit = 50) {
  return [...alertHistory].reverse().slice(0, limit);
}

function _appendHistory(entry) {
  alertHistory.push(entry);
  if (alertHistory.length > MAX_HISTORY) {
    alertHistory = alertHistory.slice(alertHistory.length - MAX_HISTORY);
  }
}

/**
 * Reset all alert state (useful in tests).
 */
function reset() {
  alertState.clear();
  alertHistory = [];
}

module.exports = {
  evaluate,
  getAlerts,
  getAlertHistory,
  rules,
  THRESHOLDS,
  reset,
};
