# ADR 0013: AES-256-GCM Field-Level Encryption for PII

## Status

Accepted

## Context

Nova Rewards stores personally identifiable information (PII) — user email
addresses and merchant webhook secrets — in PostgreSQL. A database breach or
misconfigured backup would expose this data in plaintext. Regulatory frameworks
(GDPR, CCPA) and security best practices require that sensitive fields be
protected at rest beyond full-disk encryption.

Considered options:

1. **Full-disk / tablespace encryption only** — provided by RDS at-rest
   encryption (AES-256), but does not protect against application-level
   vulnerabilities or compromised database credentials.
2. **PostgreSQL `pgcrypto` extension** — encryption at the database layer;
   requires the encryption key to be passed in SQL queries, which exposes it in
   query logs and `pg_stat_activity`.
3. **Application-layer field encryption (AES-256-GCM)** — the application
   encrypts before writing and decrypts after reading; the database never sees
   plaintext or the key. The key is stored in AWS Secrets Manager, not in the
   database.
4. **Envelope encryption (AWS KMS)** — data keys encrypted by a KMS master key;
   adds key rotation without re-encrypting all rows, but adds KMS API latency
   on every encrypt/decrypt operation.

## Decision

Use application-layer AES-256-GCM field encryption for PII fields:

- A 256-bit encryption key (`FIELD_ENCRYPTION_KEY`, 64 hex characters) is
  loaded from the environment at startup. In production it is sourced from AWS
  Secrets Manager.
- Each encrypted value is stored as `<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
  The IV is randomly generated per encryption operation, ensuring that the same
  plaintext produces different ciphertext on each write.
- The GCM authentication tag provides integrity verification: tampered
  ciphertext is rejected at decrypt time.
- Key rotation is supported via `FIELD_ENCRYPTION_KEY_PREVIOUS`: the application
  tries the current key first, then falls back to the previous key for rows
  encrypted before rotation. A background migration re-encrypts old rows with
  the new key.
- Encrypted fields: `users.email`, `webhooks.secret`.

## Consequences

Positive:

- PII is protected even if the database is compromised; the attacker also needs
  the encryption key.
- GCM authentication tags detect data tampering.
- Per-value random IVs prevent frequency analysis attacks.
- Key rotation is possible without downtime using the dual-key fallback.

Negative:

- Encrypted email addresses cannot be queried with `WHERE email = $1` using a
  standard index. Equality lookups require a deterministic HMAC of the email
  (stored as a separate indexed column) or a full-table scan with application-
  layer decryption.
- The encryption key is a high-value secret; its compromise is equivalent to
  plaintext exposure. Key management discipline (rotation, access controls,
  audit logging) is critical.
- Encrypted fields increase storage size by approximately 80 bytes per value
  (IV + auth tag + hex encoding overhead).
- Backup files contain encrypted data; restoring to a different environment
  requires the matching key.

## Related

- Code: `novaRewards/backend/lib/encryption.js`
- Code: `novaRewards/backend/middleware/validateEnv.js` (`FIELD_ENCRYPTION_KEY`)
- Code: `novaRewards/backend/db/userRepository.js`
- Code: `novaRewards/backend/db/webhookRepository.js`
- ADR: [0011 — AWS as Production Deployment Target](0011-deployment-target-aws-kubernetes.md)
