const { pool } = require('./index');

/**
 * Atomically redeems a reward for a user inside a single DB transaction:
 *   1. Lock the reward row and verify it is active, in-stock, and not deleted.
 *   2. Lock the user_balance row and verify sufficient points.
 *   3. Decrement reward.stock by 1.
 *   4. Insert a point_transaction of type 'redeemed'.
 *   5. Insert a redemption audit row (idempotency_key enforces uniqueness).
 *
 * Returns the completed redemption row on success.
 * Throws a structured error (with .status and .code) on business-rule violations.
 *
 * @param {object} params
 * @param {number} params.userId
 * @param {number} params.rewardId
 * @param {string} params.idempotencyKey  - Caller-supplied dedup key
 * @returns {Promise<object>}  The inserted redemption row
 */
async function redeemReward({ userId, rewardId, idempotencyKey }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Idempotency check ────────────────────────────────────────────────
    // If this key was already processed, return the existing redemption
    // immediately without touching any balances or stock.
    const { rows: existing } = await client.query(
      `SELECT r.*, pt.balance_after AS current_balance
       FROM redemptions r
       LEFT JOIN point_transactions pt ON r.point_tx_id = pt.id
       WHERE r.idempotency_key = $1`,
      [idempotencyKey]
    );
    if (existing.length > 0) {
      await client.query('COMMIT');
      return { redemption: existing[0], idempotent: true };
    }

    // ── 2. Lock & validate reward ───────────────────────────────────────────
    const { rows: rewardRows } = await client.query(
      `SELECT id, name, cost, stock, is_active, is_deleted
       FROM rewards
       WHERE id = $1
       FOR UPDATE`,
      [rewardId]
    );

    if (rewardRows.length === 0 || rewardRows[0].is_deleted) {
      throw Object.assign(new Error('Reward not found'), { status: 404, code: 'not_found' });
    }

    const reward = rewardRows[0];

    if (!reward.is_active) {
      throw Object.assign(new Error('Reward is not active'), { status: 409, code: 'reward_inactive' });
    }

    if (reward.stock <= 0) {
      throw Object.assign(new Error('Reward is out of stock'), { status: 409, code: 'out_of_stock' });
    }

    const pointCost = Math.round(Number(reward.cost)); // cost stored as NUMERIC, treat as integer points

    // ── 3. Lock & validate user balance ────────────────────────────────────
    // Ensure the user_balance row exists before locking
    await client.query(
      `INSERT INTO user_balance (user_id, balance) VALUES ($1, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    const { rows: balRows } = await client.query(
      'SELECT balance FROM user_balance WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    const balanceBefore = balRows[0]?.balance ?? 0;

    if (balanceBefore < pointCost) {
      throw Object.assign(
        new Error(`Insufficient points: have ${balanceBefore}, need ${pointCost}`),
        { status: 409, code: 'insufficient_points' }
      );
    }

    const balanceAfter = balanceBefore - pointCost;

    // ── 4. Decrement stock ──────────────────────────────────────────────────
    await client.query(
      `UPDATE rewards SET stock = stock - 1, updated_at = NOW() WHERE id = $1`,
      [rewardId]
    );

    // ── 5. Insert point_transaction ─────────────────────────────────────────
    // Insert directly (bypassing the service-layer helper) so everything stays
    // in the same DB transaction.  The trigger on point_transactions will
    // update user_balance automatically.
    const { rows: txRows } = await client.query(
      `INSERT INTO point_transactions
         (user_id, type, amount, balance_before, balance_after, description)
       VALUES ($1, 'redeemed', $2, $3, $4, $5)
       RETURNING *`,
      [
        userId,
        pointCost,
        balanceBefore,
        balanceAfter,
        `Redeemed reward: ${reward.name}`,
      ]
    );
    const pointTx = txRows[0];

    // ── 6. Insert redemption audit row ──────────────────────────────────────
    const { rows: redemptionRows } = await client.query(
      `INSERT INTO redemptions
         (user_id, reward_id, points_spent, idempotency_key, point_tx_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, rewardId, pointCost, idempotencyKey, pointTx.id]
    );

    await client.query('COMMIT');

    return { redemption: redemptionRows[0], pointTx, idempotent: false };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Returns a single redemption by ID, scoped to the given userId.
 *
 * @param {number} redemptionId
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
async function getRedemptionById(redemptionId, userId) {
  const { rows } = await pool.query(
    `SELECT r.*, rw.name AS reward_name
     FROM redemptions r
     JOIN rewards rw ON r.reward_id = rw.id
     WHERE r.id = $1 AND r.user_id = $2`,
    [redemptionId, userId]
  );
  return rows[0] || null;
}

/**
 * Returns paginated redemption history for a user.
 *
 * @param {number} userId
 * @param {{ page?: number, limit?: number }} opts
 * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
 */
async function getUserRedemptions(userId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;

  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*) AS total FROM redemptions WHERE user_id = $1',
    [userId]
  );
  const total = parseInt(countRows[0].total, 10);

  const { rows } = await pool.query(
    `SELECT r.*, rw.name AS reward_name
     FROM redemptions r
     JOIN rewards rw ON r.reward_id = rw.id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return { data: rows, total, page, limit };
}

module.exports = { redeemReward, getRedemptionById, getUserRedemptions };
