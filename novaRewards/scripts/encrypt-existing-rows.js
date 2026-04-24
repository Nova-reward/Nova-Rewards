#!/usr/bin/env node
/**
 * One-time migration script: encrypt existing plaintext sensitive fields.
 *
 * Run AFTER applying migration 019_field_level_encryption.sql and setting
 * FIELD_ENCRYPTION_KEY in the environment.
 *
 * Safe to run multiple times — already-encrypted values are detected via
 * isEncrypted() and skipped.
 *
 * Usage:
 *   FIELD_ENCRYPTION_KEY=<64-char-hex> node scripts/encrypt-existing-rows.js
 *
 * For key rotation (re-encrypt with new key):
 *   FIELD_ENCRYPTION_KEY=<new-key> FIELD_ENCRYPTION_KEY_PREVIOUS=<old-key> \
 *     node scripts/encrypt-existing-rows.js --rotate
 *
 * Requirements: #651
 */

'use strict';

require('dotenv').config();

const { Pool }       = require('pg');
const { encrypt, decrypt, isEncrypted } = require('../backend/lib/encryption');

const ROTATE = process.argv.includes('--rotate');
const pool   = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log(`[encrypt-existing-rows] Starting. rotate=${ROTATE}`);

    // -----------------------------------------------------------------------
    // 1. users.email
    // -----------------------------------------------------------------------
    const { rows: users } = await client.query(
      `SELECT id, email FROM users WHERE email IS NOT NULL`
    );

    let userUpdated = 0;
    for (const user of users) {
      const alreadyEncrypted = isEncrypted(user.email);

      if (!alreadyEncrypted) {
        // Plaintext — encrypt it
        const encryptedEmail = encrypt(user.email.trim().toLowerCase());
        await client.query(`UPDATE users SET email = $1 WHERE id = $2`, [encryptedEmail, user.id]);
        userUpdated++;
      } else if (ROTATE) {
        // Already encrypted with old key — decrypt then re-encrypt with new key
        const plaintext      = decrypt(user.email);   // uses FIELD_ENCRYPTION_KEY_PREVIOUS fallback
        const reEncrypted    = encrypt(plaintext);     // uses new FIELD_ENCRYPTION_KEY
        await client.query(`UPDATE users SET email = $1 WHERE id = $2`, [reEncrypted, user.id]);
        userUpdated++;
      }
    }
    console.log(`[encrypt-existing-rows] users.email: ${userUpdated}/${users.length} rows updated`);

    // -----------------------------------------------------------------------
    // 2. webhooks.secret
    // -----------------------------------------------------------------------
    const { rows: webhooks } = await client.query(
      `SELECT id, secret FROM webhooks WHERE secret IS NOT NULL`
    );

    let webhookUpdated = 0;
    for (const webhook of webhooks) {
      const alreadyEncrypted = isEncrypted(webhook.secret);

      if (!alreadyEncrypted) {
        const encryptedSecret = encrypt(webhook.secret);
        await client.query(`UPDATE webhooks SET secret = $1 WHERE id = $2`, [encryptedSecret, webhook.id]);
        webhookUpdated++;
      } else if (ROTATE) {
        const plaintext   = decrypt(webhook.secret);
        const reEncrypted = encrypt(plaintext);
        await client.query(`UPDATE webhooks SET secret = $1 WHERE id = $2`, [reEncrypted, webhook.id]);
        webhookUpdated++;
      }
    }
    console.log(`[encrypt-existing-rows] webhooks.secret: ${webhookUpdated}/${webhooks.length} rows updated`);

    console.log('[encrypt-existing-rows] Done.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('[encrypt-existing-rows] Fatal error:', err);
  process.exit(1);
});
