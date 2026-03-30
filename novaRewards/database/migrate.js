require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const files = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      console.log(`Running migration: ${file}`);
      await client.query(sql);
      console.log(`  Done.`);
    }
    console.log('All migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

async function rollback() {
  const files = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .reverse();

  // Derive table names from filenames: e.g. "001_create_merchants.sql" -> "merchants"
  const tables = files.map(f => f.replace(/^\d+_create_/, '').replace(/\.sql$/, ''));

  const client = await pool.connect();
  try {
    for (const table of tables) {
      console.log(`Dropping table: ${table}`);
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`  Done.`);
    }
    console.log('Rollback complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

const isRollback = process.argv.includes('--rollback');

(isRollback ? rollback() : migrate()).catch((err) => {
  console.error(`${isRollback ? 'Rollback' : 'Migration'} failed:`, err.message);
  process.exit(1);
});
