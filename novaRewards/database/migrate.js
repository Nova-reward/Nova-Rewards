#!/usr/bin/env node
/**
 * NovaRewards Database Migration Runner
 *
 * Schema versioning with up/down support and per-migration transactions.
 *
 * Usage:
 *   node database/migrate.js                  # run all pending migrations
 *   node database/migrate.js --rollback       # roll back the last applied migration
 *   node database/migrate.js --rollback 3     # roll back the last 3 applied migrations
 *   node database/migrate.js --status         # show applied / pending migrations
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Ensure the schema_migrations tracking table exists.
 * This is idempotent and always runs first.
 */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Return sorted list of migration version strings that have up-SQL files.
 * Version = filename without extension, e.g. "001_create_merchants"
 */
function getAvailableMigrations() {
  return fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.up.sql'))
    .map((f) => f.replace(/\.up\.sql$/, ''))
    .sort();
}

/** Return set of already-applied versions from the DB. */
async function getAppliedVersions(client) {
  const { rows } = await client.query(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  return new Set(rows.map((r) => r.version));
}

/** Read a migration SQL file; returns null if the file doesn't exist. */
function readSql(version, direction) {
  const file = path.join(__dirname, `${version}.${direction}.sql`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

// ─── commands ───────────────────────────────────────────────────────────────

async function migrate() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedVersions(client);
    const pending = getAvailableMigrations().filter((v) => !applied.has(v));

    if (pending.length === 0) {
      console.log('Nothing to migrate — database is up to date.');
      return;
    }

    for (const version of pending) {
      const sql = readSql(version, 'up');
      if (!sql) {
        throw new Error(`Missing up-migration file: ${version}.up.sql`);
      }

      console.log(`Applying migration: ${version}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        await client.query('COMMIT');
        console.log(`  ✓ ${version}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration failed [${version}]: ${err.message}`);
      }
    }

    console.log(`\nMigrations complete. Applied ${pending.length} migration(s).`);
  } finally {
    client.release();
  }
}

async function rollback(steps = 1) {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const { rows } = await client.query(
      'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT $1',
      [steps]
    );

    if (rows.length === 0) {
      console.log('Nothing to roll back — no migrations have been applied.');
      return;
    }

    for (const { version } of rows) {
      const sql = readSql(version, 'down');
      if (!sql) {
        throw new Error(
          `Missing down-migration file: ${version}.down.sql — cannot roll back safely.`
        );
      }

      console.log(`Rolling back: ${version}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'DELETE FROM schema_migrations WHERE version = $1',
          [version]
        );
        await client.query('COMMIT');
        console.log(`  ✓ rolled back ${version}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Rollback failed [${version}]: ${err.message}`);
      }
    }

    console.log(`\nRollback complete. Reverted ${rows.length} migration(s).`);
  } finally {
    client.release();
  }
}

async function status() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedVersions(client);
    const available = getAvailableMigrations();

    console.log('\nMigration Status\n' + '─'.repeat(60));
    if (available.length === 0) {
      console.log('No migration files found.');
      return;
    }

    for (const version of available) {
      const state = applied.has(version) ? '✓ applied ' : '○ pending ';
      console.log(`  ${state}  ${version}`);
    }

    const pendingCount = available.filter((v) => !applied.has(v)).length;
    console.log('─'.repeat(60));
    console.log(`  ${applied.size} applied, ${pendingCount} pending\n`);
  } finally {
    client.release();
  }
}

// ─── CLI entry ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  let command = 'migrate';
  let rollbackSteps = 1;

  if (args.includes('--status')) {
    command = 'status';
  } else if (args.includes('--rollback')) {
    command = 'rollback';
    const stepsArg = args[args.indexOf('--rollback') + 1];
    if (stepsArg && /^\d+$/.test(stepsArg)) {
      rollbackSteps = parseInt(stepsArg, 10);
    }
  }

  try {
    if (command === 'migrate') await migrate();
    else if (command === 'rollback') await rollback(rollbackSteps);
    else if (command === 'status') await status();
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
