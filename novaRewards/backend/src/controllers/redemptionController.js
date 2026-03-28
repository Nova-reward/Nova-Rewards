const { pool } = require('../../db/index');
const { insertPointTransaction } = require('../models/PointTransaction');

/**
 * POST /api/redemptions
 * Atomically redeems a reward for a user.
 *
 * Race-condition safety (Issue #190):
 *  - Wraps all DB work in a single SERIALIZABLE transaction.
 *  - SELECT ... FOR UPDATE locks the user_balance and reward rows before any reads.
 *  - Unique constraint on idempotency_key prevents double-spend from concurrent retries.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function redeemReward(req, res, next) {
  const { userId, rewardId } = req.body;
  const idempotencyKey = req.idempotencyKey; // set by requireIdempotencyKey middleware

  if (!userId || !rewardId) {
    return res.status(400).json({
      success: false,
      error: 'validation_error',
      message: 'userId and rewardId are required',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock user balance row — prevents concurrent deductions
    const balanceResult = await client.query(
      'SELECT * FROM user_balances WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    const balance = balanceResult.rows[0];
    if (!balance) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'User balance not found',
      });
    }

    // Lock reward row — prevents overselling inventory
    const rewardResult = await client.query(
      'SELECT * FROM rewards WHERE id = $1 FOR UPDATE',
      [rewardId]
    );
    const reward = rewardResult.rows[0];
    if (!reward) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Reward not found',
      });
    }

    // Eligibility checks (after locks are held)
    if (Number(balance.points) < Number(reward.points_cost)) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        success: false,
        error: 'insufficient_points',
        message: 'Insufficient points balance',
      });
    }

    if (reward.inventory <= 0) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        success: false,
        error: 'out_of_stock',
        message: 'Reward is out of stock',
      });
    }

    // Deduct points
    await client.query(
      'UPDATE user_balances SET points = points - $1, updated_at = NOW() WHERE user_id = $2',
      [reward.points_cost, userId]
    );

    // Decrement inventory
    await client.query(
      'UPDATE rewards SET inventory = inventory - 1 WHERE id = $1',
      [rewardId]
    );

    // Insert point_transaction — throws 23505 on duplicate idempotency_key
    const tx = await insertPointTransaction(client, {
      userId,
      rewardId,
      pointsSpent: reward.points_cost,
      idempotencyKey,
    });

    await client.query('COMMIT');

    return res.status(200).json({ success: true, data: tx });
  } catch (err) {
    await client.query('ROLLBACK');

    // Duplicate idempotency key — request already processed
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'duplicate_transaction',
        message: 'Transaction already processed.',
      });
    }

    next(err);
  } finally {
    client.release();
  }
}

module.exports = { redeemReward };
