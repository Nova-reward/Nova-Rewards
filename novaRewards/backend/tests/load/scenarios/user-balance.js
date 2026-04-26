/**
 * k6 Load Test — GET /api/users/:id/balance
 *
 * Simulates authenticated users polling their NOVA token balance.
 * The endpoint caches results in Redis for 30 s, so the test exercises
 * both cache-hit and cache-miss paths by spreading requests across a
 * pool of user IDs.
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
 *     -e USER_TOKEN=<jwt> \
 *     -e USER_ID_MIN=1 \
 *     -e USER_ID_MAX=500 \
 *     novaRewards/backend/tests/load/scenarios/user-balance.js
 *
 * Prerequisites:
 *   - A valid long-lived JWT for a user with role=admin (so it can query
 *     any user ID) OR a pool of per-user tokens.  For simplicity this
 *     script uses a single admin token supplied via K6_USER_TOKEN.
 *   - Users with IDs in [USER_ID_MIN, USER_ID_MAX] must exist in the DB.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate = new Rate('balance_error_rate');
const p95Latency = new Trend('balance_p95_latency', true);
const cacheHits = new Counter('balance_cache_hits');
const cacheMisses = new Counter('balance_cache_misses');

// ---------------------------------------------------------------------------
// Test configuration
// ---------------------------------------------------------------------------
export const options = {
  scenarios: {
    balance_ramp: {
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
    'http_req_duration{scenario:balance_ramp}': ['p(95)<500'],
    'balance_error_rate': ['rate<0.001'],
    checks: ['rate>0.999'],
  },
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const USER_TOKEN = __ENV.USER_TOKEN || '';
const USER_ID_MIN = parseInt(__ENV.USER_ID_MIN || '1', 10);
const USER_ID_MAX = parseInt(__ENV.USER_ID_MAX || '500', 10);

if (!USER_TOKEN) {
  // Warn but don't abort — allows dry-run without a real token
  console.warn('[user-balance] USER_TOKEN not set; requests will return 401');
}

// ---------------------------------------------------------------------------
// VU lifecycle
// ---------------------------------------------------------------------------
export default function userBalanceTest() {
  // Spread load across the user pool to exercise both cache-hit and miss paths.
  // With 100 VUs and a 30 s cache TTL, IDs will be re-requested within the
  // window, generating a realistic mix of hits and misses.
  const userId =
    USER_ID_MIN + Math.floor(Math.random() * (USER_ID_MAX - USER_ID_MIN + 1));

  const params = {
    headers: {
      Authorization: `Bearer ${USER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    tags: { endpoint: 'user_balance' },
  };

  const res = http.get(`${BASE_URL}/api/users/${userId}/balance`, params);

  p95Latency.add(res.timings.duration);

  // Track cache behaviour from the response body
  try {
    const body = JSON.parse(res.body);
    if (body.cached === true) {
      cacheHits.add(1);
    } else {
      cacheMisses.add(1);
    }
  } catch {
    // non-JSON response — counted as error below
  }

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
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

  // Realistic think time: 1–3 s (users don't poll continuously)
  sleep(1 + Math.random() * 2);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
export function handleSummary(data) {
  return {
    stdout: buildSummary('GET /api/users/:id/balance', data),
    'test-results/load/user-balance-summary.json': JSON.stringify(data, null, 2),
  };
}

function buildSummary(endpoint, data) {
  const dur = data.metrics['http_req_duration'];
  const errs = data.metrics['balance_error_rate'];
  const hits = data.metrics['balance_cache_hits'];
  const misses = data.metrics['balance_cache_misses'];
  if (!dur) return `\n[user-balance] No duration metrics collected.\n`;

  const p95 = dur.values['p(95)'] ?? 'N/A';
  const errPct = errs ? (errs.values.rate * 100).toFixed(3) : 'N/A';
  const hitCount = hits?.values?.count ?? 0;
  const missCount = misses?.values?.count ?? 0;
  const total = hitCount + missCount;
  const hitRatio = total > 0 ? ((hitCount / total) * 100).toFixed(1) : 'N/A';

  return `
╔══════════════════════════════════════════════════════╗
║  Load Test Summary — ${endpoint}
╠══════════════════════════════════════════════════════╣
║  p50 latency  : ${(dur.values['p(50)'] ?? 0).toFixed(1)} ms
║  p95 latency  : ${(typeof p95 === 'number' ? p95.toFixed(1) : p95)} ms  (SLA: < 500 ms)
║  p99 latency  : ${(dur.values['p(99)'] ?? 0).toFixed(1)} ms
║  Error rate   : ${errPct} %  (SLA: < 0.1 %)
║  Requests     : ${data.metrics['http_reqs']?.values?.count ?? 'N/A'}
║  Cache hits   : ${hitCount} (${hitRatio} %)
║  Cache misses : ${missCount}
╚══════════════════════════════════════════════════════╝
`;
}
