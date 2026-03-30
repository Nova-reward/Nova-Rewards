/**
 * Nova Rewards — database migration runner
 *
 * In production: fetches nova_migrate credentials from AWS Secrets Manager.
 * In development: falls back to DATABASE_MIGRATE_URL or DATABASE_URL env vars.
 *
 * Usage:
 *   node migrate.js              # run all pending migrations
 *   node migrate.js --rollback   # drop all tables (dev only)
 */

require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

async function getConnectionString() {
  const secretArn = process.env.DB_MIGRATE_SECRET_ARN;

  if (secretArn) {
    // Production: pull credentials from Secrets Manager
    const { SecretsManagerClient, GetSecretValueCommand } =
      await import('@aws-sdk/client-secrets-manager');

    const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const { SecretString } = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
    const { username, password, host, port, dbname } = JSON.parse(SecretString);
    return `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbname}`;
  }

  // Development fallback
  return process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL;
}

async function migrate() {
  const connectionString = await getConnectionString();
  const pool = new Pool({ connectionString, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false });

  const sqlDir = path.join(__dirname, '..', 'database');
  const files  = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort();

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8');
      console.log(`Running migration: ${file}`);
      await client.query(sql);
      console.log(`  ✓ Done`);
    }
    console.log('All migrations complete.');
  } finally {
    client.release();
    await pool.end();
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

  const client = await pool.connect();
  try {
    for (const table of tables) {
      console.log(`Dropping table: ${table}`);
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
    console.log('Rollback complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

const isRollback = process.argv.includes('--rollback');
(isRollback ? rollback() : migrate()).catch(err => {
  console.error(`${isRollback ? 'Rollback' : 'Migration'} failed:`, err.message);
  process.exit(1);
});
