/**
 * k6 Load Test — GET /api/campaigns
 *
 * Simulates merchant dashboard traffic polling the campaign list.
 * Each VU authenticates as one of a pool of merchants via x-api-key.
 *
 * Load profile:
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
 *     -e MERCHANT_API_KEYS="key1,key2,key3" \
 *     novaRewards/backend/tests/load/scenarios/campaigns-list.js
 *
 * Prerequisites:
 *   - At least one merchant API key in MERCHANT_API_KEYS (comma-separated).
 *   - The corresponding merchants must exist in the DB.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate = new Rate('campaigns_error_rate');
const p95Latency = new Trend('campaigns_p95_latency', true);

// ---------------------------------------------------------------------------
// Test configuration
// ---------------------------------------------------------------------------
export const options = {
  scenarios: {
    campaigns_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 100 },
        { duration: '10m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },

  thresholds: {
    'http_req_duration{scenario:campaigns_ramp}': ['p(95)<500'],
    'campaigns_error_rate': ['rate<0.001'],
    checks: ['rate>0.999'],
  },
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Accept a comma-separated list of API keys so multiple merchants can be
// simulated, distributing load across different DB rows.
const rawKeys = __ENV.MERCHANT_API_KEYS || 'test-api-key';
const MERCHANT_API_KEYS = rawKeys.split(',').map((k) => k.trim()).filter(Boolean);

if (MERCHANT_API_KEYS.length === 0) {
  console.warn('[campaigns-list] MERCHANT_API_KEYS not set; requests will return 401');
}

// ---------------------------------------------------------------------------
// VU lifecycle
// ---------------------------------------------------------------------------
export default function campaignsListTest() {
  // Round-robin across the merchant key pool
  const keyIndex = (__VU - 1) % MERCHANT_API_KEYS.length;
  const apiKey = MERCHANT_API_KEYS[keyIndex];

  const params = {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    tags: { endpoint: 'campaigns_list' },
  };

  const res = http.get(`${BASE_URL}/api/campaigns`, params);

  p95Latency.add(res.timings.duration);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'body has success:true': (r) => {
      try {
        return JSON.parse(r.body).success === true;
      } catch {
        return false;
      }
    },
    'data is array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).data);
      } catch {
        return false;
      }
    },
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!success);

  // Realistic think time: 2–5 s (merchant dashboard polling interval)
  sleep(2 + Math.random() * 3);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
export function handleSummary(data) {
  return {
    stdout: buildSummary('GET /api/campaigns', data),
    'test-results/load/campaigns-list-summary.json': JSON.stringify(data, null, 2),
  };
}

function buildSummary(endpoint, data) {
  const dur = data.metrics['http_req_duration'];
  const errs = data.metrics['campaigns_error_rate'];
  if (!dur) return `\n[campaigns-list] No duration metrics collected.\n`;

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
