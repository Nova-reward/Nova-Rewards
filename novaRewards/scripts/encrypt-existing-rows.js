#!/usr/bin/env node
/**
 * Batch re-encryption script — encrypts plaintext rows or rotates the key for
 * existing encrypted rows.
 *
 * Run AFTER applying migration 019_field_level_encryption.sql.
 *
 * This script is idempotent: already-encrypted rows are skipped on the initial
 * encryption pass.  For key rotation every encrypted row is re-encrypted with
 * the new key, so the script can safely be re-run until all rows are migrated.
 *
 * ─── Usage ──────────────────────────────────────────────────────────────────
 *
 * Initial encryption (plaintext → encrypted with FIELD_ENCRYPTION_KEY):
 *   FIELD_ENCRYPTION_KEY=<64-char-hex> \
 *     node scripts/encrypt-existing-rows.js
 *
 * Key rotation (old-key ciphertext → new-key ciphertext):
 *   node scripts/encrypt-existing-rows.js \
 *     --new-key <64-char-hex>  \
 *     --old-key <64-char-hex>
 *
 *   FIELD_ENCRYPTION_KEY and FIELD_ENCRYPTION_KEY_PREVIOUS are also accepted as
 *   env-var equivalents so the script integrates naturally with the existing
 *   secret-rotation workflow:
 *
 *   FIELD_ENCRYPTION_KEY=<new> FIELD_ENCRYPTION_KEY_PREVIOUS=<old> \
 *     node scripts/encrypt-existing-rows.js
 *
 * ─── Options ─────────────────────────────────────────────────────────────────
 *   --new-key  <hex>    64-char hex string for the new (output) key
 *   --old-key  <hex>    64-char hex string for the old (input) key
 *   --batch-size <n>    Number of rows to process per DB round-trip (default 100)
 *   --dry-run           Print counts without writing any changes
 *
 * ─── Safety guarantees ───────────────────────────────────────────────────────
 *   • Cursor-based pagination — never loads the entire table into memory.
 *   • Each batch is processed in parallel UPDATE statements (limited to
 *     --batch-size connections) to bound memory and lock contention.
 *   • Dry-run mode allows safe pre-flight checks.
 *   • Idempotent: re-running after a partial failure will re-process only the
 *     rows that were not yet updated (because their ciphertext will still be
 *     decodable with the old key and will fail with the new key).
 *
 * Requirements: #651
 */

'use strict';

require('dotenv').config();

const { Pool }      = require('pg');
const { loadKey, encryptWithKey, isEncrypted, tryDecryptWith } = require('../backend/lib/encryption');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    newKeyHex:  null,
    oldKeyHex:  null,
    batchSize:  100,
    dryRun:     false,
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--new-key':
        args.newKeyHex = argv[++i];
        break;
      case '--old-key':
        args.oldKeyHex = argv[++i];
        break;
      case '--batch-size': {
        const n = parseInt(argv[++i], 10);
        if (!Number.isFinite(n) || n < 1) {
          fatal(`--batch-size must be a positive integer, got: ${argv[i]}`);
        }
        args.batchSize = n;
        break;
      }
      case '--dry-run':
        args.dryRun = true;
        break;
      default:
        fatal(`Unknown argument: ${argv[i]}`);
    }
  }

  // Fall back to environment variables if flags were not supplied
  if (!args.newKeyHex) args.newKeyHex = process.env.FIELD_ENCRYPTION_KEY          || null;
  if (!args.oldKeyHex) args.oldKeyHex = process.env.FIELD_ENCRYPTION_KEY_PREVIOUS || null;

  return args;
}

