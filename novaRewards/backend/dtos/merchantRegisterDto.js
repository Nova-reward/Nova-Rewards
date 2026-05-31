/**
 * MerchantRegisterDto — validates POST /api/merchants/register body.
 *
 * Fields:
 *   name             string, required, max 255 chars  (matches VARCHAR(255) in DB)
 *   walletAddress    string, required, max 56 chars   (matches VARCHAR(56) in DB; Stellar keys are exactly 56 chars)
 *   businessCategory string, optional, max 100 chars  (matches VARCHAR(100) in DB)
 */

const ALLOWED_FIELDS = ['name', 'walletAddress', 'businessCategory'];

// Mirror DB column limits so validation fires before the query reaches Postgres
const MAX_NAME_LENGTH             = 255;
const MAX_WALLET_ADDRESS_LENGTH   = 56;
const MAX_BUSINESS_CATEGORY_LENGTH = 100;

/**
 * @param {Object} data - req.body
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateMerchantRegisterDto(data) {
  const errors = [];

  // Unknown field guard (mass-assignment protection)
  const unknown = Object.keys(data).filter(k => !ALLOWED_FIELDS.includes(k));
  if (unknown.length) errors.push(`Unknown fields: ${unknown.join(', ')}`);

  // name — required, non-empty after trim, within DB column limit
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    errors.push('name is required');
  } else if (data.name.trim().length > MAX_NAME_LENGTH) {
    errors.push(`name must be ${MAX_NAME_LENGTH} characters or less`);
  }

  // walletAddress — required, within DB column limit (Stellar address format validated separately)
  if (!data.walletAddress || typeof data.walletAddress !== 'string' || !data.walletAddress.trim()) {
    errors.push('walletAddress is required');
  } else if (data.walletAddress.trim().length > MAX_WALLET_ADDRESS_LENGTH) {
    errors.push(`walletAddress must be ${MAX_WALLET_ADDRESS_LENGTH} characters or less`);
  }

  // businessCategory — optional, but cap length if provided
  if (data.businessCategory !== undefined && data.businessCategory !== null) {
    if (typeof data.businessCategory !== 'string') {
      errors.push('businessCategory must be a string');
    } else if (data.businessCategory.trim().length > MAX_BUSINESS_CATEGORY_LENGTH) {
      errors.push(`businessCategory must be ${MAX_BUSINESS_CATEGORY_LENGTH} characters or less`);
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateMerchantRegisterDto,
  MERCHANT_REGISTER_ALLOWED_FIELDS: ALLOWED_FIELDS,
};
