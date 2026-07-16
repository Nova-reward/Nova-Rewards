# Field-Level Encryption

**Issue:** #651  
**Status:** Implemented  
**Area:** Security | **Priority:** P1-high

---

## Overview

Sensitive database fields are encrypted at rest using **AES-256-GCM** (authenticated encryption). Encryption and decryption happen transparently in the service layer — callers work with plaintext values.

---

## Sensitive Fields

| Table | Column | Classification | Storage |
|-------|--------|----------------|---------|
| `users` | `email` | PII | AES-256-GCM encrypted |
| `webhooks` | `secret` | Credential (HMAC signing key) | AES-256-GCM encrypted |
| `merchants` | `api_key` | Credential | SHA-256 hash (one-way, not reversible) |
| `merchant_api_keys` | `key_hash` | Credential | SHA-256 hash (one-way, not reversible) |
| `users` | `password_hash` | Credential | bcrypt hash (one-way, not reversible) |

> API keys and passwords are one-way hashed — they do not need to be decrypted at runtime, so reversible encryption is not appropriate for them.

---

## Encryption Scheme

- **Algorithm:** AES-256-GCM  
- **Key size:** 256 bits (32 bytes)  
- **IV:** 96-bit random IV generated per encryption operation  
- **Auth tag:** 128-bit GCM authentication tag (prevents tampering)

### Ciphertext format

Encrypted values are stored as a single **base64** string:

```
base64( IV[12 bytes] || AuthTag[16 bytes] || Ciphertext[N bytes] )
```

Minimum stored length: `ceil((12 + 16 + 1) / 3) * 4 = 40` base64 characters.

---

## Key Management

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FIELD_ENCRYPTION_KEY` | Yes | Active 256-bit key as 64-char hex string |
| `FIELD_ENCRYPTION_KEY_PREVIOUS` | During rotation only | Previous key for decrypting old rows |

### Generating a key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Production storage

Keys are **never stored in the database or committed to source control**. In production they are sourced from **AWS Secrets Manager** and injected as environment variables at container startup (see `infra/secrets.tf`).

---

## Key Rotation Procedure

Key rotation is a two-phase process with zero downtime.

### Phase 1 — Deploy new key alongside old key

1. Generate a new 64-char hex key.
2. In AWS Secrets Manager, update the secret to add `FIELD_ENCRYPTION_KEY_PREVIOUS` (set to the current key value) and update `FIELD_ENCRYPTION_KEY` to the new key.
3. Deploy the application. New writes use the new key; existing encrypted rows are still readable because `decrypt()` falls back to `FIELD_ENCRYPTION_KEY_PREVIOUS`.

### Phase 2 — Re-encrypt existing rows

4. Run the migration script against the production database:

```bash
FIELD_ENCRYPTION_KEY=<new-key> \
FIELD_ENCRYPTION_KEY_PREVIOUS=<old-key> \
DATABASE_URL=<prod-url> \
node novaRewards/scripts/encrypt-existing-rows.js --rotate
```

The script is **idempotent** — it detects already-rotated rows and skips them.

5. Verify row counts in the script output match expectations.

### Phase 3 — Remove old key

6. Once all rows are re-encrypted, remove `FIELD_ENCRYPTION_KEY_PREVIOUS` from Secrets Manager.
7. Deploy the application again (or restart pods) to pick up the updated secret.

---

## Implementation Details

### Core utility

`novaRewards/backend/lib/encryption.js`

- `encrypt(plaintext)` → base64 ciphertext blob  
- `decrypt(ciphertextBase64)` → plaintext (falls back to previous key during rotation)  
- `isEncrypted(value)` → boolean (used by migration script to detect already-encrypted rows)

### Prisma middleware

`novaRewards/backend/lib/prismaEncryptionMiddleware.js`

Intercepts Prisma `create`/`update`/`upsert` operations to encrypt configured fields before the query, and `find*` operations to decrypt after. The `ENCRYPTED_FIELDS` map controls which model fields are encrypted.

### Raw pg queries

For tables accessed via raw `pg` queries (users, webhooks), encryption/decryption is applied in the repository layer:

- `novaRewards/backend/db/userRepository.js` — `encryptEmail` / `decryptUserRow`
- `novaRewards/backend/db/webhookRepository.js` — `encryptWebhookSecret` / `decryptWebhookRow`
- `novaRewards/backend/routes/auth.js` — encrypts email on register/login before DB lookup

### Email uniqueness

Because AES-256-GCM uses a random IV, the same plaintext produces a different ciphertext each time. The `UNIQUE` index on `users.email` has been dropped (migration 019). Uniqueness is now enforced at the application layer: the auth route catches Postgres `23505` unique-violation errors, but the primary guard is the encrypted lookup — the same encrypted value is stored consistently per user because we always encrypt the normalized (lowercased, trimmed) email before lookup.

> **Note:** If you need to search users by email (e.g. admin lookup), encrypt the search term first using `encrypt(email.trim().toLowerCase())` and compare against the stored value. Wildcard/ILIKE searches on encrypted email are not possible — use the `first_name`, `last_name`, or `wallet_address` columns for search instead.

---

## Testing

Unit tests for the encryption utility:

```bash
cd novaRewards/backend
npx jest tests/encryption.test.js --runInBand
```

Integration tests covering the full encrypt-on-write / decrypt-on-read cycle are in:

- `novaRewards/backend/tests/auth.test.js` (email encryption through register/login)
- `novaRewards/backend/tests/security/security.test.js` (field-level encryption assertions)
