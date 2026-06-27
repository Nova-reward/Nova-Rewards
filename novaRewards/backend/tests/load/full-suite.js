/**
 * k6 Load Test — Full Suite
 *
 * Runs all three critical endpoint scenarios concurrently in a single k6
 * execution, mirroring realistic mixed traffic:
 *
 *   • POST /api/webhooks/actions  — inbound merchant events
 *   • GET  /api/users/:id/balance — user balance polling
 *   • GET  /api/campaigns         — merchant campaign listing
 *
 * Load profile (per scenario):
 *   - Ramp 0 → 100 VUs over 5 minutes
 *   - Sustain 100 VUs for 10 minutes
 *   - Ramp down to 0 over 1 minute
 *   Total peak: ~300 concurrent VUs across all scenarios
 *
 * SLA thresholds (applied globally):
 *   - p95 < 500 ms
 *   - Error rate < 0.1 %
 *
 * Usage:
 *   k6 run \
 *     -e BASE_URL=http://localhost:3001 \
 *     -e WEBHOOK_SECRET=test_secret \
 *     -e USER_TOKEN=<jwt> \
 *     -e USER_ID_MIN=1 \
 *     -e USER_ID_MAX=500 \
 *     -e MERCHANT_API_KEYS="key1,key2,key3" \
 *     --out json=test-results/load/full-suite-raw.json \
 *     novaRewards/backend/tests/load/full-suite.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { crypto } from 'k6/experimental/webcrypto';

// ---------------------------------------------------------------------------
// Custom metrics (namespaced per scenario)
// ---------------------------------------------------------------------------
const webhookErrors = new Rate('webhook_error_rate');
const balanceErrors = new Rate('balance_error_rate');
const campaignErrors = new Rate('campaigns_error_rate');

const webhookLatency = new Trend('webhook_latency_ms', true);
const balanceLatency = new Trend('balance_latency_ms', true);
const campaignLatency = new Trend('campaign_latency_ms', true);

const cacheHits = new Counter('balance_cache_hits');
const cacheMisses = new Counter('balance_cache_misses');

// ---------------------------------------------------------------------------
// Test options
// ---------------------------------------------------------------------------
export const options = {
  scenarios: {
    // ── Scenario 1: Inbound webhook actions ─────────────────────────────
    webhook_actions: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 100 },
        { duration: '10m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'webhookActions',
    },

    // ── Scenario 2: User balance queries ────────────────────────────────
    user_balance: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 100 },
        { duration: '10m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'userBalance',
    },

    // ── Scenario 3: Campaign list ────────────────────────────────────────
    campaigns_list: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 100 },
        { duration: '10m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'campaignsList',
    },
  },

  thresholds: {
    // Global SLA across all HTTP requests
    http_req_duration: ['p(95)<500'],

    // Per-scenario error rates
    webhook_error_rate: ['rate<0.001'],
    balance_error_rate: ['rate<0.001'],
    campaigns_error_rate: ['rate<0.001'],

    // All checks must pass at > 99.9 %
    checks: ['rate>0.999'],
  },
};

// ---------------------------------------------------------------------------
// Environment config
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const WEBHOOK_SECRET = __ENV.WEBHOOK_SECRET || 'test_secret';
const USER_TOKEN = __ENV.USER_TOKEN || '';
const USER_ID_MIN = parseInt(__ENV.USER_ID_MIN || '1', 10);
const USER_ID_MAX = parseInt(__ENV.USER_ID_MAX || '500', 10);
const MERCHANT_API_KEYS = (__ENV.MERCHANT_API_KEYS || 'test-api-key')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

const ACTION_TYPES = ['purchase', 'referral', 'signup', 'checkin', 'review'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function hmacHex(secret, payload) {
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
// Scenario executors
// ---------------------------------------------------------------------------

/** POST /api/webhooks/actions */
export async function webhookActions() {
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
  const signature = await hmacHex(WEBHOOK_SECRET, payloadString);

  const res = http.post(`${BASE_URL}/api/webhooks/actions`, payloadString, {
    headers: {
      'Content-Type': 'application/json',
      'x-signature': signature,
    },
    tags: { scenario: 'webhook_actions', endpoint: 'POST /api/webhooks/actions' },
  });

  webhookLatency.add(res.timings.duration);
  const ok = check(res, {
    'webhook: status 202': (r) => r.status === 202,
    'webhook: success true': (r) => {
      try { return JSON.parse(r.body).success === true; } catch { return false; }
    },
    'webhook: p95 < 500ms': (r) => r.timings.duration < 500,
  });
  webhookErrors.add(!ok);

  sleep(0.5 + Math.random());
}

