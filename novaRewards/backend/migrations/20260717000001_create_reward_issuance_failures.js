/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('reward_issuance_failures', (table) => {
    table.increments('id').primary();
    table.string('job_id', 64).notNullable().unique().index();
    table.jsonb('payload').notNullable();
    table.text('error');
    table.integer('attempts').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('reprocessed_at', { useTz: true });
    table.string('reprocess_job_id', 64);
    
    // Index for querying un-reprocessed failures
    table.index(['created_at', 'reprocessed_at'], 'idx_failures_pending');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('reward_issuance_failures');
};