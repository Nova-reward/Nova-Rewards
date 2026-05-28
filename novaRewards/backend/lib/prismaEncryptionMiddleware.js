/**
 * Prisma middleware for transparent field-level encryption.
 *
 * Encrypts configured fields before writes (create / update / upsert)
 * and decrypts them after reads (findUnique / findFirst / findMany / etc.).
 *
 * Usage:
 *   const prisma = new PrismaClient();
 *   prisma.$use(encryptionMiddleware);
 *
 * Requirements: #651
 */

'use strict';

const { encrypt, decrypt } = require('./encryption');

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
};

// ---------------------------------------------------------------------------
// Write-path helpers
// ---------------------------------------------------------------------------

/**
 * Encrypts all configured fields present in a data object for the given model.
 * Mutates the object in place and returns it.
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
          // Determine the related model name from the field key (best-effort)
          // For now we only have one encrypted model so this is straightforward
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
 * Decrypts all configured fields present in a result object for the given model.
 * Mutates the object in place and returns it.
 */
function decryptFields(model, record) {
  if (!record || typeof record !== 'object') return record;
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields) return record;

  for (const field of fields) {
    if (field in record && record[field] !== null && record[field] !== undefined) {
      record[field] = decrypt(record[field]);
    }
  }
  return record;
}

/**
 * Decrypts fields in a result (single record or array).
 */
function decryptResult(model, result) {
  if (!result) return result;
  if (Array.isArray(result)) {
    return result.map((r) => decryptFields(model, r));
  }
  return decryptFields(model, result);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Prisma middleware that transparently encrypts/decrypts configured fields.
 *
 * @param {import('@prisma/client').MiddlewareParams} params
 * @param {Function} next
 */
async function encryptionMiddleware(params, next) {
  const model = params.model ? params.model.toLowerCase() : null;

  // --- Write path ---
  if (['create', 'update', 'upsert', 'createMany', 'updateMany'].includes(params.action)) {
    if (model && ENCRYPTED_FIELDS[model]) {
      encryptWriteArgs(model, params.args);
    }
  }

  const result = await next(params);

  // --- Read path ---
  if (model && ENCRYPTED_FIELDS[model]) {
    return decryptResult(model, result);
  }

  return result;
}

module.exports = { encryptionMiddleware, ENCRYPTED_FIELDS };
