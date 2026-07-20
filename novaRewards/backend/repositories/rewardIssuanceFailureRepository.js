'use strict';
const { query } = require('../db/index');

class RewardIssuanceFailureRepository {
  /**
   * Persist a failed job to the DLQ table.
   */
  async recordFailure({ jobId, payload, error, attempts }) {
    const existingResult = await query(
      'SELECT * FROM reward_issuance_failures WHERE job_id = $1 LIMIT 1',
      [jobId]
    );

    if (existingResult.rows[0]) {
      return existingResult.rows[0];
    }

    const insertResult = await query(
      `INSERT INTO reward_issuance_failures (job_id, payload, error, attempts, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        jobId,
        JSON.stringify(payload),
        error?.message || String(error),
        attempts,
        new Date().toISOString(),
      ]
    );

    return insertResult.rows[0];
  }

  /**
   * Check if a job has already been successfully reprocessed (idempotency).
   */
  async isReprocessed(jobId) {
    const result = await query(
      'SELECT reprocessed_at FROM reward_issuance_failures WHERE job_id = $1 LIMIT 1',
      [jobId]
    );

    return result.rows[0]?.reprocessed_at != null;
  }

  /**
   * Mark a failure as reprocessed.
   */
  async markReprocessed(jobId, reprocessJobId) {
    await query(
      `UPDATE reward_issuance_failures
       SET reprocessed_at = $1, reprocess_job_id = $2
       WHERE job_id = $3`,
      [new Date().toISOString(), reprocessJobId, jobId]
    );
  }

  /**
   * Get a single failure by job ID.
   */
  async getByJobId(jobId) {
    const result = await query(
      'SELECT * FROM reward_issuance_failures WHERE job_id = $1 LIMIT 1',
      [jobId]
    );
    return result.rows[0] || null;
  }

  /**
   * List pending failures (not yet reprocessed), oldest first.
   */
  async listPending({ limit = 100 } = {}) {
    const result = await query(
      `SELECT * FROM reward_issuance_failures
       WHERE reprocessed_at IS NULL
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
}

module.exports = new RewardIssuanceFailureRepository();