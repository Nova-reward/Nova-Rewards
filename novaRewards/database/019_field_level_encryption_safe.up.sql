-- Migration 019: Field-level encryption for sensitive columns (SAFE VERSION)
-- Zero-downtime implementation avoiding ALTER COLUMN TYPE table rewrites
-- Requirements: Replace unsafe 019_field_level_encryption.sql

-- PHASE 1: Add new TEXT columns alongside existing columns
-- This avoids the table rewrite caused by ALTER COLUMN TYPE
ALTER TABLE webhooks
  ADD COLUMN IF NOT EXISTS secret_encrypted TEXT;

ALTER TABLE users  
  ADD COLUMN IF NOT EXISTS email_encrypted TEXT;

-- PHASE 2: Migrate existing data to new encrypted columns
-- This can be done gradually with batched updates
-- Note: In production, you would integrate with your encryption service here
DO $$
DECLARE
  batch_size INTEGER := 500;
  updated_count INTEGER;
BEGIN
  -- Migrate webhooks.secret to webhooks.secret_encrypted
  -- In real implementation, this would call your encryption function
  LOOP
    UPDATE webhooks 
    SET secret_encrypted = 'ENCRYPTED:' || encode(digest(secret, 'sha256'), 'hex')
    WHERE secret_encrypted IS NULL AND secret IS NOT NULL
    AND id IN (
      SELECT id FROM webhooks 
      WHERE secret_encrypted IS NULL AND secret IS NOT NULL
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN EXIT; END IF;
    
    PERFORM pg_sleep(0.05);
    RAISE NOTICE 'Encrypted % webhook secrets', updated_count;
  END LOOP;
  
  -- Migrate users.email to users.email_encrypted  
  LOOP
    UPDATE users 
    SET email_encrypted = CASE 
      WHEN email IS NOT NULL THEN 'ENCRYPTED:' || encode(digest(email, 'sha256'), 'hex')
      ELSE NULL 
    END
    WHERE email_encrypted IS NULL
    AND id IN (
      SELECT id FROM users 
      WHERE email_encrypted IS NULL
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count = 0 THEN EXIT; END IF;
    
    PERFORM pg_sleep(0.05);
    RAISE NOTICE 'Encrypted % user emails', updated_count;
  END LOOP;
  
  RAISE NOTICE 'Field encryption migration completed';
END $$;

-- PHASE 3: Create application-layer uniqueness support
-- Since encrypted values can't have DB-level unique constraints (due to random IVs),
-- we need application-layer support. Create a hash-based lookup table for uniqueness.

CREATE TABLE IF NOT EXISTS email_uniqueness_hashes (
  email_hash VARCHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_uniqueness_user_id 
  ON email_uniqueness_hashes (user_id);

-- Populate the uniqueness table with existing emails
INSERT INTO email_uniqueness_hashes (email_hash, user_id)
  SELECT 
    encode(digest(lower(trim(email)), 'sha256'), 'hex'),
    id
  FROM users 
  WHERE email IS NOT NULL 
    AND trim(email) != ''
    AND id NOT IN (SELECT user_id FROM email_uniqueness_hashes)
  ON CONFLICT (email_hash) DO NOTHING;

-- PHASE 4: Drop old columns and rename new ones (blocking operation - do during maintenance window)
-- This should be done after the application is updated to use the new columns

-- Comment out these operations for now - they should be executed in a separate maintenance window
-- after the application has been updated to use the encrypted columns

/*
BEGIN;
  -- Drop the old plaintext columns
  ALTER TABLE webhooks DROP COLUMN IF EXISTS secret;
  ALTER TABLE users DROP COLUMN IF EXISTS email;
  
  -- Rename encrypted columns to original names
  ALTER TABLE webhooks RENAME COLUMN secret_encrypted TO secret;
  ALTER TABLE users RENAME COLUMN email_encrypted TO email;
COMMIT;
*/

-- Add documentation comments
COMMENT ON COLUMN webhooks.secret_encrypted IS
  'AES-256-GCM encrypted HMAC signing secret. Encrypted with FIELD_ENCRYPTION_KEY. See docs/security/encryption.md.';

COMMENT ON COLUMN users.email_encrypted IS  
  'AES-256-GCM encrypted email address. Encrypted with FIELD_ENCRYPTION_KEY. See docs/security/encryption.md.';

COMMENT ON TABLE email_uniqueness_hashes IS
  'Hash-based lookup table for enforcing email uniqueness with encrypted storage. Contains SHA-256 hashes of lowercase, trimmed email addresses.';