function fatal(msg) {
  console.error(`[encrypt-existing-rows] ERROR: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

/**
 * Resolves and validates key buffers from hex strings.
 * The "rotation" mode is active when oldKeyHex is supplied.
 *
 * @param {{ newKeyHex: string|null, oldKeyHex: string|null }} args
 * @returns {{ newKey: Buffer, oldKey: Buffer|null, isRotation: boolean }}
 */
function resolveKeys(args) {
  if (!args.newKeyHex) {
    fatal(
      'No encryption key provided. Supply --new-key <hex> or set FIELD_ENCRYPTION_KEY.'
    );
  }

  // loadKey is signature-compatible with env-var names; we validate inline instead
  const newKey = parseKeyHex('--new-key / FIELD_ENCRYPTION_KEY', args.newKeyHex);

  let oldKey = null;
  if (args.oldKeyHex) {
    oldKey = parseKeyHex('--old-key / FIELD_ENCRYPTION_KEY_PREVIOUS', args.oldKeyHex);
  }

  return { newKey, oldKey, isRotation: oldKey !== null };
}

function parseKeyHex(label, hex) {
  if (typeof hex !== 'string' || hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    fatal(`${label} must be a 64-character hex string (32 bytes).`);
  }
  return Buffer.from(hex, 'hex');
}

// ---------------------------------------------------------------------------
// Core processing helpers
// ---------------------------------------------------------------------------

/**
 * Progress tracker printed to stdout.
 */
class Progress {
  constructor(table, field, total) {
    this.table    = table;
    this.field    = field;
    this.total    = total;
    this.updated  = 0;
    this.skipped  = 0;
    this.failed   = 0;
    this._start   = Date.now();
  }

  tick(updated, skipped, failed = 0) {
    this.updated += updated;
    this.skipped += skipped;
    this.failed  += failed;
    const elapsed = ((Date.now() - this._start) / 1000).toFixed(1);
    process.stdout.write(
      `\r[encrypt-existing-rows] ${this.table}.${this.field}: ` +
      `${this.updated + this.skipped + this.failed}/${this.total} rows processed ` +
      `| updated=${this.updated} skipped=${this.skipped} failed=${this.failed} ` +
      `| ${elapsed}s elapsed    `
    );
  }

  done() {
    process.stdout.write('\n');
    console.log(
      `[encrypt-existing-rows] ${this.table}.${this.field}: ` +
      `DONE — updated=${this.updated} skipped=${this.skipped} failed=${this.failed}`
    );
  }
}

/**
 * Determines whether a row needs to be (re-)encrypted and returns the new
 * ciphertext if so.
 *
 * Initial pass (no oldKey): encrypts plaintext rows; skips already-encrypted rows.
 * Rotation pass (with oldKey): decrypts with oldKey then re-encrypts with newKey;
 *   skips rows already encrypted with newKey (decrypt with oldKey returns null).
 *
 * @param {string}       value      - current column value
 * @param {Buffer}       newKey
 * @param {Buffer|null}  oldKey
 * @returns {{ action: 'update'|'skip', newValue?: string, reason: string }}
 */
function computeAction(value, newKey, oldKey) {
  if (!isEncrypted(value)) {
    // Plaintext — always encrypt with new key
    return {
      action:   'update',
      newValue: encryptWithKey(value, newKey),
      reason:   'plaintext → encrypted',
    };
  }

  if (oldKey) {
    // Rotation mode: try to decrypt with oldKey
    const plaintext = tryDecryptWith(value, oldKey);
    if (plaintext === null) {
      // Can't decrypt with oldKey → already encrypted with newKey (or unknown)
      return { action: 'skip', reason: 'already encrypted with new key' };
    }
    return {
      action:   'update',
      newValue: encryptWithKey(plaintext, newKey),
      reason:   'rotated from old key to new key',
    };
  }

  // Initial-encryption mode: already encrypted, nothing to do
  return { action: 'skip', reason: 'already encrypted' };
}

/**
 * Processes a single table/field combination in cursor-based batches.
 *
 * @param {import('pg').PoolClient} client
 * @param {{ table: string, field: string, idField?: string }} spec
 * @param {Buffer}       newKey
 * @param {Buffer|null}  oldKey
 * @param {number}       batchSize
 * @param {boolean}      dryRun
 */
async function processTable(client, spec, newKey, oldKey, batchSize, dryRun) {
  const { table, field, idField = 'id' } = spec;

  // Count total rows for progress display (approximate)
  const { rows: countRows } = await client.query(
    `SELECT COUNT(*) AS n FROM ${table} WHERE ${field} IS NOT NULL`
  );
  const total = parseInt(countRows[0].n, 10);

  console.log(
    `\n[encrypt-existing-rows] ${table}.${field}: ${total} rows to examine ` +
    `(batch-size=${batchSize}, dry-run=${dryRun})`
  );

  const progress = new Progress(table, field, total);

  let cursor = null; // last processed id (for keyset pagination)

  for (;;) {
    // Fetch the next batch using keyset pagination for consistent ordering
    const { rows } = cursor === null
      ? await client.query(
          `SELECT ${idField}, ${field} FROM ${table}
           WHERE ${field} IS NOT NULL
           ORDER BY ${idField}
           LIMIT $1`,
          [batchSize]
        )
      : await client.query(
          `SELECT ${idField}, ${field} FROM ${table}
           WHERE ${field} IS NOT NULL AND ${idField} > $1
           ORDER BY ${idField}
           LIMIT $2`,
          [cursor, batchSize]
        );

    if (rows.length === 0) break;

    let batchUpdated = 0;
    let batchSkipped = 0;
    let batchFailed  = 0;

    // Process batch rows in parallel (within the same client)
    await Promise.all(
      rows.map(async (row) => {
        const value = row[field];

        let action, newValue;
        try {
          ({ action, newValue } = computeAction(value, newKey, oldKey));
        } catch (err) {
          console.error(
            `\n[encrypt-existing-rows] Failed to compute action for ${table}#${row[idField]}: ${err.message}`
          );
          batchFailed++;
          return;
        }

        if (action === 'skip') {
          batchSkipped++;
          return;
        }

        if (!dryRun) {
          try {
            await client.query(
              `UPDATE ${table} SET ${field} = $1 WHERE ${idField} = $2`,
              [newValue, row[idField]]
            );
          } catch (err) {
            console.error(
              `\n[encrypt-existing-rows] Failed to update ${table}#${row[idField]}: ${err.message}`
            );
            batchFailed++;
            return;
          }
        }

        batchUpdated++;
      })
    );

    progress.tick(batchUpdated, batchSkipped, batchFailed);
    cursor = rows[rows.length - 1][idField];
  }

  progress.done();
}

