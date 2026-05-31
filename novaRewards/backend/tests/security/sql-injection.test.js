/**
 * SQL Injection Tests — Issue #948
 *
 * Verifies that all API endpoints accepting user input use parameterized
 * queries and reject malicious SQL payloads with 400 errors (not DB errors
 * or data leaks).
 *
 * Coverage:
 *   - String injection (classic ' OR 1=1--, UNION SELECT, etc.)
 *   - Numeric injection (1; DROP TABLE, 1 OR 1=1)
 *   - Second-order injection (stored then retrieved)
 *   - All endpoints that accept user-controlled input
 *
 * Run: cd novaRewards/backend && npm run security
 */

const request = require('supertest');
const app = require('../../server');

// ── Payload sets ──────────────────────────────────────────────────────────────

const STRING_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "' UNION SELECT username, password FROM users --",
  "' OR 1=1 --",
  "'; SELECT * FROM information_schema.tables --",
  "' AND SLEEP(5) --",
  "'; EXEC xp_cmdshell('whoami') --",
  "\\'; DROP TABLE campaigns; --",
];

const NUMERIC_PAYLOADS = [
  '1 OR 1=1',
  '1; DROP TABLE users',
  '0 UNION SELECT 1,2,3',
  '-1 OR 1=1',
  '1 AND SLEEP(5)',
];

// Payloads that look valid but contain embedded SQL (second-order)
const SECOND_ORDER_PAYLOADS = [
  "admin'--",
  "user@example.com' OR '1'='1",
  "Nova' UNION SELECT secret FROM tokens --",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Assert a response is a safe rejection:
 *   - Status must be 400 (validation error), 401, or 404 — never 500
 *   - Body must not contain raw SQL error strings
 */
function assertSafeRejection(res) {
  expect(res.status).not.toBe(500);
  expect(res.status).not.toBe(200); // should not succeed with injected input

  const body = JSON.stringify(res.body) + (res.text || '');
  expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation|ORA-|mysql_/i);
  expect(body).not.toMatch(/error in query|unterminated quoted/i);
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

describe('SQL Injection — POST /api/auth/register', () => {
  test.each(STRING_PAYLOADS)('string payload in email: %s', async (payload) => {
    const res = await request(app).post('/api/auth/register').send({
      email: payload,
      password: 'ValidPass123!',
      firstName: 'Test',
      lastName: 'User',
    });
    assertSafeRejection(res);
  });

  test.each(SECOND_ORDER_PAYLOADS)('second-order payload in email: %s', async (payload) => {
    const res = await request(app).post('/api/auth/register').send({
      email: payload,
      password: 'ValidPass123!',
      firstName: 'Test',
      lastName: 'User',
    });
    assertSafeRejection(res);
  });

  test.each(STRING_PAYLOADS)('string payload in firstName: %s', async (payload) => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'ValidPass123!',
      firstName: payload,
      lastName: 'User',
    });
    // firstName may pass validation (it's a string field) but must not cause DB error
    expect(res.status).not.toBe(500);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });
});

describe('SQL Injection — POST /api/auth/login', () => {
  test.each(STRING_PAYLOADS)('string payload in email: %s', async (payload) => {
    const res = await request(app).post('/api/auth/login').send({
      email: payload,
      password: 'anypassword',
    });
    assertSafeRejection(res);
  });

  test.each(STRING_PAYLOADS)('string payload in password: %s', async (payload) => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: payload,
    });
    // Password field: must not leak DB errors regardless of status
    expect(res.status).not.toBe(500);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });
});

// ── User endpoints ────────────────────────────────────────────────────────────

describe('SQL Injection — GET /api/users/:id', () => {
  test.each(STRING_PAYLOADS)('string payload in :id: %s', async (payload) => {
    const res = await request(app)
      .get(`/api/users/${encodeURIComponent(payload)}`)
      .set('Authorization', 'Bearer mock-jwt-user-1');
    expect(res.status).not.toBe(500);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });

  test.each(NUMERIC_PAYLOADS)('numeric payload in :id: %s', async (payload) => {
    const res = await request(app)
      .get(`/api/users/${encodeURIComponent(payload)}`)
      .set('Authorization', 'Bearer mock-jwt-user-1');
    expect(res.status).not.toBe(500);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });
});

describe('SQL Injection — GET /api/users/:id/balance', () => {
  test.each(STRING_PAYLOADS)('string payload in :id: %s', async (payload) => {
    const res = await request(app)
      .get(`/api/users/${encodeURIComponent(payload)}/balance`)
      .set('Authorization', 'Bearer mock-jwt-user-1');
    expect(res.status).not.toBe(500);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });
});

// ── Campaign endpoints ────────────────────────────────────────────────────────

