const { query } = require('./index');

const WEEKLY_CUTOFF = `NOW() - INTERVAL '7 days'`;

/**
 * Returns top N users by total earned points for the given period,
 * plus the requesting user's rank if they fall outside the top N.
 *
 * @param {'weekly'|'alltime'} period
 * @param {number} limit
 * @param {number|null} currentUserId
 * @returns {Promise<{ rankings: object[], currentUser: object|null }>}
 */
async function getLeaderboard(period, limit, currentUserId) {
  const dateFilter = period === 'weekly' ? `AND created_at >= ${WEEKLY_CUTOFF}` : '';

  const rankSql = `
    SELECT
      user_id,
      SUM(amount) AS total_points,
      RANK() OVER (ORDER BY SUM(amount) DESC) AS rank
    FROM point_transactions
    WHERE type = 'earned' ${dateFilter}
    GROUP BY user_id
  `;

  const { rows: rankings } = await query(
    `SELECT * FROM (${rankSql}) ranked ORDER BY rank LIMIT $1`,
    [limit]
  );

  let currentUser = null;
  if (currentUserId) {
    const inTop = rankings.some((r) => r.user_id === currentUserId);
    if (!inTop) {
      const { rows } = await query(
        `SELECT * FROM (${rankSql}) ranked WHERE user_id = $1`,
        [currentUserId]
      );
      currentUser = rows[0] || null;
    }
  }

  return { rankings, currentUser };
}

module.exports = { getLeaderboard };
