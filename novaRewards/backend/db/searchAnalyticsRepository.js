const { query } = require('./index');

/**
 * Persists a search event to the analytics table.
 *
 * @param {{ userId?: number, queryText: string, entityType: string, resultCount: number, durationMs: number }} opts
 * @returns {Promise<object>}
 */
async function recordSearch({ userId = null, queryText, entityType = 'all', resultCount = 0, durationMs = 0 }) {
  const { rows } = await query(
    `INSERT INTO search_analytics (user_id, query, entity_type, result_count, duration_ms)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, queryText, entityType, resultCount, durationMs]
  );
  return rows[0];
}

/**
 * Records a click-through on a search result.
 *
 * @param {number} analyticsId  - Row id returned by recordSearch
 * @param {number} clickedId    - Entity id that was clicked
 * @param {string} clickedType  - Entity type ('reward', 'campaign', 'user')
 */
async function recordClick(analyticsId, clickedId, clickedType) {
  await query(
    `UPDATE search_analytics SET clicked_id = $1, clicked_type = $2 WHERE id = $3`,
    [clickedId, clickedType, analyticsId]
  );
}

/**
 * Returns the top N most-searched queries in the given time window.
 *
 * @param {{ limit?: number, since?: string }} opts
 * @returns {Promise<Array<{ query: string, count: string }>>}
 */
async function getTopQueries({ limit = 20, since = '7 days' } = {}) {
  const { rows } = await query(
    `SELECT query, COUNT(*) AS count
     FROM search_analytics
     WHERE created_at >= NOW() - $1::INTERVAL
     GROUP BY query
     ORDER BY count DESC
     LIMIT $2`,
    [since, limit]
  );
  return rows;
}

/**
 * Returns aggregate search stats for the admin dashboard.
 */
async function getSearchStats() {
  const { rows } = await query(`
    SELECT
      COUNT(*)                                                    AS total_searches,
      COUNT(DISTINCT user_id)                                     AS unique_searchers,
      COUNT(*) FILTER (WHERE clicked_id IS NOT NULL)              AS total_clicks,
      ROUND(
        COUNT(*) FILTER (WHERE clicked_id IS NOT NULL)::NUMERIC
        / NULLIF(COUNT(*), 0) * 100, 2
      )                                                           AS click_through_rate,
      ROUND(AVG(duration_ms), 2)                                  AS avg_duration_ms
    FROM search_analytics
    WHERE created_at >= NOW() - INTERVAL '30 days'
  `);
  return rows[0];
}

module.exports = { recordSearch, recordClick, getTopQueries, getSearchStats };
