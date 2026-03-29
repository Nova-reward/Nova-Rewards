/**
 * Unit tests: Redemption flow — Issue #190 (Duplicate Redemption Fix)
 * Covers all transaction error-handling paths for ≥95% coverage.
 */

process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

const request = require('supertest');

jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));

// --- Mock pg pool -----------------------------------------------------------
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};
jest.mock('../db/index', () => ({
  pool: { connect: jest.fn() },
  query: jest.fn(),
}));

const { pool } = require('../db/index');

// --- Mock PointTransaction model --------------------------------------------
jest.mock('../src/models/PointTransaction', () => ({
  insertPointTransaction: jest.fn(),
}));
const { insertPointTransaction } = require('../src/models/PointTransaction');

const app = require('../server');

const VALID_HEADERS = {
  'x-idempotency-key': 'test-key-123',
  'content-type': 'application/json',
};
const VALID_BODY = { userId: 'user-abc', rewardId: 1 };

const BALANCE_ROW = { user_id: 'user-abc', points: '100' };
const REWARD_ROW  = { id: 1, name: 'Free Coffee', points_cost: '50', inventory: 1 };
const TX_ROW      = { id: 99, user_id: 'user-abc', reward_id: 1, points_spent: '50', idempotency_key: 'test-key-123' };

function setupClientMock(overrides = {}) {
  const responses = {
    BEGIN:   { rows: [] },
    balance: { rows: [overrides.balance ?? BALANCE_ROW] },
    reward:  { rows: [overrides.reward  ?? REWARD_ROW] },
    update1: { rows: [] },
    update2: { rows: [] },
    COMMIT:  { rows: [] },
    ROLLBACK:{ rows: [] },
    ...overrides.queryOverrides,
  };

  let call = 0;
  mockClient.query.mockImplementation((sql) => {
    if (sql === 'BEGIN')    return Promise.resolve(responses.BEGIN);
    if (sql === 'COMMIT')   return Promise.resolve(responses.COMMIT);
    if (sql === 'ROLLBACK') return Promise.resolve(responses.ROLLBACK);
    if (sql.includes('user_balances') && sql.includes('FOR UPDATE')) return Promise.resolve(responses.balance);
    if (sql.includes('rewards') && sql.includes('FOR UPDATE'))        return Promise.resolve(responses.reward);
    if (sql.includes('UPDATE user_balances')) return Promise.resolve(responses.update1);
    if (sql.includes('UPDATE rewards'))       return Promise.resolve(responses.update2);
    return Promise.resolve({ rows: [] });
  });

  pool.connect.mockResolvedValue(mockClient);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
describe('POST /api/redemptions — idempotency middleware', () => {
  test('400 when X-Idempotency-Key header is missing', async () => {
    const res = await request(app)
      .post('/api/redemptions')
      .set('content-type', 'application/json')
      .send(VALID_BODY);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_idempotency_key');
  });

  test('400 when X-Idempotency-Key is blank', async () => {
    const res = await request(app)
      .post('/api/redemptions')
      .set({ ...VALID_HEADERS, 'x-idempotency-key': '   ' })
      .send(VALID_BODY);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_idempotency_key');
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/redemptions — input validation', () => {
  test('400 when userId is missing', async () => {
    setupClientMock();
    const res = await request(app)
      .post('/api/redemptions')
      .set(VALID_HEADERS)
      .send({ rewardId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  test('400 when rewardId is missing', async () => {
    setupClientMock();
    const res = await request(app)
      .post('/api/redemptions')
      .set(VALID_HEADERS)
      .send({ userId: 'user-abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/redemptions — happy path', () => {
  test('200 — commits transaction and returns point_transaction row', async () => {
    setupClientMock();
    insertPointTransaction.mockResolvedValue(TX_ROW);

    const res = await request(app)
      .post('/api/redemptions')
      .set(VALID_HEADERS)
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ id: 99 });

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/redemptions — eligibility failures', () => {
  test('404 when user balance row does not exist', async () => {
    setupClientMock({ balance: undefined, queryOverrides: { balance: { rows: [] } } });

    const res = await request(app)
      .post('/api/redemptions')
      .set(VALID_HEADERS)
      .send(VALID_BODY);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('404 when reward row does not exist', async () => {
    setupClientMock({ reward: undefined, queryOverrides: { reward: { rows: [] } } });

    const res = await request(app)
      .post('/api/redemptions')
      .set(VALID_HEADERS)
      .send(VALID_BODY);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('422 when user has insufficient points', async () => {
    setupClientMock({ balance: { ...BALANCE_ROW, points: '10' } }); // cost is 50

    const res = await request(app)
      .post('/api/redemptions')
      .set(VALID_HEADERS)
      .send(VALID_BODY);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('insufficient_points');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('422 when reward inventory is 0', async () => {
    setupClientMock({ reward: { ...REWARD_ROW, inventory: 0 } });

    const res = await request(app)
      .post('/api/redemptions')
      .set(VALID_HEADERS)
      .send(VALID_BODY);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('out_of_stock');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/redemptions — idempotency / duplicate detection', () => {
  test('409 when idempotency_key already exists (pg error 23505)', async () => {
    setupClientMock();
    const dupError = new Error('duplicate key value violates unique constraint');
    dupError.code = '23505';
    insertPointTransaction.mockRejectedValue(dupError);

    const res = await request(app)
      .post('/api/redemptions')
      .set(VALID_HEADERS)
      .send(VALID_BODY);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('duplicate_transaction');
    expect(res.body.message).toBe('Transaction already processed.');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/redemptions — unexpected errors', () => {
  test('500 propagated via next(err) for unknown DB errors', async () => {
    setupClientMock();
    const unexpectedErr = new Error('connection reset');
    insertPointTransaction.mockRejectedValue(unexpectedErr);

    const res = await request(app)
      .post('/api/redemptions')
      .set(VALID_HEADERS)
      .send(VALID_BODY);

    expect(res.status).toBe(500);
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
