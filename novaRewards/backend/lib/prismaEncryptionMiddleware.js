/**
 * Prisma middleware for transparent field-level encryption.
 *
 * Encrypts configured fields before writes (create / update / upsert)
 * and decrypts them after reads (findUnique / findFirst / findMany / etc.).
 *
 * Dual-key rotation support
 * ─────────────────────────
 * During a key rotation the middleware automatically re-encrypts any row that
 * was decrypted with the previous (fallback) key.  This means:
 *
 *   1. The read succeeds — the caller receives the plaintext as normal.
 *   2. In the background the row is patched with a fresh ciphertext produced
 *      by the current primary key, so the old key is no longer needed for
 *      that row.
 *   3. A deprecation warning is logged when the rotation window has elapsed
 *      (controlled by KEY_ROTATION_WINDOW_DAYS, default 7 days).
 *
 * The re-encryption update is fire-and-forget.  A failure is logged but never
 * propagated to the caller — reads must remain resilient to a secondary write
 * failure (e.g. a read-replica hit, or a transient DB error).
 *
 * Usage:
 *   const prisma = new PrismaClient();
 *   prisma.$use(encryptionMiddleware);
 *
 * Requirements: #651
 */

'use strict';

const { encrypt, decryptWithKeyInfo } = require('./encryption');

/**
 * Map of Prisma model name → array of field names to encrypt.
 *
 * Only fields that need to be decryptable at runtime should be listed here.
 * Fields that are only ever compared as hashes (e.g. api_key / key_hash)
 * should remain as SHA-256 hashes — they do NOT need reversible encryption.
 */
const ENCRYPTED_FIELDS = {
  // webhooks.secret is used at runtime to sign HMAC payloads → must be decryptable
  webhooks: ['secret'],
  // users.email is PII encrypted per migration 019_field_level_encryption.sql
  users: ['email'],
};

// ---------------------------------------------------------------------------
// Write-path helpers
// ---------------------------------------------------------------------------

/**
 * Encrypts all configured fields present in a data object for the given model.
 * Mutates the object in place and returns it.
 *
 * @param {string} model
 * @param {object} data
 * @returns {object}
 */
function encryptFields(model, data) {
  if (!data || typeof data !== 'object') return data;
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields) return data;

  for (const field of fields) {
    if (field in data && data[field] !== null && data[field] !== undefined) {
      data[field] = encrypt(String(data[field]));
    }
  }
  return data;
}

/**
 * Recursively encrypts fields in nested write operations
 * (create / update / upsert / connectOrCreate).
 *
 * @param {string} model
 * @param {object} args
 * @returns {object}
 */
