const knex = require('../db/knex');
const { v4: uuidv4 } = require('uuid');

class RewardIssuanceFailureRepository {
  /**
   * Persist a failed job to the DLQ table.
   */
  async recordFailure({ jobId, payload, error, attempts }) {
    const existing = await knex('reward_issuance_failures')
      .where('job_id', jobId)
      .first();
    
    if (existing) {
      // Idempotent update if already recorded (e.g., duplicate event)
      return existing;
    }

    const [record] = await knex('reward_issuance_failures')
      .insert({
        job_id: jobId,
        payload: JSON.stringify(payload),
        error: error?.message || String(error),
        attempts,
        created_at: new Date().toISOString(),
      })
      .returning('*');

    return record;
  }

  /**
   * Check if a job has already been successfully reprocessed (idempotency).
   */
  async isReprocessed(jobId) {
    const record = await knex('reward_issuance_failures')
      .where('job_id', jobId)
      .first();
    
    return record?.reprocessed_at != null;
  }

  /**
   * Mark a failure as reprocessed.
   */
  async markReprocessed(jobId, reprocessJobId) {
    await knex('reward_issuance_failures')
      .where('job_id', jobId)
      .update({
        reprocessed_at: new Date().toISOString(),
        reprocess_job_id: reprocessJobId,
      });
  }

  /**
   * Get a single failure by job ID.
   */
  async getByJobId(jobId) {
    return knex('reward_issuance_failures')
      .where('job_id', jobId)
      .first();
  }

  /**
   * List pending failures (not yet reprocessed), oldest first.
   */
  async listPending({ limit = 100 } = {}) {
    return knex('reward_issuance_failures')
      .whereNull('reprocessed_at')
      .orderBy('created_at', 'asc')
      .limit(limit);
  }
}

module.exports = new RewardIssuanceFailureRepository();