/**
 * Nova Rewards — migration runner with version tracking, down migrations, and safety checks.
 *
 * Convention:
 *   database/NNNN_description.up.sql
 *   database/NNNN_description.down.sql
 *
 * Tracking:
 *   schema_migrations table stores applied migration `id` (filename base).
 *
 * Usage:
 *   node database/migrate.js            # apply pending up migrations with safety checks
 *   node database/migrate.js --rollback # revert the most recently applied migration
 *   node database/migrate.js --status   # list applied migrations
 *   node database/migrate.js --force    # skip safety checks (dangerous!)
 *   node database/migrate.js --audit    # analyze migrations for unsafe patterns
 */

require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'database');
const MIGRATIONS_TABLE = 'schema_migrations';

// Enhanced: Unsafe patterns detection
const UNSAFE_PATTERNS = {
  // CREATE INDEX without CONCURRENTLY
  CREATE_INDEX_NON_CONCURRENT: {
    pattern: /CREATE\s+(?:UNIQUE\s+)?INDEX(?!\s+CONCURRENTLY)/i,
    severity: 'HIGH',
    description: 'CREATE INDEX without CONCURRENTLY acquires ACCESS EXCLUSIVE lock',
    recommendation: 'Use CREATE INDEX CONCURRENTLY to allow concurrent reads/writes'
  },
  
  // ALTER TABLE ADD COLUMN with DEFAULT
  ADD_COLUMN_WITH_DEFAULT: {
    pattern: /ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN\s+.*DEFAULT/i,
    severity: 'CRITICAL',
    description: 'ADD COLUMN with DEFAULT triggers table rewrite',
    recommendation: 'Use three-phase migration: ADD COLUMN (nullable) → backfill → SET NOT NULL'
  },
  
  // ALTER COLUMN TYPE
  ALTER_COLUMN_TYPE: {
    pattern: /ALTER\s+TABLE\s+\w+\s+ALTER\s+COLUMN\s+\w+\s+TYPE/i,
    severity: 'CRITICAL', 
    description: 'ALTER COLUMN TYPE causes complete table rewrite',
    recommendation: 'Use new column approach: ADD COLUMN → migrate data → DROP old column'
  },
  
  // REINDEX
  REINDEX: {
    pattern: /REINDEX\s+(INDEX|TABLE|DATABASE)/i,
    severity: 'CRITICAL',
    description: 'REINDEX acquires ACCESS EXCLUSIVE lock',
    recommendation: 'Drop and CREATE INDEX CONCURRENTLY instead'
  },
  
  // LOCK TABLE
  EXPLICIT_LOCK: {
    pattern: /LOCK\s+TABLE\s+.*IN\s+.*MODE/i,
    severity: 'HIGH',
    description: 'Explicit table locking can block concurrent operations',
    recommendation: 'Avoid explicit locking, rely on PostgreSQL automatic locking'
  }
};

// Critical tables that require extra caution
const CRITICAL_TABLES = [
  'users', 'transactions', 'point_transactions', 'campaigns', 
  'merchants', 'audit_logs', 'user_balance'
];

function sqlFilenameBase(file) {
  // For: 001_create_merchants.up.sql -> 001_create_merchants
  // For: 001_create_merchants.down.sql -> 001_create_merchants
  return file.replace(/\.(up|down)\.sql$/i, '');
}

/**
 * Enhanced: Analyze SQL content for unsafe patterns
 */
function analyzeMigrationSafety(migrationId, sqlContent) {
  const warnings = [];
  const lines = sqlContent.split('\n');
  
  for (const [patternName, config] of Object.entries(UNSAFE_PATTERNS)) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (config.pattern.test(line)) {
        // Check if this affects a critical table
        const affectsCriticalTable = CRITICAL_TABLES.some(table => 
          new RegExp(`\\b${table}\\b`, 'i').test(line)
        );
        
        warnings.push({
          migration: migrationId,
          line: i + 1,
          pattern: patternName,
          severity: affectsCriticalTable ? 'CRITICAL' : config.severity,
          content: line.trim(),
          description: config.description,
          recommendation: config.recommendation,
          criticalTable: affectsCriticalTable
        });
      }
    }
  }
  
  return warnings;
}

/**
 * Enhanced: Display safety analysis for all migrations
 */
