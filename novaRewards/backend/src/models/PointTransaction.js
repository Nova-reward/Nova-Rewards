const { pool } = require('../db/index');

/**
 * Inserts a point_transaction record within an existing client transaction.
 * Throws on duplicate idempotency_key (pg error code 23505).
 *
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string, rewardId: number, pointsSpent: number, idempotencyKey: string }} params
 * @returns {Promise<object>} Inserted row
 */
async function insertPointTransaction(client, { userId, rewardId, pointsSpent, idempotencyKey }) {
  const result = await client.query(
    `INSERT INTO point_transactions (user_id, reward_id, points_spent, idempotency_key)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, rewardId, pointsSpent, idempotencyKey]
  );
  return result.rows[0];
}

module.exports = { insertPointTransaction };
