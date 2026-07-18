/**
 * Nova Rewards — migration runner with version tracking + down migrations.
 *
 * Convention:
 *   database/NNNN_description.up.sql
 *   database/NNNN_description.down.sql
 *
 * Tracking:
 *   schema_migrations table stores applied migration `id` (filename base).
 *
 * Usage:
 *   node database/migrate.js            # apply pending up migrations
 *   node database/migrate.js --rollback # revert the most recently applied migration
 *   node database/migrate.js --status   # list applied migrations
 */

require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'database');
const MIGRATIONS_TABLE = 'schema_migrations';

function sqlFilenameBase(file) {
  // For: 001_create_merchants.up.sql -> 001_create_merchants
  // For: 001_create_merchants.down.sql -> 001_create_merchants
  return file.replace(/\.(up|down)\.sql$/i, '');
}

function getMigrationFiles() {
  const all = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.sql'));

  const bases = new Set(all.map(sqlFilenameBase));

  // Only include migration bases that have BOTH up and down SQL.
  const migrations = [];
  for (const base of bases) {
    const up = `${base}.up.sql`;
    const down = `${base}.down.sql`;
    if (all.includes(up) && all.includes(down)) {
      migrations.push({ id: base, up, down });
    }
  }

  // Deterministic order by numeric prefix.
  migrations.sort((a, b) => {
    const an = parseInt(a.id.split('_')[0], 10);
    const bn = parseInt(b.id.split('_')[0], 10);
    return (Number.isNaN(an) ? 0 : an) - (Number.isNaN(bn) ? 0 : bn);
  });

  return migrations;
}

async function getConnectionString() {
  const secretArn = process.env.DB_MIGRATE_SECRET_ARN;
  if (secretArn) {
    const { SecretsManagerClient, GetSecretValueCommand } =
      await import('@aws-sdk/client-secrets-manager');
    const client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    const { SecretString } = await client.send(
      new GetSecretValueCommand({ SecretId: secretArn })
    );
    const { username, password, host, port, dbname } = JSON.parse(SecretString);
    return `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbname}`;
  }
  return process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id          TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedIds(client) {
  const { rows } = await client.query(
    `SELECT id FROM ${MIGRATIONS_TABLE} ORDER BY applied_at`
  );
  return rows.map((r) => r.id);
}

async function getMostRecentlyApplied(client) {
  const { rows } = await client.query(
    `SELECT id FROM ${MIGRATIONS_TABLE} ORDER BY applied_at DESC LIMIT 1`
  );
  return rows[0]?.id || null;
}

async function runSqlFile(client, filename) {
  const fullPath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(fullPath, 'utf8');
  // Execute the entire file.
  await client.query(sql);
}

async function migrateUp() {
  const pool = new Pool({
    connectionString: await getConnectionString(),
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : false,
  });

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);

    const migrations = getMigrationFiles();
    const appliedIds = await getAppliedIds(client);
    const appliedSet = new Set(appliedIds);

    const pending = migrations.filter((m) => !appliedSet.has(m.id));
    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    await client.query('BEGIN');
    try {
      for (const m of pending) {
        console.log(`Applying ${m.id} ...`);
        await runSqlFile(client, m.up);
        await client.query(
          `INSERT INTO ${MIGRATIONS_TABLE}(id) VALUES ($1)`,
          [m.id]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    console.log(
      `Migrations complete. Applied ${pending.length} migration(s).`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

async function rollbackLast() {
  const pool = new Pool({
    connectionString: await getConnectionString(),
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : false,
  });

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);

    const migrations = getMigrationFiles();
    const mostRecentId = await getMostRecentlyApplied(client);
    if (!mostRecentId) {
      console.log('No applied migrations to roll back.');
      return;
    }

    const m = migrations.find((x) => x.id === mostRecentId);
    if (!m) {
      throw new Error(
        `Most recently applied migration '${mostRecentId}' not found on disk.`
      );
    }

    await client.query('BEGIN');
    try {
      console.log(`Rolling back ${m.id} ...`);
      await runSqlFile(client, m.down);
      await client.query(
        `DELETE FROM ${MIGRATIONS_TABLE} WHERE id = $1`,
        [m.id]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    console.log('Rollback complete (1 migration).');
  } finally {
    client.release();
    await pool.end();
  }
}

async function status() {
  const pool = new Pool({
    connectionString: await getConnectionString(),
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : false,
  });

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);

    const migrations = getMigrationFiles();
    const appliedIds = await getAppliedIds(client);
    const appliedSet = new Set(appliedIds);

    console.log('\nMigration status:');
    for (const m of migrations) {
      console.log(`  ${appliedSet.has(m.id) ? '✓' : '○'} ${m.id}`);
    }

    console.log(`\nApplied: ${appliedIds.length}`);
  } finally {
    client.release();
    await pool.end();
  }
}

const args = process.argv.slice(2);
const action = args.includes('--rollback')
  ? rollbackLast
  : args.includes('--status')
    ? status
    : migrateUp;

action().catch((err) => {
  console.error(err);
  process.exit(1);
});

