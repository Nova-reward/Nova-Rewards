const { query } = require('./index');

async function createReward({ name, cost, stock = 0, isActive = true }) {
     const result = await query(
          `INSERT INTO rewards (name, cost, stock, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
          [name, cost, stock, isActive]
     );
     return result.rows[0];
}

async function getRewardById(rewardId) {
     const { rows } = await query('SELECT * FROM rewards WHERE id = $1', [rewardId]);
     return rows[0] || null;
}

async function getAvailableRewards({ page = 1, limit = 20 } = {}) {
     const offset = (page - 1) * limit;
     const { rows: countRows } = await query(
          `SELECT COUNT(*) AS total FROM rewards WHERE is_active = TRUE AND is_deleted = FALSE`,
          []
     );
     const total = parseInt(countRows[0].total, 10);

     const { rows } = await query(
          `SELECT * FROM rewards
     WHERE is_active = TRUE AND is_deleted = FALSE
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
          [limit, offset]
     );

     return { data: rows, total, page, limit };
}

async function updateRewardStock(rewardId, stockDelta) {
     const { rows } = await query(
          `UPDATE rewards
     SET stock = stock + $1, updated_at = NOW()
     WHERE id = $2 AND is_deleted = FALSE
     RETURNING *`,
          [stockDelta, rewardId]
     );
     return rows[0] || null;
}

module.exports = {
     createReward,
     getRewardById,
     getAvailableRewards,
     updateRewardStock,
};