/** GET /api/users/:id/balance */
export function userBalance() {
  const userId =
    USER_ID_MIN + Math.floor(Math.random() * (USER_ID_MAX - USER_ID_MIN + 1));

  const res = http.get(`${BASE_URL}/api/users/${userId}/balance`, {
    headers: {
      Authorization: `Bearer ${USER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    tags: { scenario: 'user_balance', endpoint: 'GET /api/users/:id/balance' },
  });

  balanceLatency.add(res.timings.duration);

  try {
    const parsed = JSON.parse(res.body);
    if (parsed.cached === true) cacheHits.add(1);
    else cacheMisses.add(1);
  } catch { /* non-JSON */ }

  const ok = check(res, {
    'balance: status 200': (r) => r.status === 200,
    'balance: success true': (r) => {
      try { return JSON.parse(r.body).success === true; } catch { return false; }
    },
    'balance: p95 < 500ms': (r) => r.timings.duration < 500,
  });
  balanceErrors.add(!ok);

  sleep(1 + Math.random() * 2);
}

/** GET /api/campaigns */
export function campaignsList() {
  const keyIndex = (__VU - 1) % MERCHANT_API_KEYS.length;
  const apiKey = MERCHANT_API_KEYS[keyIndex];

  const res = http.get(`${BASE_URL}/api/campaigns`, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    tags: { scenario: 'campaigns_list', endpoint: 'GET /api/campaigns' },
  });

  campaignLatency.add(res.timings.duration);
  const ok = check(res, {
    'campaigns: status 200': (r) => r.status === 200,
    'campaigns: success true': (r) => {
      try { return JSON.parse(r.body).success === true; } catch { return false; }
    },
    'campaigns: data is array': (r) => {
      try { return Array.isArray(JSON.parse(r.body).data); } catch { return false; }
    },
    'campaigns: p95 < 500ms': (r) => r.timings.duration < 500,
  });
  campaignErrors.add(!ok);

  sleep(2 + Math.random() * 3);
}

// ---------------------------------------------------------------------------
// Summary handler — writes JSON artifact + human-readable stdout
// ---------------------------------------------------------------------------
export function handleSummary(data) {
  return {
    stdout: buildFullSummary(data),
    'test-results/load/full-suite-summary.json': JSON.stringify(data, null, 2),
  };
}

function fmt(val) {
  return typeof val === 'number' ? val.toFixed(1) : (val ?? 'N/A');
}

function buildFullSummary(data) {
  const dur = data.metrics['http_req_duration'];
  const wErr = data.metrics['webhook_error_rate'];
  const bErr = data.metrics['balance_error_rate'];
  const cErr = data.metrics['campaigns_error_rate'];
  const wLat = data.metrics['webhook_latency_ms'];
  const bLat = data.metrics['balance_latency_ms'];
  const cLat = data.metrics['campaign_latency_ms'];
  const hits = data.metrics['balance_cache_hits'];
  const misses = data.metrics['balance_cache_misses'];

  const hitCount = hits?.values?.count ?? 0;
  const missCount = misses?.values?.count ?? 0;
  const total = hitCount + missCount;
  const hitRatio = total > 0 ? ((hitCount / total) * 100).toFixed(1) : 'N/A';

  const slaP95 = (dur?.values?.['p(95)'] ?? Infinity) < 500 ? '✅ PASS' : '❌ FAIL';
  const slaWErr = (wErr?.values?.rate ?? 1) < 0.001 ? '✅ PASS' : '❌ FAIL';
  const slaBErr = (bErr?.values?.rate ?? 1) < 0.001 ? '✅ PASS' : '❌ FAIL';
  const slaCErr = (cErr?.values?.rate ?? 1) < 0.001 ? '✅ PASS' : '❌ FAIL';

  return `
╔══════════════════════════════════════════════════════════════╗
║           Nova Rewards — Full Load Test Suite                ║
╠══════════════════════════════════════════════════════════════╣
║  GLOBAL                                                      ║
║    Total requests : ${String(data.metrics['http_reqs']?.values?.count ?? 'N/A').padEnd(36)}║
║    p95 latency    : ${fmt(dur?.values?.['p(95)'])} ms  ${slaP95.padEnd(26)}║
║    p99 latency    : ${fmt(dur?.values?.['p(99)'])} ms${' '.repeat(34)}║
╠══════════════════════════════════════════════════════════════╣
║  POST /api/webhooks/actions                                  ║
║    p95 : ${fmt(wLat?.values?.['p(95)'])} ms                                        ║
║    err : ${fmt((wErr?.values?.rate ?? 0) * 100)} %  ${slaWErr.padEnd(40)}║
╠══════════════════════════════════════════════════════════════╣
║  GET /api/users/:id/balance                                  ║
║    p95        : ${fmt(bLat?.values?.['p(95)'])} ms                                 ║
║    err        : ${fmt((bErr?.values?.rate ?? 0) * 100)} %  ${slaBErr.padEnd(35)}║
║    cache hits : ${hitCount} / ${total} (${hitRatio} %)${' '.repeat(20)}║
╠══════════════════════════════════════════════════════════════╣
║  GET /api/campaigns                                          ║
║    p95 : ${fmt(cLat?.values?.['p(95)'])} ms                                        ║
║    err : ${fmt((cErr?.values?.rate ?? 0) * 100)} %  ${slaCErr.padEnd(40)}║
╚══════════════════════════════════════════════════════════════╝
`;
}
