// Unit tests for redemptionRepository — verifies the atomic DB transaction logic
jest.mock('../db/index', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), query: jest.fn() },
}));

const { pool } = require('../db/index');
const { redeemReward, getRedemptionById, getUserRedemptions } = require('../db/redemptionRepository');

// Build a mock pg client with a controllable query implementation
function buildClient(queryImpl) {
  const client = {
    query: jest.fn(queryImpl),
    release: jest.fn(),
  };
  pool.connect.mockResolvedValue(client);
  return client;
}

beforeEach(() => jest.clearAllMocks());

describe('redeemReward', () => {
  const BASE_PARAMS = { userId: 1, rewardId: 5, idempotencyKey: 'key-abc' };

  test('returns existing redemption on idempotent replay', async () => {
    const existing = { id: 10, user_id: 1, reward_id: 5, points_spent: 100, idempotency_key: 'key-abc' };
    buildClient(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('FROM redemptions')) return { rows: [existing] };
      return { rows: [] };
    });

    const result = await redeemReward(BASE_PARAMS);
    expect(result.idempotent).toBe(true);
    expect(result.redemption).toEqual(existing);
  });

  test('completes a fresh redemption atomically', async () => {
    const reward   = { id: 5, name: 'Coffee', cost: '100', stock: 3, is_active: true, is_deleted: false };
    const pointTx  = { id: 42, user_id: 1, type: 'redeemed', amount: 100, balance_before: 500, balance_after: 400 };
    const redemption = { id: 10, user_id: 1, reward_id: 5, points_spent: 100 };

    buildClient(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('FROM redemptions'))                    return { rows: [] };          // no existing
      if (sql.includes('FROM rewards'))                        return { rows: [reward] };
      if (sql.includes('INSERT INTO user_balance'))            return { rows: [], rowCount: 0 };
      if (sql.includes('FROM user_balance'))                   return { rows: [{ balance: 500 }] };
      if (sql.includes('UPDATE rewards'))                      return { rows: [], rowCount: 1 };
      if (sql.includes('INSERT INTO point_transactions'))      return { rows: [pointTx] };
      if (sql.includes('INSERT INTO redemptions'))             return { rows: [redemption] };
      return { rows: [] };
    });

    const result = await redeemReward(BASE_PARAMS);
    expect(result.idempotent).toBe(false);
    expect(result.redemption).toEqual(redemption);
    expect(result.pointTx).toEqual(pointTx);
  });

  test('rolls back and throws 404 when reward not found', async () => {
    const client = buildClient(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM redemptions')) return { rows: [] };
      if (sql.includes('FROM rewards'))     return { rows: [] }; // not found
      return { rows: [] };
    });

    await expect(redeemReward(BASE_PARAMS)).rejects.toMatchObject({ status: 404, code: 'not_found' });
    expect(client.release).toHaveBeenCalled();
  });

  test('rolls back and throws 409 when out of stock', async () => {
    const reward = { id: 5, name: 'Coffee', cost: '100', stock: 0, is_active: true, is_deleted: false };
    buildClient(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM redemptions')) return { rows: [] };
      if (sql.includes('FROM rewards'))     return { rows: [reward] };
      return { rows: [] };
    });

    await expect(redeemReward(BASE_PARAMS)).rejects.toMatchObject({ status: 409, code: 'out_of_stock' });
  });

  test('rolls back and throws 409 when insufficient points', async () => {
    const reward = { id: 5, name: 'Coffee', cost: '500', stock: 10, is_active: true, is_deleted: false };
    buildClient(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM redemptions'))           return { rows: [] };
      if (sql.includes('FROM rewards'))               return { rows: [reward] };
      if (sql.includes('INSERT INTO user_balance'))   return { rows: [], rowCount: 0 };
      if (sql.includes('FROM user_balance'))          return { rows: [{ balance: 100 }] }; // only 100 pts
      return { rows: [] };
    });

    await expect(redeemReward(BASE_PARAMS)).rejects.toMatchObject({ status: 409, code: 'insufficient_points' });
  });

  test('rolls back and throws 409 when reward is inactive', async () => {
    const reward = { id: 5, name: 'Coffee', cost: '100', stock: 5, is_active: false, is_deleted: false };
    buildClient(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM redemptions')) return { rows: [] };
      if (sql.includes('FROM rewards'))     return { rows: [reward] };
      return { rows: [] };
    });

    await expect(redeemReward(BASE_PARAMS)).rejects.toMatchObject({ status: 409, code: 'reward_inactive' });
  });

  test('releases client even when an unexpected error is thrown', async () => {
    const client = buildClient(async (sql) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql === 'ROLLBACK') return { rows: [] };
      throw new Error('unexpected DB error');
    });

    await expect(redeemReward(BASE_PARAMS)).rejects.toThrow('unexpected DB error');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('getRedemptionById', () => {
  test('returns redemption when found', async () => {
    const row = { id: 10, user_id: 1, reward_name: 'Coffee' };
    pool.query = jest.fn().mockResolvedValue({ rows: [row] });
    expect(await getRedemptionById(10, 1)).toEqual(row);
  });

  test('returns null when not found', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [] });
    expect(await getRedemptionById(999, 1)).toBeNull();
  });
});

describe('getUserRedemptions', () => {
  test('returns paginated redemptions', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ total: '3' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] });

    const result = await getUserRedemptions(1, { page: 1, limit: 20 });
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(3);
  });
});
