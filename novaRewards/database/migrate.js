/**
 * Nova Rewards — idempotent database migration runner
 *
 * Tracks applied migrations in a `schema_migrations` table.
 * Only runs files not yet recorded — safe to run repeatedly.
 *
 * Production: fetches credentials from AWS Secrets Manager via DB_MIGRATE_SECRET_ARN.
 * Development: falls back to DATABASE_MIGRATE_URL or DATABASE_URL.
 *
 * Usage:
 *   node migrate.js              # run pending migrations
 *   node migrate.js --rollback   # drop all tables (dev only)
 *   node migrate.js --status     # list applied migrations
 */

require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

async function getConnectionString() {
  const secretArn = process.env.DB_MIGRATE_SECRET_ARN;
  if (secretArn) {
    const { SecretsManagerClient, GetSecretValueCommand } =
      await import('@aws-sdk/client-secrets-manager');
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const { SecretString } = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
    const { username, password, host, port, dbname } = JSON.parse(SecretString);
    return `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbname}`;
  }
  return process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL;
}

function getSqlFiles() {
  const sqlDir = path.join(__dirname, '..', 'database');
  return fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort();
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied(client) {
  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map(r => r.filename));
}

async function migrate() {
  const pool = new Pool({ connectionString: await getConnectionString(),
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false });
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);
    const files = getSqlFiles();
    const pending = files.filter(f => !applied.has(f));

    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }

async function migrate() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);
    const files = getSqlFiles();
    console.log('\nMigration status:');
    for (const f of files) {
      console.log(`  ${applied.has(f) ? '✓' : '○'} ${f}`);
    }

    console.log(`\nMigrations complete. Applied ${pending.length} migration(s).`);
  } finally {
    client.release();
  }
}

async function rollback() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Rollback is disabled in production.');
    process.exit(1);
  }

  const connectionString = await getConnectionString();
  const pool = new Pool({ connectionString });

  const sqlDir = path.join(__dirname, '..', 'database');
  const tables = fs.readdirSync(sqlDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .reverse()
    .map(f => f.replace(/^\d+_create_/, '').replace(/\.sql$/, ''));

async function status() {
  const client = await pool.connect();
  try {
    const tables = getSqlFiles()
      .reverse()
      .map(f => f.replace(/^\d+_create_/, '').replace(/\.sql$/, ''));
    for (const table of tables) {
      console.log(`Dropping: ${table}`);
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
    await client.query('DROP TABLE IF EXISTS schema_migrations CASCADE');
    console.log('Rollback complete.');
  } finally {
    client.release();
  }
}

const args = process.argv.slice(2);
const action = args.includes('--rollback') ? rollback
             : args.includes('--status')   ? status
             : migrate;

action().catch(err => {
  console.error(err.message);
  process.exit(1);
});
