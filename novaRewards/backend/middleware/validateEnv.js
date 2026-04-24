/**
 * Required environment variables for the NovaRewards backend.
 * Requirements: 11.1, 11.3
 */
const REQUIRED_ENV_VARS = [
  'ISSUER_PUBLIC',
  'ISSUER_SECRET',
  'DISTRIBUTION_PUBLIC',
  'DISTRIBUTION_SECRET',
  'STELLAR_NETWORK',
  'HORIZON_URL',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'FIELD_ENCRYPTION_KEY',  // AES-256-GCM key for field-level encryption (#651)
];

const BACKUP_ENV_VARS = [
  'BACKUP_PASSPHRASE',
];

/**
 * Validates that all required environment variables are set.
 * Logs each missing key and throws an error to halt server initialization.
 * Requirements: 11.3
 *
 * @throws {Error} if any required env vars are missing
 */
function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (process.env.NODE_ENV === 'production') {
    // ALLOWED_ORIGIN is required for CORS security in production
    if (!process.env.ALLOWED_ORIGIN) missing.push('ALLOWED_ORIGIN');
    // REDIS_URL is required in production (sourced from Secrets Manager)
    if (!process.env.REDIS_URL) missing.push('REDIS_URL');
  }

  if (process.env.BACKUP_ENABLED === 'true') {
    BACKUP_ENV_VARS.forEach((key) => {
      if (!process.env[key]) missing.push(key);
    });
  }

  if (missing.length > 0) {
    missing.forEach((key) => {
      console.error(`[validateEnv] Missing required environment variable: ${key}`);
    });
    throw new Error(
      `Server startup aborted. Missing environment variables: ${missing.join(', ')}`
    );
  }
}

module.exports = { validateEnv, REQUIRED_ENV_VARS, BACKUP_ENV_VARS };
