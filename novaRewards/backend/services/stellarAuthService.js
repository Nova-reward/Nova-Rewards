const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { StrKey, Keypair } = require('stellar-sdk');
const { client: redisClient } = require('../lib/redis');
const { query } = require('../db/index');
const { getConfig, getRequiredConfig } = require('./configService');

const NONCE_PREFIX = 'stellar:nonce:';
const NONCE_TTL_SECONDS = 5 * 60; // 5 minutes
const JWT_EXPIRES_IN = getConfig('STELLAR_AUTH_JWT_EXPIRES_IN', '15m');
const AUTH_DOMAIN = getConfig('AUTH_DOMAIN', 'novarewards.com');

/**
 * Generates a challenge nonce tied to a Stellar wallet address.
 * Stores the challenge data in Redis with a 5-minute TTL.
 *
 * @param {string} walletAddress - Stellar public key (G...)
 * @returns {Promise<{ nonce: string, timestamp: number, domain: string, expiresAt: number }>}
 */
async function createChallenge(walletAddress) {
  if (!isValidWallet(walletAddress)) {
    throw Object.assign(new Error('Invalid Stellar wallet address'), { status: 400 });
  }

  const nonce = uuidv4();
  const timestamp = Math.floor(Date.now() / 1000);
  const key = `${NONCE_PREFIX}${walletAddress}`;
  const expiresAt = timestamp + NONCE_TTL_SECONDS;

  const challengeData = JSON.stringify({ nonce, timestamp });

  // Store challenge data in Redis with 5-min TTL. Overwrites any previous challenge for this wallet.
  await redisClient.set(key, challengeData, { EX: NONCE_TTL_SECONDS });

  return { nonce, timestamp, domain: AUTH_DOMAIN, expiresAt };
}

/**
 * Verifies a signed challenge and issues a JWT.
 *
 * Flow:
 *  1. Retrieve the challenge data from Redis for the given wallet address
 *  2. If missing or expired → 401
 *  3. Delete the challenge data (single-use)
 *  4. Verify the timestamp is within the last 5 minutes
 *  5. Verify the Stellar signature against the reconstructed challenge message
 *  6. Look up or create the user record, determine roles
 *  7. Sign and return a JWT containing walletAddress, roles, expiry
 *
 * @param {string} walletAddress - Stellar public key
 * @param {string} signedChallenge - Base64-encoded signed challenge
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: object }>}
 */
async function verifyChallenge(walletAddress, signedChallenge) {
  if (!isValidWallet(walletAddress)) {
    throw Object.assign(new Error('Invalid Stellar wallet address'), { status: 400 });
  }

  if (!signedChallenge) {
    throw Object.assign(new Error('Signed challenge is required'), { status: 400 });
  }

  // 1. Retrieve challenge data from Redis
  const key = `${NONCE_PREFIX}${walletAddress}`;
  const storedData = await redisClient.get(key);

  if (!storedData) {
    const err = new Error('Challenge expired or not found');
    err.status = 401;
    err.code = 'challenge_expired';
    throw err;
  }

  let challenge;
  try {
    challenge = JSON.parse(storedData);
  } catch (e) {
    const err = new Error('Malformed challenge data');
    err.status = 401;
    err.code = 'malformed_challenge';
    throw err;
  }

  const { nonce, timestamp } = challenge;

  // 2. Single-use: delete the challenge data immediately
  await redisClient.del(key);

  // 3. Verify timestamp (must be within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > NONCE_TTL_SECONDS) {
    const err = new Error('Challenge signature expired');
    err.status = 401;
    err.code = 'challenge_expired';
    throw err;
  }

  // 4. Reconstruct the challenge message that was signed
  const challengeMessage = buildChallengeMessage(walletAddress, nonce, timestamp, AUTH_DOMAIN);

  // 5. Verify the Stellar signature
  const signatureValid = verifyStellarSignature(
    walletAddress,
    challengeMessage,
    signedChallenge,
  );

  if (!signatureValid) {
    const err = new Error('Invalid signature');
    err.status = 401;
    err.code = 'invalid_signature';
    throw err;
  }

  // 6. Look up user by wallet address to determine roles
  const user = await findOrCreateUserByWallet(walletAddress);

  // 6. Issue JWT
  const secret = getRequiredConfig('JWT_SECRET');
  const accessToken = jwt.sign(
    {
      walletAddress,
      userId: user.id,
      role: user.role,
    },
    secret,
    { expiresIn: JWT_EXPIRES_IN },
  );

  const refreshToken = jwt.sign(
    { userId: user.id, walletAddress, type: 'refresh' },
    secret,
    { expiresIn: getConfig('JWT_REFRESH_EXPIRES_IN', '7d') },
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      walletAddress: user.wallet_address,
      role: user.role,
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validates a Stellar Ed25519 public key.
 */
function isValidWallet(address) {
  if (typeof address !== 'string') return false;
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

/**
 * Builds the deterministic challenge message the client must sign.
 * Format: "NovaRewards Auth\nDomain: <domain>\nWallet: <address>\nNonce: <nonce>\nTimestamp: <timestamp>"
 */
function buildChallengeMessage(walletAddress, nonce, timestamp, domain) {
  return `NovaRewards Auth\nDomain: ${domain}\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
}

/**
 * Verifies a Stellar Ed25519 signature over the challenge message.
 *
 * @param {string} publicKey  - G-prefixed public key
 * @param {string} message    - The challenge message string
 * @param {string} signature  - Base64-encoded signature
 * @returns {boolean}
 */
function verifyStellarSignature(publicKey, message, signature) {
  try {
    const kp = Keypair.fromPublicKey(publicKey);
    const msgBytes = Buffer.from(message, 'utf-8');
    const sigBytes = Buffer.from(signature, 'base64');
    return kp.verify(msgBytes, sigBytes);
  } catch {
    return false;
  }
}

/**
 * Finds an existing user by wallet_address, or creates a new one with
 * the default "user" role.
 */
async function findOrCreateUserByWallet(walletAddress) {
  const existing = await query(
    `SELECT id, wallet_address, role FROM users WHERE wallet_address = $1 AND is_deleted = FALSE`,
    [walletAddress],
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  // Auto-create user with default role
  const result = await query(
    `INSERT INTO users (wallet_address, role, first_name, last_name, email)
     VALUES ($1, 'user', 'Wallet', 'User', $2)
     ON CONFLICT (wallet_address) DO UPDATE SET is_deleted = FALSE
     RETURNING id, wallet_address, role`,
    [walletAddress, `${walletAddress}@stellar`],
  );

  return result.rows[0];
}

module.exports = {
  createChallenge,
  verifyChallenge,
  // Exported for testing
  _buildChallengeMessage: buildChallengeMessage,
  _verifyStellarSignature: verifyStellarSignature,
  _isValidWallet: isValidWallet,
  NONCE_PREFIX,
  NONCE_TTL_SECONDS,
};
