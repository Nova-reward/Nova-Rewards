const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { StrKey, Keypair } = require('stellar-sdk');
const { client: redisClient } = require('../lib/redis');
const { query } = require('../db/index');
const { getConfig, getRequiredConfig } = require('./configService');

const NONCE_PREFIX = 'stellar:nonce:';
const NONCE_TTL_SECONDS = 5 * 60; // 5 minutes
const JWT_EXPIRES_IN = getConfig('STELLAR_AUTH_JWT_EXPIRES_IN', '15m');

/**
 * Generates a challenge nonce tied to a Stellar wallet address.
 * Stores the nonce in Redis with a 5-minute TTL.
 *
 * @param {string} walletAddress - Stellar public key (G...)
 * @returns {Promise<{ nonce: string, expiresAt: number }>}
 */
async function createChallenge(walletAddress) {
  if (!isValidWallet(walletAddress)) {
    throw Object.assign(new Error('Invalid Stellar wallet address'), { status: 400 });
  }

  const nonce = uuidv4();
  const key = `${NONCE_PREFIX}${walletAddress}`;
  const expiresAt = Math.floor(Date.now() / 1000) + NONCE_TTL_SECONDS;

  // Store nonce in Redis with 5-min TTL. Overwrites any previous nonce for this wallet.
  await redisClient.set(key, nonce, { EX: NONCE_TTL_SECONDS });

  return { nonce, expiresAt };
}

/**
 * Verifies a signed challenge and issues a JWT.
 *
 * Flow:
 *  1. Retrieve the nonce from Redis for the given wallet address
 *  2. If missing or expired → 401
 *  3. Delete the nonce (single-use)
 *  4. Verify the Stellar signature against the challenge message
 *  5. Look up or create the user record, determine roles
 *  6. Sign and return a JWT containing walletAddress, roles, expiry
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

  // 1. Retrieve nonce from Redis
  const key = `${NONCE_PREFIX}${walletAddress}`;
  const nonce = await redisClient.get(key);

  if (!nonce) {
    const err = new Error('Challenge expired or not found');
    err.status = 401;
    err.code = 'challenge_expired';
    throw err;
  }

  // 2. Single-use: delete the nonce immediately
  await redisClient.del(key);

  // 3. Reconstruct the challenge message that was signed
  const challengeMessage = buildChallengeMessage(walletAddress, nonce);

  // 4. Verify the Stellar signature
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

  // 5. Look up user by wallet address to determine roles
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
 * Format: "NovaRewards Auth\nWallet: <address>\nNonce: <nonce>"
 */
function buildChallengeMessage(walletAddress, nonce) {
  return `NovaRewards Auth\nWallet: ${walletAddress}\nNonce: ${nonce}`;
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
