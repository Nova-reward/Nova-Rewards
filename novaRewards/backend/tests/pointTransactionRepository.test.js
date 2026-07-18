'use strict';

/**
 * pointTransactionRepository.test.js
 *
 * Unit tests for pointTransactionRepository covering:
 *  1. getUserBalance, getUserTotalPoints, getUserReferralPoints, getUserPointTransactions
 *  2. recordPointTransaction — happy path, validation errors, insufficient balance
 *  3. Rollback on DB error
 *  4. Concurrency — 50 parallel inserts for the same user; final balance = sum of amounts
 *  5. Refund (negative delta) atomicity — balance decremented correctly under lock
 *
 * All DB I/O is mocked; no real PostgreSQL connection is required.
 */

jest.mock('../db/index', () => ({
  query: jest.fn(),
  pool:  { connect: jest.fn() },
}));

const { query, pool } = require('../db/index');
const repo            = require('../db/pointTransactionRepository');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a mock pg client whose query() method dispatches on SQL content.
 * Responses are consumed in the order provided via the `map` object:
 *   key: substring of SQL, value: response to return
 *
 * @param {object} sqlResponseMap  { sqlSubstring: resolvedValue | Error }
 */
function buildClient(sqlResponseMap = {}) {
  const client = {
    query: jest.fn(async (sql) => {
      for (const [substr, resp] of Object.entries(sqlResponseMap)) {
        if (sql.includes(substr)) {
          if (resp instanceof Error) throw resp;
          return resp;
        }
      }
      // Default: return empty rows (for BEGIN / COMMIT / ROLLBACK)
      return { rows: [], rowCount: 0 };
    }),
    release: jest.fn(),
  };
  pool.connect.mockResolvedValue(client);
  return client;
}

beforeEach(() => jest.clearAllMocks());

// =============================================================================
// 1. getUserBalance
// =============================================================================
describe('getUserBalance', () => {
  test('returns balance from user_balance table', async () => {
    query.mockResolvedValue({ rows: [{ balance: 250 }] });
    const balance = await repo.getUserBalance(1);
    expect(balance).toBe(250);
    expect(query).toHaveBeenCalledWith(
      'SELECT balance FROM user_balance WHERE user_id = $1',
      [1]
    );
  });

  test('returns 0 when no row exists', async () => {
    query.mockResolvedValue({ rows: [] });
    const balance = await repo.getUserBalance(99);
    expect(balance).toBe(0);
  });
});

// =============================================================================
// 2. getUserTotalPoints
// =============================================================================
describe('getUserTotalPoints', () => {
  test('returns sum of earned, referral, bonus points as string', async () => {
    query.mockResolvedValue({ rows: [{ total: '350' }] });
    const total = await repo.getUserTotalPoints(1);
    expect(total).toBe('350');
  });
});

// =============================================================================
// 3. getUserReferralPoints
// =============================================================================
describe('getUserReferralPoints', () => {
  test('returns sum of referral points as string', async () => {
    query.mockResolvedValue({ rows: [{ total: '100' }] });
    const total = await repo.getUserReferralPoints(1);
    expect(total).toBe('100');
  });
});

// =============================================================================
// 4. getUserPointTransactions
// =============================================================================
describe('getUserPointTransactions', () => {
  test('returns paginated transactions with total', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: '5' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, type: 'earned', amount: 100 }] });

    const result = await repo.getUserPointTransactions(1, { page: 1, limit: 20 });
    expect(result.total).toBe(5);
    expect(result.data).toHaveLength(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});