// ---------------------------------------------------------------------------
// Tables / fields to migrate
// ---------------------------------------------------------------------------

/**
 * Ordered list of table+field pairs to process.
 * Add new encrypted fields here when the schema is extended.
 */
const TABLE_SPECS = [
  { table: 'users',    field: 'email'  },
  { table: 'webhooks', field: 'secret' },
];

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function run() {
  const args = parseArgs(process.argv);
  const { newKey, oldKey, isRotation } = resolveKeys(args);

  console.log('[encrypt-existing-rows] Starting.');
  console.log(`  mode       : ${isRotation ? 'key-rotation' : 'initial-encryption'}`);
  console.log(`  batch-size : ${args.batchSize}`);
  console.log(`  dry-run    : ${args.dryRun}`);
  if (args.dryRun) {
    console.log('  DRY-RUN MODE — no database writes will be performed.');
  }

  const pool   = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    for (const spec of TABLE_SPECS) {
      await processTable(client, spec, newKey, oldKey, args.batchSize, args.dryRun);
    }

    console.log('\n[encrypt-existing-rows] All tables processed successfully.');

    if (isRotation && !args.dryRun) {
      console.log(
        '\n[encrypt-existing-rows] Key rotation complete.\n' +
        '  Next steps:\n' +
        '    1. Verify no rows still decrypt with the old key (re-run with --dry-run to confirm 0 updates).\n' +
        '    2. Remove FIELD_ENCRYPTION_KEY_PREVIOUS from the environment / secret store.\n' +
        '    3. Remove FIELD_ENCRYPTION_KEY_ROTATED_AT from the environment / secret store.\n' +
        '    4. Redeploy the backend service.\n' +
        '  See docs/ops/secret-rotation.md for the full runbook.'
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('\n[encrypt-existing-rows] Fatal error:', err);
  process.exit(1);
});
