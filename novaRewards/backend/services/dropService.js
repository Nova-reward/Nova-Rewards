const { createHash } = require('crypto');
const { query } = require('../db/index');
const { getActiveDrops, getDropById, getClaimCount, recordClaim } = require('../db/dropRepository');

/**
 * Evaluates a user's eligibility against a single drop's criteria.
 *
 * Supported criteria keys (all optional):
 *   - minPoints      {number}  minimum point balance
 *   - minAccountAgeDays {number} minimum days since account creation
 *   - minReferrals   {number}  minimum number of successful referrals
 *
 * @param {object} user  - User row from DB (must include id, created_at)
 * @param {object} criteria - Drop eligibility_criteria JSON
 * @returns {Promise<{eligible: boolean, reason?: string}>}
 */
async function evaluateCriteria(user, criteria) {
  if (criteria.minPoints !== undefined) {
    const ptResult = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM point_transactions
       WHERE user_id = $1 AND type IN ('earned', 'referral', 'bonus')`,
      [user.id]
    );
    const points = parseFloat(ptResult.rows[0].total);
    if (points < criteria.minPoints) {
      return { eligible: false, reason: `Minimum ${criteria.minPoints} points required; you have ${points}` };
    }
  }

  if (criteria.minAccountAgeDays !== undefined) {
    const ageMs = Date.now() - new Date(user.created_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < criteria.minAccountAgeDays) {
      return { eligible: false, reason: `Account must be at least ${criteria.minAccountAgeDays} days old` };
    }
  }

  if (criteria.minReferrals !== undefined) {
    const refResult = await query(
      'SELECT COUNT(*) AS cnt FROM users WHERE referred_by = $1',
      [user.id]
    );
    const referrals = parseInt(refResult.rows[0].cnt, 10);
    if (referrals < criteria.minReferrals) {
      return { eligible: false, reason: `Minimum ${criteria.minReferrals} referrals required; you have ${referrals}` };
    }
  }

  return { eligible: true };
}

/**
 * Returns all active drops the user is eligible for.
 * @param {object} user
 * @returns {Promise<object[]>}
 */
async function getEligibleDrops(user) {
  const drops = await getActiveDrops();
  const eligible = [];

  for (const drop of drops) {
    const { eligible: ok } = await evaluateCriteria(user, drop.eligibility_criteria || {});
    if (ok) eligible.push(drop);
  }

  return eligible;
}

/**
 * Verifies a Merkle proof that the user's address is in the drop's allowlist.
 *
 * The leaf is sha256(walletAddress). Each proof element is a sibling hash.
 * Hashes are combined as sha256(sort(a, b)) to match standard Merkle trees.
 *
 * @param {string} walletAddress
 * @param {string[]} proof  - Array of hex sibling hashes
 * @param {string} root     - Expected Merkle root (hex)
 * @returns {boolean}
 */
function verifyMerkleProof(walletAddress, proof, root) {
  let hash = createHash('sha256').update(walletAddress).digest('hex');

  for (const sibling of proof) {
    const [a, b] = [hash, sibling].sort();
    hash = createHash('sha256').update(a + b).digest('hex');
  }

  return hash === root;
}

/**
 * Processes a claim for a drop.
 * Validates expiry, Merkle proof (if root set), per-user claim limit, and criteria.
 * Records the claim and emits a drop.claimed event.
 *
 * @param {object} drop
 * @param {object} user
 * @param {string[]} proof - Merkle proof from client
 * @param {object} eventEmitter - Node.js EventEmitter instance
 * @returns {Promise<{success: boolean, claim?: object, status?: number, reason?: string}>}
 */
async function processClaim(drop, user, proof, eventEmitter) {
  // Check expiry
  if (new Date(drop.expires_at) <= new Date()) {
    return { success: false, status: 403, reason: 'Drop has expired' };
  }

  // Verify Merkle proof if the drop has a root configured
  if (drop.merkle_root) {
    if (!proof || !verifyMerkleProof(user.wallet_address, proof, drop.merkle_root)) {
      return { success: false, status: 403, reason: 'Invalid eligibility proof' };
    }
  }

  // Check eligibility criteria
  const { eligible, reason } = await evaluateCriteria(user, drop.eligibility_criteria || {});
  if (!eligible) {
    return { success: false, status: 403, reason };
  }

  // Enforce per-user claim limit
  const claimCount = await getClaimCount(drop.id, user.id);
  if (claimCount >= drop.max_claims_per_user) {
    return { success: false, status: 403, reason: `Claim limit of ${drop.max_claims_per_user} reached for this drop` };
  }

  const claim = await recordClaim(drop.id, user.id);

  eventEmitter.emit('drop.claimed', { drop, user, claim });

  return { success: true, claim };
}

module.exports = { getEligibleDrops, verifyMerkleProof, processClaim };
