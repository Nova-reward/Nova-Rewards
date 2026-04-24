-- Migration 019: Field-level encryption for sensitive columns
-- Requirements: #651
--
-- Widens columns that will store AES-256-GCM encrypted blobs.
-- Encrypted format: base64(iv[12] + authTag[16] + ciphertext)
--
-- Column size estimates:
--   webhooks.secret  (was VARCHAR(64))  → TEXT  (encrypted ~120 chars)
--   users.email      (was VARCHAR(255)) → TEXT  (encrypted ~200 chars)
--
-- After running this migration, execute the key-rotation script to
-- re-encrypt any existing plaintext values:
--   node scripts/encrypt-existing-rows.js
--
-- NOTE: The unique index on users.email is dropped because encrypted values
-- are non-deterministic (random IV per encryption). Uniqueness is now
-- enforced at the application layer in the auth route.

-- Widen webhooks.secret to TEXT
ALTER TABLE webhooks
  ALTER COLUMN secret TYPE TEXT;

-- Widen users.email to TEXT and drop the plaintext unique index
-- (uniqueness is enforced at the application layer after encryption)
ALTER TABLE users
  ALTER COLUMN email TYPE TEXT;

DROP INDEX IF EXISTS idx_users_email;

-- Add a comment documenting the encryption scheme
COMMENT ON COLUMN webhooks.secret IS
  'AES-256-GCM encrypted HMAC signing secret. Encrypted with FIELD_ENCRYPTION_KEY. See docs/security/encryption.md.';

COMMENT ON COLUMN users.email IS
  'AES-256-GCM encrypted email address. Encrypted with FIELD_ENCRYPTION_KEY. See docs/security/encryption.md.';