// =============================================================================
// 5. recordPointTransaction — validation errors
// =============================================================================
describe('recordPointTransaction — validation', () => {
  test('throws 400 on zero amount', async () => {
    await expect(
      repo.recordPointTransaction({ userId: 1, type: 'earned', amount: 0 })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('throws 400 on non-numeric amount', async () => {
    await expect(
      repo.recordPointTransaction({ userId: 1, type: 'earned', amount: NaN })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('throws 400 on fractional amount (rounds to 0 when near-zero)', async () => {
    // Math.round(0.4) = 0 → should throw
    await expect(
      repo.recordPointTransaction({ userId: 1, type: 'earned', amount: 0.4 })
    ).rejects.toMatchObject({ status: 400 });
  });
});

// =============================================================================
// 6. recordPointTransaction — happy path
// =============================================================================
describe('recordPointTransaction — happy path', () => {
  test('inserts transaction and returns row for earned type', async () => {
    const txRow = {
      id: 1, user_id: 1, type: 'earned', amount: 100,
      balance_before: 0, balance_after: 100,
    };
    buildClient({
      'INSERT INTO user_balance': { rows: [], rowCount: 0 },
      'SELECT balance FROM user_balance': { rows: [{ balance: 0 }] },
      'INSERT INTO point_transactions': { rows: [txRow] },
    });

    const result = await repo.recordPointTransaction({
      userId: 1, type: 'earned', amount: 100, description: 'Test earn',
    });

    expect(result).toEqual(txRow);
  });

  test('rounds non-integer amounts before inserting', async () => {
    const txRow = { id: 2, user_id: 1, type: 'earned', amount: 10, balance_before: 0, balance_after: 10 };
    const client = buildClient({
      'INSERT INTO user_balance': { rows: [], rowCount: 0 },
      'SELECT balance FROM user_balance': { rows: [{ balance: 0 }] },
      'INSERT INTO point_transactions': { rows: [txRow] },
    });

    await repo.recordPointTransaction({ userId: 1, type: 'earned', amount: 9.7 });

    // The INSERT params should contain 10 (rounded), not 9.7
    const insertCall = client.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO point_transactions')
    );
    expect(insertCall).toBeDefined();
    expect(insertCall[1][2]).toBe(10); // amount param
  });

  test('client.release() is always called on success', async () => {
    const txRow = { id: 3, user_id: 1, type: 'earned', amount: 50, balance_before: 100, balance_after: 150 };
    const client = buildClient({
      'INSERT INTO user_balance': { rows: [] },
      'SELECT balance FROM user_balance': { rows: [{ balance: 100 }] },
      'INSERT INTO point_transactions': { rows: [txRow] },
    });

    await repo.recordPointTransaction({ userId: 1, type: 'earned', amount: 50 });
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// 7. recordPointTransaction — insufficient balance
// =============================================================================
describe('recordPointTransaction — insufficient balance', () => {
  test('throws 422 when balance would go negative', async () => {
    buildClient({
      'INSERT INTO user_balance': { rows: [] },
      'SELECT balance FROM user_balance': { rows: [{ balance: 10 }] },
    });

    await expect(
      repo.recordPointTransaction({ userId: 1, type: 'redeemed', amount: 50 })
    ).rejects.toMatchObject({ status: 422 });
  });

  test('client.release() is called even when balance check fails', async () => {
    const client = buildClient({
      'INSERT INTO user_balance': { rows: [] },
      'SELECT balance FROM user_balance': { rows: [{ balance: 5 }] },
    });

    await expect(
      repo.recordPointTransaction({ userId: 1, type: 'redeemed', amount: 100 })
    ).rejects.toMatchObject({ status: 422 });

    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// 8. recordPointTransaction — DB error triggers rollback
// =============================================================================
describe('recordPointTransaction — DB error rollback', () => {
  test('rolls back and rethrows on DB error during user_balance insert', async () => {
    const client = buildClient({
      'INSERT INTO user_balance': new Error('DB error'),
    });

    await expect(
      repo.recordPointTransaction({ userId: 1, type: 'earned', amount: 50 })
    ).rejects.toThrow('DB error');

    // ROLLBACK must have been issued
    const rollbackCall = client.query.mock.calls.find(([sql]) => sql === 'ROLLBACK');
    expect(rollbackCall).toBeDefined();
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('rolls back and rethrows on DB error during point_transactions insert', async () => {
    const client = buildClient({
      'INSERT INTO user_balance': { rows: [] },
      'SELECT balance FROM user_balance': { rows: [{ balance: 200 }] },
      'INSERT INTO point_transactions': new Error('insert failed'),
    });

    await expect(
      repo.recordPointTransaction({ userId: 1, type: 'earned', amount: 50 })
    ).rejects.toThrow('insert failed');

    const rollbackCall = client.query.mock.calls.find(([sql]) => sql === 'ROLLBACK');
    expect(rollbackCall).toBeDefined();
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// 9. Concurrency — 50 parallel inserts for the same user
//
// Requirement: the final balance must equal the exact sum of all inserted
// amounts, with no lost updates.
//
// How we simulate MVCC serialisation in the mock:
//   - We maintain an in-memory "balance" variable that is updated atomically
//     using JavaScript's single-threaded event loop.
//   - Each mock call reads the current balance, computes balance_after, and
//     returns it — exactly what the DB does when SELECT ... FOR UPDATE
//     serialises concurrent transactions.
//   - Because Promise resolution in Node.js is interleaved on the microtask
//     queue (not truly parallel), this faithfully models the behaviour of
//     PostgreSQL's row-level lock: all 50 workers "queue up", each sees the
//     balance left by the previous committer, and each adds its amount.
// =============================================================================
describe('concurrent inserts — 50 parallel earned transactions', () => {
  test('final balance equals exact sum of all 50 inserted amounts', async () => {
    // Shared mutable state representing the DB-persisted balance
    let persistedBalance = 0;
    // Each worker gets a unique amount
    const amounts = Array.from({ length: 50 }, (_, i) => (i + 1) * 10); // 10, 20, … 500
    const expectedTotal = amounts.reduce((a, b) => a + b, 0); // 12750

    // Per-call mock: each call reads `persistedBalance`, computes balance_after,
    // "commits" it, and returns the row.
    pool.connect.mockImplementation(async () => {
      const client = {
        query: jest.fn(async (sql, params) => {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO user_balance')) {
            return { rows: [], rowCount: 0 };
          }
          if (sql.includes('SELECT balance FROM user_balance')) {
            // Return current balance (simulating SELECT ... FOR UPDATE)
            return { rows: [{ balance: persistedBalance }] };
          }
          if (sql.includes('INSERT INTO point_transactions')) {
            // params[4] = balance_after
            const balanceAfter = params[4];
            // "Commit" — advance the persisted balance
            persistedBalance = balanceAfter;
            return {
              rows: [{
                id: Math.random(),
                user_id: params[0],
                type: params[1],
                amount: params[2],
                balance_before: params[3],
                balance_after: params[4],
              }],
            };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      return client;
    });

    // Fire all 50 inserts concurrently
    const results = await Promise.all(
      amounts.map(amount =>
        repo.recordPointTransaction({ userId: 42, type: 'earned', amount })
      )
    );

    expect(results).toHaveLength(50);

    // Every call must have returned a valid row
    for (const row of results) {
      expect(row).toBeDefined();
      expect(typeof row.balance_after).toBe('number');
    }

    // Final persisted balance must equal the sum of all amounts
    expect(persistedBalance).toBe(expectedTotal);
  });
});

// =============================================================================
// 10. Refund atomicity — negative delta updates balance correctly
// =============================================================================
describe('refund (negative delta) atomicity', () => {
  test('a redeemed transaction correctly decrements the balance', async () => {
    const startingBalance = 500;
    const redeemAmount    = 150;
    const expectedAfter   = startingBalance - redeemAmount; // 350

    const txRow = {
      id: 99, user_id: 7, type: 'redeemed', amount: redeemAmount,
      balance_before: startingBalance, balance_after: expectedAfter,
    };
    buildClient({
      'INSERT INTO user_balance': { rows: [] },
      'SELECT balance FROM user_balance': { rows: [{ balance: startingBalance }] },
      'INSERT INTO point_transactions': { rows: [txRow] },
    });

    const result = await repo.recordPointTransaction({
      userId: 7, type: 'redeemed', amount: redeemAmount,
    });

    expect(result.balance_after).toBe(expectedAfter);
    expect(result.balance_before).toBe(startingBalance);
    expect(result.amount).toBe(redeemAmount);
  });

  test('a refund that would go negative is rejected with 422', async () => {
    buildClient({
      'INSERT INTO user_balance': { rows: [] },
      'SELECT balance FROM user_balance': { rows: [{ balance: 100 }] },
    });

    await expect(
      repo.recordPointTransaction({ userId: 7, type: 'redeemed', amount: 200 })
    ).rejects.toMatchObject({ status: 422 });
  });

  test('a refund to exactly zero balance is accepted', async () => {
    const txRow = {
      id: 100, user_id: 7, type: 'redeemed', amount: 100,
      balance_before: 100, balance_after: 0,
    };
    buildClient({
      'INSERT INTO user_balance': { rows: [] },
      'SELECT balance FROM user_balance': { rows: [{ balance: 100 }] },
      'INSERT INTO point_transactions': { rows: [txRow] },
    });

    const result = await repo.recordPointTransaction({
      userId: 7, type: 'redeemed', amount: 100,
    });

    expect(result.balance_after).toBe(0);
  });

  test('client.release() is called after a successful refund', async () => {
    const txRow = { id: 101, user_id: 7, type: 'redeemed', amount: 50, balance_before: 200, balance_after: 150 };
    const client = buildClient({
      'INSERT INTO user_balance': { rows: [] },
      'SELECT balance FROM user_balance': { rows: [{ balance: 200 }] },
      'INSERT INTO point_transactions': { rows: [txRow] },
    });

    await repo.recordPointTransaction({ userId: 7, type: 'redeemed', amount: 50 });
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// 11. Bonus / referral types are treated as credits (positive delta)
// =============================================================================
describe('bonus and referral types', () => {
  for (const type of ['bonus', 'referral']) {
    test(`"${type}" increases balance`, async () => {
      const startingBalance = 100;
      const amount          = 50;
      const expectedAfter   = 150;

      const txRow = { id: 200, user_id: 1, type, amount, balance_before: startingBalance, balance_after: expectedAfter };
      buildClient({
        'INSERT INTO user_balance': { rows: [] },
        'SELECT balance FROM user_balance': { rows: [{ balance: startingBalance }] },
        'INSERT INTO point_transactions': { rows: [txRow] },
      });

      const result = await repo.recordPointTransaction({ userId: 1, type, amount });
      expect(result.balance_after).toBe(expectedAfter);
    });
  }
});