function encryptWriteArgs(model, args) {
  if (!args) return args;

  if (args.data) encryptFields(model, args.data);

  // Handle nested writes for related models
  for (const [key, value] of Object.entries(args.data || {})) {
    if (value && typeof value === 'object') {
      // Prisma nested write shapes: { create: {}, update: {}, upsert: {} }
      for (const op of ['create', 'update', 'upsert', 'connectOrCreate']) {
        if (value[op]) {
          encryptFields(key, value[op].data || value[op]);
        }
      }
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Read-path helpers
// ---------------------------------------------------------------------------

/**
 * Result of decrypting a single record's encrypted fields.
 *
 * @typedef {Object} DecryptResult
 * @property {object}   record        - the record with plaintext values filled in
 * @property {boolean}  needsRekey    - true if any field was decrypted with the fallback key
 * @property {object}   rekeyValues   - map of fieldName → fresh ciphertext (primary key) for re-keying
 */

/**
 * Decrypts all configured fields in a single record.
 * Returns an augmented result that indicates whether a re-encryption is needed.
 *
 * @param {string} model
 * @param {object} record
 * @returns {DecryptResult}
 */
function decryptRecord(model, record) {
  if (!record || typeof record !== 'object') {
    return { record, needsRekey: false, rekeyValues: {} };
  }

  const fields = ENCRYPTED_FIELDS[model];
  if (!fields) return { record, needsRekey: false, rekeyValues: {} };

  let needsRekey = false;
  const rekeyValues = {};

  for (const field of fields) {
    if (field in record && record[field] !== null && record[field] !== undefined) {
      const { plaintext, usedFallbackKey } = decryptWithKeyInfo(record[field]);
      record[field] = plaintext;

      if (usedFallbackKey) {
        needsRekey = true;
        // Pre-compute the new ciphertext now (with the primary key)
        rekeyValues[field] = encrypt(plaintext);
      }
    }
  }

  return { record, needsRekey, rekeyValues };
}

/**
 * Decrypts fields in a result (single record or array) and collects any
 * records that need silent re-encryption.
 *
 * @param {string} model
 * @param {object|object[]} result
 * @returns {{ result: object|object[], toRekey: Array<{id: *, values: object}> }}
 */
function decryptResult(model, result) {
  if (!result) return { result, toRekey: [] };

  const toRekey = [];

  if (Array.isArray(result)) {
    result.forEach((record) => {
      const { needsRekey, rekeyValues } = decryptRecord(model, record);
      if (needsRekey && record.id !== undefined) {
        toRekey.push({ id: record.id, values: rekeyValues });
      }
    });
    return { result, toRekey };
  }

  const { needsRekey, rekeyValues } = decryptRecord(model, result);
  if (needsRekey && result.id !== undefined) {
    toRekey.push({ id: result.id, values: rekeyValues });
  }
  return { result, toRekey };
}

/**
 * Converts a Prisma model name (PascalCase, e.g. 'Webhooks') to the
 * Prisma client accessor key (camelCase, e.g. 'webhooks').
 *
 * @param {string} modelName
 * @returns {string}
 */
function _modelToClientKey(modelName) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

/**
 * Performs background re-encryption updates for records that were read with
 * the fallback (previous) key.  Fire-and-forget: errors are logged but never
 * thrown so that the caller's read path is unaffected.
 *
 * @param {import('@prisma/client').PrismaClient} prismaClient
 * @param {string} modelName  - original Prisma model name (PascalCase from params.model)
 * @param {Array<{id: *, values: object}>} toRekey
 */
function _scheduleRekey(prismaClient, modelName, toRekey) {
  if (!toRekey.length) return;

  const clientKey = _modelToClientKey(modelName);
  const modelAccessor = prismaClient[clientKey];

  if (!modelAccessor) {
    console.error(
      `[encryption] Cannot re-encrypt: Prisma client has no accessor for model "${modelName}" (tried "${clientKey}").`
    );
    return;
  }

  // Run asynchronously — do not await so the read path is never delayed
  Promise.allSettled(
    toRekey.map(({ id, values }) =>
      modelAccessor.update({
        where: { id },
        data: values,
      })
    )
  ).then((results) => {
    results.forEach((outcome, idx) => {
      if (outcome.status === 'rejected') {
        console.error(
          `[encryption] Failed to re-encrypt ${modelName}#${toRekey[idx].id} during key rotation:`,
          outcome.reason
        );
      } else {
        // Optional: uncomment for verbose rotation progress
        // console.debug(`[encryption] Re-keyed ${modelName}#${toRekey[idx].id}`);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Creates a Prisma middleware that transparently encrypts/decrypts configured
 * fields and performs silent re-encryption when a row was read with the
 * previous (fallback) key during key rotation.
 *
 * Pass the PrismaClient instance so that the middleware can issue UPDATE
 * queries for re-keying.
 *
 * @param {import('@prisma/client').PrismaClient} prismaClient
 * @returns {import('@prisma/client').Middleware}
 */
function createEncryptionMiddleware(prismaClient) {
  /**
   * @param {import('@prisma/client').MiddlewareParams} params
   * @param {Function} next
   */
  return async function encryptionMiddleware(params, next) {
    const model = params.model ? params.model.toLowerCase() : null;

    // --- Write path ---
    if (['create', 'update', 'upsert', 'createMany', 'updateMany'].includes(params.action)) {
      if (model && ENCRYPTED_FIELDS[model]) {
        encryptWriteArgs(model, params.args);
      }
    }

    const raw = await next(params);

    // --- Read path ---
    if (model && ENCRYPTED_FIELDS[model]) {
      const { result, toRekey } = decryptResult(model, raw);

      // Transparently re-encrypt rows that were read using the fallback key.
      // The original Prisma model name is preserved in params.model for the
      // update call (Prisma is case-sensitive on model names).
      if (toRekey.length) {
        _scheduleRekey(prismaClient, params.model, toRekey);
      }

      return result;
    }

    return raw;
  };
}

/**
 * Legacy single-instance middleware for callers that do not need the re-key
 * callback.  Prefer createEncryptionMiddleware(prismaClient) for full
 * dual-key rotation support.
 *
 * @deprecated Use createEncryptionMiddleware(prismaClient) instead.
 * @param {import('@prisma/client').MiddlewareParams} params
 * @param {Function} next
 */
async function encryptionMiddleware(params, next) {
  const model = params.model ? params.model.toLowerCase() : null;

  if (['create', 'update', 'upsert', 'createMany', 'updateMany'].includes(params.action)) {
    if (model && ENCRYPTED_FIELDS[model]) {
      encryptWriteArgs(model, params.args);
    }
  }

  const raw = await next(params);

  if (model && ENCRYPTED_FIELDS[model]) {
    const { result } = decryptResult(model, raw);
    return result;
  }

  return raw;
}

module.exports = {
  encryptionMiddleware,       // legacy — no re-key support
  createEncryptionMiddleware, // preferred — full dual-key rotation support
  ENCRYPTED_FIELDS,
  // exported for testing:
  encryptFields,
  decryptRecord,
  decryptResult,
};
