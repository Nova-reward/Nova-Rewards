const { query } = require('./index');

/**
 * Aggregate platform stats for the admin dashboard.
 * Requirements: #186
 */
async function getStats() {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE is_deleted = FALSE)                          AS total_users,
      (SELECT COALESCE(SUM(amount), 0) FROM point_transactions WHERE type = 'earned') AS total_points_issued,
      (SELECT COALESCE(SUM(amount), 0) FROM point_transactions WHERE type = 'redeemed') AS total_redemptions,
      (SELECT COUNT(*) FROM rewards WHERE is_active = TRUE AND is_deleted = FALSE)   AS active_rewards
  `);
  return rows[0];
}

/**
 * Paginated user list with optional search by email or name.
 * @param {{ search?: string, page: number, limit: number }} opts
 */
async function listUsers({ search, page, limit }) {
  const offset = (page - 1) * limit;
  const params = [`%${search || ''}%`, limit, offset];

  const { rows } = await query(
    `SELECT id, wallet_address, email, first_name, last_name, role, created_at
     FROM users
     WHERE is_deleted = FALSE
       AND (
         email      ILIKE $1 OR
         first_name ILIKE $1 OR
         last_name  ILIKE $1
       )
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    params
  );

  const { rows: countRows } = await query(
    `SELECT COUNT(*) AS total FROM users
     WHERE is_deleted = FALSE
       AND (email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1)`,
    [`%${search || ''}%`]
  );

  return { users: rows, total: parseInt(countRows[0].total) };
}

/** Create a new reward. */
async function createReward({ name, cost, stock, isActive = true }) {
  const { rows } = await query(
    `INSERT INTO rewards (name, cost, stock, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, cost, stock ?? 0, isActive]
  );
  return rows[0];
}

/** Update allowed reward fields. */
async function updateReward(id, { name, cost, stock, isActive }) {
  const fields = [];
  const values = [];
  let i = 1;

  if (name      !== undefined) { fields.push(`name = $${i++}`);      values.push(name); }
  if (cost      !== undefined) { fields.push(`cost = $${i++}`);      values.push(cost); }
  if (stock     !== undefined) { fields.push(`stock = $${i++}`);     values.push(stock); }
  if (isActive  !== undefined) { fields.push(`is_active = $${i++}`); values.push(isActive); }

  if (!fields.length) return getRewardById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await query(
    `UPDATE rewards SET ${fields.join(', ')}
     WHERE id = $${i} AND is_deleted = FALSE
     RETURNING *`,
    values
  );
  return rows[0] || null;
}

/** Soft-delete a reward. */
async function deleteReward(id) {
  const { rowCount } = await query(
    `UPDATE rewards SET is_deleted = TRUE, updated_at = NOW()
     WHERE id = $1 AND is_deleted = FALSE`,
    [id]
  );
  return rowCount > 0;
}

async function getRewardById(id) {
  const { rows } = await query(
    'SELECT * FROM rewards WHERE id = $1 AND is_deleted = FALSE',
    [id]
  );
  return rows[0] || null;
}

module.exports = { getStats, listUsers, createReward, updateReward, deleteReward, getRewardById };
