/**
 * k6 Performance Tests — Issue #946
 *
 * Endpoints under test:
 *   GET /api/wallet/balances/:publicKey  — wallet balance
 *   GET /api/campaigns                   — campaign list
 *
 * Load profile: 100 concurrent VUs for 60 seconds
 *
 * SLOs:
 *   p95 response time < 500 ms
 *   p99 response time < 1000 ms
 *   error rate < 0.1 %
 *
 * Usage:
 *   k6 run \
 *     -e BASE_URL=http://localhost:3001 \
 *     -e USER_TOKEN=<jwt> \
 *     -e MERCHANT_API_KEY=<key> \
 *     -e PUBLIC_KEY=<stellar-public-key> \
 *     --out json=test-results/load/perf-946-raw.json \
 *     novaRewards/backend/tests/load/perf-946.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const balanceErrors = new Rate('balance_error_rate');
const campaignErrors = new Rate('campaign_error_rate');
const balanceLatency = new Trend('balance_latency_ms', true);
const campaignLatency = new Trend('campaign_latency_ms', true);

// ---------------------------------------------------------------------------
// Test options — 100 VUs for 60 s, SLOs enforced as thresholds
// ---------------------------------------------------------------------------
export const options = {
  scenarios: {
    wallet_balance: {
      executor: 'constant-vus',
      vus: 50,
      duration: '60s',
      exec: 'walletBalance',
    },
    campaign_list: {
      executor: 'constant-vus',
      vus: 50,
      duration: '60s',
      exec: 'campaignList',
    },
  },
  thresholds: {
    // p95 < 500 ms
    'http_req_duration{scenario:wallet_balance}': ['p(95)<500'],
    'http_req_duration{scenario:campaign_list}': ['p(95)<500'],
    // p99 < 1000 ms
    balance_latency_ms: ['p(99)<1000'],
    campaign_latency_ms: ['p(99)<1000'],
    // error rate < 0.1 %
    balance_error_rate: ['rate<0.001'],
    campaign_error_rate: ['rate<0.001'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const USER_TOKEN = __ENV.USER_TOKEN || '';
const MERCHANT_API_KEY = __ENV.MERCHANT_API_KEY || '';
const PUBLIC_KEY = __ENV.PUBLIC_KEY || 'GABC1234567890ABCDEF';

const authHeaders = {
  Authorization: `Bearer ${USER_TOKEN}`,
  'Content-Type': 'application/json',
};

const merchantHeaders = {
  'x-api-key': MERCHANT_API_KEY,
  'Content-Type': 'application/json',
};

// ---------------------------------------------------------------------------
// Scenario: wallet balance
// ---------------------------------------------------------------------------
export function walletBalance() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/wallet/balances/${PUBLIC_KEY}`, { headers: authHeaders });
  const elapsed = Date.now() - start;

  balanceLatency.add(elapsed);

  const ok = check(res, {
    'balance status 200': (r) => r.status === 200,
    'balance has success field': (r) => {
      try { return JSON.parse(r.body).success === true; } catch { return false; }
    },
  });

  balanceErrors.add(!ok);
  sleep(0.5);
}

// ---------------------------------------------------------------------------
// Scenario: campaign list
// ---------------------------------------------------------------------------
export function campaignList() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/campaigns`, { headers: merchantHeaders });
  const elapsed = Date.now() - start;

  campaignLatency.add(elapsed);

  const ok = check(res, {
    'campaigns status 200 or 401': (r) => [200, 401].includes(r.status),
    'campaigns response is JSON': (r) => {
      try { JSON.parse(r.body); return true; } catch { return false; }
    },
  });

  campaignErrors.add(res.status >= 500);
  sleep(0.5);
}