describe('SQL Injection — GET /api/campaigns', () => {
  test.each(STRING_PAYLOADS)('string payload in query param: %s', async (payload) => {
    const res = await request(app)
      .get('/api/campaigns')
      .query({ search: payload })
      .set('x-api-key', 'test-merchant-key');
    expect(res.status).not.toBe(500);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });
});

describe('SQL Injection — POST /api/campaigns', () => {
  test.each(STRING_PAYLOADS)('string payload in name: %s', async (payload) => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', 'test-merchant-key')
      .send({ name: payload, points_per_dollar: 1.0, active: true });
    expect(res.status).not.toBe(500);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });

  test.each(NUMERIC_PAYLOADS)('numeric payload in points_per_dollar: %s', async (payload) => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('x-api-key', 'test-merchant-key')
      .send({ name: 'Test Campaign', points_per_dollar: payload, active: true });
    expect(res.status).not.toBe(500);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });
});

// ── Transaction endpoints ─────────────────────────────────────────────────────

describe('SQL Injection — POST /api/transactions/record', () => {
  test.each(STRING_PAYLOADS)('string payload in txHash: %s', async (payload) => {
    const res = await request(app)
      .post('/api/transactions/record')
      .send({ txHash: payload, txType: 'distribution', amount: '1.0' });
    expect(res.status).toBe(400);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });

  test.each(NUMERIC_PAYLOADS)('numeric payload in amount: %s', async (payload) => {
    const res = await request(app)
      .post('/api/transactions/record')
      .send({ txHash: 'valid-hash', txType: 'distribution', amount: payload });
    expect(res.status).not.toBe(500);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });
});

describe('SQL Injection — GET /api/transactions/:walletAddress', () => {
  test.each(STRING_PAYLOADS)('string payload in walletAddress: %s', async (payload) => {
    const res = await request(app)
      .get(`/api/transactions/${encodeURIComponent(payload)}`);
    expect(res.status).not.toBe(500);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });
});

// ── Redemption endpoints ──────────────────────────────────────────────────────

describe('SQL Injection — POST /api/redemptions', () => {
  test.each(STRING_PAYLOADS)('string payload in campaign_id: %s', async (payload) => {
    const res = await request(app)
      .post('/api/redemptions')
      .set('Authorization', 'Bearer mock-jwt-user-1')
      .send({ campaign_id: payload, amount: 10 });
    expect(res.status).not.toBe(500);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });
});

// ── Search endpoint ───────────────────────────────────────────────────────────

describe('SQL Injection — GET /api/search', () => {
  test.each(STRING_PAYLOADS)('string payload in q param: %s', async (payload) => {
    const res = await request(app)
      .get('/api/search')
      .query({ q: payload })
      .set('Authorization', 'Bearer mock-jwt-user-1');
    expect(res.status).not.toBe(500);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });
});

// ── Rewards endpoint ──────────────────────────────────────────────────────────

describe('SQL Injection — POST /api/rewards/issue', () => {
  test.each(STRING_PAYLOADS)('string payload in user_id: %s', async (payload) => {
    const res = await request(app)
      .post('/api/rewards/issue')
      .set('x-api-key', 'test-merchant-key')
      .send({ user_id: payload, campaign_id: 1, amount: '10' });
    expect(res.status).not.toBe(500);
    const body = JSON.stringify(res.body) + (res.text || '');
    expect(body).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
  });
});

// ── Second-order injection ────────────────────────────────────────────────────
// Verify that data stored via one endpoint cannot be used to inject SQL
// when retrieved via another endpoint.

describe('SQL Injection — second-order via registration then retrieval', () => {
  test.each(SECOND_ORDER_PAYLOADS)(
    'second-order payload stored in firstName then retrieved: %s',
    async (payload) => {
      // Attempt to register with injected firstName
      const registerRes = await request(app).post('/api/auth/register').send({
        email: `sqli-test-${Date.now()}@example.com`,
        password: 'ValidPass123!',
        firstName: payload,
        lastName: 'Tester',
      });

      // Registration may succeed (firstName is a valid string field) or fail validation
      expect(registerRes.status).not.toBe(500);
      const regBody = JSON.stringify(registerRes.body) + (registerRes.text || '');
      expect(regBody).not.toMatch(/syntax error|SQL|pg_|column|relation/i);

      // If registration succeeded, attempt to retrieve the user
      if (registerRes.status === 201 && registerRes.body?.data?.id) {
        const userId = registerRes.body.data.id;
        const getRes = await request(app)
          .get(`/api/users/${userId}`)
          .set('Authorization', `Bearer ${registerRes.body?.data?.token || 'mock-jwt-user-1'}`);

        expect(getRes.status).not.toBe(500);
        const getBody = JSON.stringify(getRes.body) + (getRes.text || '');
        expect(getBody).not.toMatch(/syntax error|SQL|pg_|column|relation/i);
      }
    }
  );
});
