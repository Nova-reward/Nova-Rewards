const { query } = require('../db/index');

/** Deterministic 0-99 bucket for a user+flag combination */
function bucket(userId, flagKey) {
  let hash = 0;
  const str = `${flagKey}:${userId}`;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 100;
}

/** Pick a variant based on weights */
function pickVariant(variants, b) {
  let cumulative = 0;
  for (const v of variants) {
    cumulative += v.weight;
    if (b < cumulative) return v.name;
  }
  return variants[variants.length - 1].name;
}

/**
 * Evaluate a feature flag for a given user.
 * Returns { enabled: bool, variant: string|null }
 */
async function evaluate(flagKey, userId = null) {
  const { rows } = await query(
    `SELECT enabled, rollout_pct, variants, expires_at
     FROM feature_flags WHERE key = $1`,
    [flagKey]
  );

  if (!rows[0] || !rows[0].enabled) return { enabled: false, variant: null };

  const { rollout_pct, variants, expires_at } = rows[0];

  if (expires_at && new Date(expires_at) < new Date()) return { enabled: false, variant: null };

  const b = userId != null ? bucket(userId, flagKey) : Math.floor(Math.random() * 100);
  const enabled = b < rollout_pct;
  const variant = enabled && variants?.length ? pickVariant(variants, b % 100) : null;

  // Fire-and-forget analytics
  query(
    `INSERT INTO feature_flag_events (flag_key, user_id, result, variant) VALUES ($1,$2,$3,$4)`,
    [flagKey, userId, enabled, variant]
  ).catch(() => {});

  return { enabled, variant };
}

/** Get all flags */
async function listFlags() {
  const { rows } = await query(`SELECT * FROM feature_flags ORDER BY key`);
  return rows;
}

/** Get one flag */
async function getFlag(key) {
  const { rows } = await query(`SELECT * FROM feature_flags WHERE key = $1`, [key]);
  return rows[0] ?? null;
}

/** Create a flag */
async function createFlag({ key, enabled = false, rollout_pct = 0, variants = null, metadata = null, expires_at = null }) {
  const { rows } = await query(
    `INSERT INTO feature_flags (key, enabled, rollout_pct, variants, metadata, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [key, enabled, rollout_pct, variants ? JSON.stringify(variants) : null, metadata ? JSON.stringify(metadata) : null, expires_at]
  );
  return rows[0];
}

/** Update a flag */
async function updateFlag(key, updates) {
  const fields = [];
  const values = [];
  let i = 1;
  for (const [k, v] of Object.entries(updates)) {
    fields.push(`${k} = $${i++}`);
    values.push(['variants', 'metadata'].includes(k) && v != null ? JSON.stringify(v) : v);
  }
  if (!fields.length) return getFlag(key);
  values.push(key);
  const { rows } = await query(
    `UPDATE feature_flags SET ${fields.join(', ')} WHERE key = $${i} RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

/** Delete a flag */
async function deleteFlag(key) {
  const { rowCount } = await query(`DELETE FROM feature_flags WHERE key = $1`, [key]);
  return rowCount > 0;
}

/** Delete expired flags and return count */
async function cleanupStaleFlags() {
  const { rowCount } = await query(
    `DELETE FROM feature_flags WHERE expires_at IS NOT NULL AND expires_at < NOW()`
  );
  return rowCount;
}

/** Get analytics for a flag */
async function getFlagAnalytics(key, since = '7 days') {
  const { rows } = await query(
    `SELECT
       variant,
       result,
       COUNT(*) AS evaluations,
       DATE_TRUNC('hour', created_at) AS hour
     FROM feature_flag_events
     WHERE flag_key = $1 AND created_at > NOW() - $2::interval
     GROUP BY variant, result, hour
     ORDER BY hour DESC`,
    [key, since]
  );
  return rows;
}

module.exports = { evaluate, listFlags, getFlag, createFlag, updateFlag, deleteFlag, cleanupStaleFlags, getFlagAnalytics };
