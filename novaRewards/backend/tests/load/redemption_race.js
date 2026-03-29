/**
 * Load test: Duplicate Redemption Fix (Issue #190)
 * Tool: autocannon (npm install -g autocannon)
 *
 * Scenario: 50 concurrent requests for 1 reward with only 1 unit in stock.
 * Expected: exactly 1 × 200, 49 × 409.
 *
 * Usage:
 *   node tests/load/redemption_race.js
 *
 * Prerequisites:
 *   - Backend running on http://localhost:3001
 *   - DB seeded: user_balances row with user_id='user-load-test' and points >= reward cost
 *                rewards row with id=1 and inventory=1
 */

const autocannon = require('autocannon');

const IDEMPOTENCY_KEY = `load-test-${Date.now()}`;
const CONNECTIONS = 50;
const AMOUNT = 1; // single burst, not sustained

const instance = autocannon(
  {
    url: 'http://localhost:3001/api/redemptions',
    connections: CONNECTIONS,
    amount: CONNECTIONS, // exactly 50 requests total
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // All 50 requests share the same idempotency key — only 1 should win
      'x-idempotency-key': IDEMPOTENCY_KEY,
    },
    body: JSON.stringify({ userId: 'user-load-test', rewardId: 1 }),
  },
  (err, result) => {
    if (err) {
      console.error('autocannon error:', err);
      process.exit(1);
    }

    const ok = result['2xx'] || 0;
    const conflict = result['4xx'] || 0;

    console.log('\n=== Redemption Race Condition Load Test ===');
    console.log(`Total requests : ${result.requests.total}`);
    console.log(`2xx (success)  : ${ok}   (expected: 1)`);
    console.log(`4xx (conflict) : ${conflict}  (expected: 49)`);
    console.log(`Errors         : ${result.errors}`);

    const passed = ok === 1 && conflict === CONNECTIONS - 1;
    console.log(`\nResult: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    process.exit(passed ? 0 : 1);
  }
);

autocannon.track(instance, { renderProgressBar: true });
