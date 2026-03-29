/**
 * Configuration service for managing environment variables.
 * Requirements: #181, #184
 */

/**
 * Gets a configuration value with optional default.
 * @param {string} key - Environment variable key
 * @param {*} defaultValue - Default value if not set
 * @returns {*}
 */
function getConfig(key, defaultValue = null) {
  return process.env[key] || defaultValue;
}

/**
 * Gets a required configuration value or throws an error.
 * @param {string} key - Environment variable key
 * @returns {string}
 */
function getRequiredConfig(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required configuration missing: ${key}`);
  }
  return value;
}

/**
 * Gets a numeric configuration value.
 * @param {string} key - Environment variable key
 * @param {number} defaultValue - Default value if not set
 * @returns {number}
 */
function getNumericConfig(key, defaultValue = 0) {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Invalid numeric configuration for ${key}: ${value}`);
  }
  return parsed;
}

/**
 * Gets a boolean configuration value.
 * @param {string} key - Environment variable key
 * @param {boolean} defaultValue - Default value if not set
 * @returns {boolean}
 */
function getBooleanConfig(key, defaultValue = false) {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

// Referral configuration
const REFERRAL_BONUS_POINTS = getNumericConfig('REFERRAL_BONUS_POINTS', 100);

// Email configuration
const SMTP_HOST = getConfig('SMTP_HOST');
const SMTP_PORT = getNumericConfig('SMTP_PORT', 587);
const SMTP_USER = getConfig('SMTP_USER');
const SMTP_PASSWORD = getConfig('SMTP_PASSWORD');
const EMAIL_FROM = getConfig('EMAIL_FROM', 'noreply@novarewards.com');
const SENDGRID_API_KEY = getConfig('SENDGRID_API_KEY');

// Stellar configuration
const STELLAR_NETWORK = getRequiredConfig('STELLAR_NETWORK');
const HORIZON_URL = getRequiredConfig('HORIZON_URL');
const ISSUER_PUBLIC = getRequiredConfig('ISSUER_PUBLIC');

// Contract configuration
const NOVA_TOKEN_CONTRACT_ID = getConfig('NOVA_TOKEN_CONTRACT_ID');
const REWARD_POOL_CONTRACT_ID = getConfig('REWARD_POOL_CONTRACT_ID');

module.exports = {
  getConfig,
  getRequiredConfig,
  getNumericConfig,
  getBooleanConfig,
  REFERRAL_BONUS_POINTS,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASSWORD,
  EMAIL_FROM,
  SENDGRID_API_KEY,
  STELLAR_NETWORK,
  HORIZON_URL,
  ISSUER_PUBLIC,
  NOVA_TOKEN_CONTRACT_ID,
  REWARD_POOL_CONTRACT_ID,
};
