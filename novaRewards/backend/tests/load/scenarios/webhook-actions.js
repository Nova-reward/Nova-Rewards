/**
 * k6 Load Test — POST /api/webhooks/actions
 *
 * Simulates realistic inbound webhook traffic from merchant integrations.
 * Each VU sends a signed action payload and validates the 202 response.
 *
 * Load profile (shared with the other scripts via __ENV):
 *   - Ramp from 0 → 100 VUs over 5 minutes
 *   - Sustain 100 VUs for 10 minutes
 *   - Ramp down to 0 over 1 minute
 *
 * SLA thresholds:
 *   - p95 response time < 500 ms
 *   - Error rate < 0.1 %
 *
 * Usage:
 *   k6 run \
 *     -e BASE_URL=http://localhost:3001 \
 *     -e WEBHOOK_SECRET=test_secret \
 *     novaRewards/backend/tests/load/scenarios/webhook-actions.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { crypto } from 'k6/experimental/webcrypto';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate = new Rate('webhook_error_rate');
const p95Latency = new Trend('webhook_p95_latency', true);

// ---------------------------------------------------------------------------
// Test configuration
// ---------------------------------------------------------------------------
export const options = {
  scenarios: {
    webhook_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 100 }, // ramp up
        { duration: '10m', target: 100 }, // sustain
        { duration: '1m', target: 0 }, // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },

  thresholds: {
    // SLA: p95 < 500 ms
    'http_req_duration{scenario:webhook_ramp}': ['p(95)<500'],
    // SLA: error rate < 0.1 %
    'webhook_error_rate': ['rate<0.001'],
    // Fail the test if any check fails
    checks: ['rate>0.999'],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const WEBHOOK_SECRET = __ENV.WEBHOOK_SECRET || 'test_secret';

/** Action types that mirror real merchant events */
const ACTION_TYPES = ['purchase', 'referral', 'signup', 'checkin', 'review'];

/** Compute HMAC-SHA256 hex digest synchronously via k6 webcrypto */
async function sign(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// VU lifecycle
// ---------------------------------------------------------------------------

/**
 * Default function — executed once per iteration per VU.
 *
 * k6 does not support top-level await, so we use an async default export
 * which k6 handles correctly since v0.38.
 */
export default async function webhookActionsTest() {
  // Build a realistic payload
  const userId = `user-${Math.floor(Math.random() * 10000)}`;
  const action = ACTION_TYPES[Math.floor(Math.random() * ACTION_TYPES.length)];
  const body = {
    action,
    userId,
    details: {
      amount: parseFloat((Math.random() * 500).toFixed(2)),
      currency: 'USD',
      timestamp: new Date().toISOString(),
    },
  };

  const payloadString = JSON.stringify(body);
  const signature = await sign(WEBHOOK_SECRET, payloadString);

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-signature': signature,
    },
    tags: { endpoint: 'webhook_actions' },
  };

  const res = http.post(`${BASE_URL}/api/webhooks/actions`, payloadString, params);

  // Record custom metrics
  p95Latency.add(res.timings.duration);
  const success = check(res, {
    'status is 202': (r) => r.status === 202,
    'body has success:true': (r) => {
      try {
        return JSON.parse(r.body).success === true;
      } catch {
        return false;
      }
    },
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!success);

  // Realistic think time: 0.5–1.5 s between requests
  sleep(0.5 + Math.random());
}

// ---------------------------------------------------------------------------
// Teardown — print summary hint
// ---------------------------------------------------------------------------
export function handleSummary(data) {
  return {
    stdout: buildSummary('POST /api/webhooks/actions', data),
    'test-results/load/webhook-actions-summary.json': JSON.stringify(data, null, 2),
  };
}

function buildSummary(endpoint, data) {
  const dur = data.metrics['http_req_duration'];
  const errs = data.metrics['webhook_error_rate'];
  if (!dur) return `\n[webhook-actions] No duration metrics collected.\n`;

  const p95 = dur.values['p(95)'] ?? 'N/A';
  const errPct = errs ? (errs.values.rate * 100).toFixed(3) : 'N/A';

  return `
╔══════════════════════════════════════════════════════╗
║  Load Test Summary — ${endpoint}
╠══════════════════════════════════════════════════════╣
║  p50 latency : ${(dur.values['p(50)'] ?? 0).toFixed(1)} ms
║  p95 latency : ${(typeof p95 === 'number' ? p95.toFixed(1) : p95)} ms  (SLA: < 500 ms)
║  p99 latency : ${(dur.values['p(99)'] ?? 0).toFixed(1)} ms
║  Error rate  : ${errPct} %  (SLA: < 0.1 %)
║  Requests    : ${data.metrics['http_reqs']?.values?.count ?? 'N/A'}
╚══════════════════════════════════════════════════════╝
`;
}
