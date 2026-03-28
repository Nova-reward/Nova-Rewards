// Unit tests for pointTransactionRepository
jest.mock('../db/index', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() },
}));

const { query, pool } = require('../db/index');
const repo = require('../db/pointTransactionRepository');

// Helper: build a mock pg client
function mockClient(responses = []) {
  let callIndex = 0;
  const client = {
    query: jest.fn(async () => {
      const resp = responses[callIndex++];
      if (resp instanceof Error) throw resp;
      return resp || { rows: [], rowCount: 0 };
    }),
    release: jest.fn(),
  };
  pool.connect.mockResolvedValue(client);
  return client;
}

beforeEach(() => jest.clearAllMocks());

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

describe('getUserTotalPoints', () => {
  test('returns sum of earned, referral, bonus points as string', async () => {
    query.mockResolvedValue({ rows: [{ total: '350' }] });
    const total = await repo.getUserTotalPoints(1);
    expect(total).toBe('350');
  });
});

describe('getUserReferralPoints', () => {
  test('returns sum of referral points as string', async () => {
    query.mockResolvedValue({ rows: [{ total: '100' }] });
    const total = await repo.getUserReferralPoints(1);
    expect(total).toBe('100');
  });
});

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

describe('recordPointTransaction', () => {
  test('inserts transaction and returns row', async () => {
    const txRow = { id: 1, user_id: 1, type: 'earned', amount: 100, balance_before: 0, balance_after: 100 };
    const client = mockClient([
      { rows: [], rowCount: 0 },           // BEGIN
      { rows: [], rowCount: 0 },           // INSERT INTO user_balance ... ON CONFLICT
      { rows: [{ balance: 0 }] },          // SELECT balance FOR UPDATE
      { rows: [txRow] },                   // INSERT INTO point_transactions
      { rows: [], rowCount: 0 },           // COMMIT
    ]);
    // Override client.query to handle BEGIN/COMMIT as strings
    client.query.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO user_balance')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT balance FROM user_balance')) return { rows: [{ balance: 0 }] };
      if (sql.includes('INSERT INTO point_transactions')) return { rows: [txRow] };
      return { rows: [] };
    });

    const result = await repo.recordPointTransaction({
      userId: 1,
      type: 'earned',
      amount: 100,
      description: 'Test',
    });

    expect(result).toEqual(txRow);
    expect(client.release).toHaveBeenCalled();
  });

  test('throws on zero amount', async () => {
    await expect(
      repo.recordPointTransaction({ userId: 1, type: 'earned', amount: 0 })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('throws on insufficient balance for debit', async () => {
    const client = mockClient();
    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('INSERT INTO user_balance')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT balance FROM user_balance')) return { rows: [{ balance: 10 }] };
      return { rows: [] };
    });

    await expect(
      repo.recordPointTransaction({ userId: 1, type: 'redeemed', amount: 50 })
    ).rejects.toMatchObject({ status: 422 });

    expect(client.release).toHaveBeenCalled();
  });

  test('rolls back and rethrows on DB error', async () => {
    const client = mockClient();
    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('INSERT INTO user_balance')) throw new Error('DB error');
      return { rows: [] };
    });

    await expect(
      repo.recordPointTransaction({ userId: 1, type: 'earned', amount: 50 })
    ).rejects.toThrow('DB error');

    expect(client.release).toHaveBeenCalled();
  });
});