function displaySafetyWarnings(warnings) {
  if (warnings.length === 0) {
    console.log('✅ No unsafe patterns detected in pending migrations.');
    return true;
  }

  console.log('\n⚠️  UNSAFE MIGRATION PATTERNS DETECTED:');
  console.log('═'.repeat(70));

  const groupedWarnings = warnings.reduce((acc, warning) => {
    if (!acc[warning.migration]) acc[warning.migration] = [];
    acc[warning.migration].push(warning);
    return acc;
  }, {});

  let hasCritical = false;

  for (const [migration, migrationWarnings] of Object.entries(groupedWarnings)) {
    console.log(`\n📁 ${migration}:`);
    
    for (const warning of migrationWarnings) {
      const severityIcon = warning.severity === 'CRITICAL' ? '🔴' : 
                          warning.severity === 'HIGH' ? '🟠' : '🟡';
      
      console.log(`  ${severityIcon} Line ${warning.line}: ${warning.pattern}`);
      console.log(`     Code: ${warning.content}`);
      console.log(`     Risk: ${warning.description}`);
      console.log(`     Fix:  ${warning.recommendation}`);
      
      if (warning.criticalTable) {
        console.log(`     ⚡ AFFECTS CRITICAL TABLE`);
      }
      
      if (warning.severity === 'CRITICAL') {
        hasCritical = true;
      }
      console.log();
    }
  }

  console.log('═'.repeat(70));
  console.log(`Found ${warnings.length} unsafe pattern(s) in ${Object.keys(groupedWarnings).length} migration(s)`);
  
  if (hasCritical) {
    console.log('🔴 CRITICAL issues detected - these WILL cause production downtime');
  }
  
  console.log('\nTo proceed anyway, use --force (NOT recommended for production)');
  
  return false;
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

/**
 * Enhanced: Audit all migrations for unsafe patterns
 */
async function auditMigrations() {
  console.log('🔍 Auditing all migrations for unsafe patterns...\n');
  
  const migrations = getMigrationFiles();
  const allWarnings = [];
  
  for (const migration of migrations) {
    const fullPath = path.join(MIGRATIONS_DIR, migration.up);
    if (fs.existsSync(fullPath)) {
      const sqlContent = fs.readFileSync(fullPath, 'utf8');
      const warnings = analyzeMigrationSafety(migration.id, sqlContent);
      allWarnings.push(...warnings);
    }
  }
  
  displaySafetyWarnings(allWarnings);
  
  // Summary statistics
  console.log('\n📊 AUDIT SUMMARY:');
  const criticalCount = allWarnings.filter(w => w.severity === 'CRITICAL').length;
  const highCount = allWarnings.filter(w => w.severity === 'HIGH').length;
  const mediumCount = allWarnings.filter(w => w.severity === 'MEDIUM').length;
  
  console.log(`   🔴 Critical: ${criticalCount} (will cause downtime)`);
  console.log(`   🟠 High:     ${highCount} (significant risk)`); 
  console.log(`   🟡 Medium:   ${mediumCount} (minor risk)`);
  console.log(`   📁 Total migrations: ${migrations.length}`);
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

    // Enhanced: Safety check for pending migrations
    const forceMode = process.argv.includes('--force');
    
    if (!forceMode) {
      console.log(`🔍 Analyzing ${pending.length} pending migration(s) for safety...`);
      
      const allWarnings = [];
      for (const migration of pending) {
        const fullPath = path.join(MIGRATIONS_DIR, migration.up);
        const sqlContent = fs.readFileSync(fullPath, 'utf8');
        const warnings = analyzeMigrationSafety(migration.id, sqlContent);
        allWarnings.push(...warnings);
      }
      
      if (!displaySafetyWarnings(allWarnings)) {
        console.log('\n❌ Migration aborted due to safety concerns.');
        console.log('Review the warnings above and use safe migration patterns.');
        return;
      }
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

// Enhanced: Command line argument parsing
const args = process.argv.slice(2);
const action = args.includes('--rollback')
  ? rollbackLast
  : args.includes('--status')
    ? status
    : args.includes('--audit')
      ? auditMigrations
      : migrateUp;

action().catch((err) => {
  console.error(err);
  process.exit(1);
});

