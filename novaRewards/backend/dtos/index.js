/**
 * Centralised DTO validation for all API routes.
 * Each validator returns { valid: boolean, errors: Record<string, string[]> }
 * so callers can produce consistent field-level error responses.
 *
 * Closes #646
 */

'use strict';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Stellar public key: G/M/A + 55 base-32 chars */
const STELLAR_RE = /^[GMA][A-Z2-7]{55}$/;
/** UUID v4 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Safe URL — https only, no javascript: or data: schemes */
const URL_RE = /^https:\/\/[^\s<>"']{1,2048}$/i;
/** Email */
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{1,63}$/;
/** Alphanumeric + common safe chars, no SQL metacharacters */
const SAFE_STRING_RE = /^[^'";\-\-<>\\]*$/;

function isStellarAddress(v) { return typeof v === 'string' && STELLAR_RE.test(v); }
function isUUID(v)           { return typeof v === 'string' && UUID_RE.test(v); }
function isSafeUrl(v)        { return typeof v === 'string' && URL_RE.test(v); }
function isEmail(v)          { return typeof v === 'string' && EMAIL_RE.test(v.trim()); }
function isSafeString(v)     { return typeof v === 'string' && SAFE_STRING_RE.test(v); }
function isPositiveInt(v)    { const n = Number(v); return Number.isInteger(n) && n > 0; }
function isPositiveNum(v)    { const n = Number(v); return Number.isFinite(n) && n > 0; }

/**
 * Build a consistent validation result.
 * @param {Record<string, string[]>} fieldErrors
 */
function result(fieldErrors) {
  const errors = Object.fromEntries(
    Object.entries(fieldErrors).filter(([, msgs]) => msgs.length > 0)
  );
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Express middleware factory — runs a DTO validator against req.body and
 * returns 400 with field-level errors on failure.
 */
function bodyValidator(validatorFn) {
  return (req, res, next) => {
    const { valid, errors } = validatorFn(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Request body validation failed',
        fields: errors,
      });
    }
    next();
  };
}

/**
 * Express middleware factory — validates req.params.
 */
function paramsValidator(validatorFn) {
  return (req, res, next) => {
    const { valid, errors } = validatorFn(req.params);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Path parameter validation failed',
        fields: errors,
      });
    }
    next();
  };
}

/**
 * Express middleware factory — validates req.query.
 */
function queryValidator(validatorFn) {
  return (req, res, next) => {
    const { valid, errors } = validatorFn(req.query);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Query parameter validation failed',
        fields: errors,
      });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Shared param / query validators
// ---------------------------------------------------------------------------

/** Validates :id path param as a positive integer */
function validateIdParam(params) {
  const errs = { id: [] };
  if (!isPositiveInt(params.id)) errs.id.push('id must be a positive integer');
  return result(errs);
}

/** Validates :address path param as a Stellar public key */
function validateStellarAddressParam(params) {
  const errs = { address: [] };
  if (!isStellarAddress(params.address)) errs.address.push('address must be a valid Stellar public key');
  return result(errs);
}

/** Validates common pagination query params */
function validatePaginationQuery(query) {
  const errs = { page: [], limit: [] };
  if (query.page !== undefined) {
    if (!isPositiveInt(query.page)) errs.page.push('page must be a positive integer');
  }
  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) errs.limit.push('limit must be an integer between 1 and 100');
  }
  return result(errs);
}

// ---------------------------------------------------------------------------
// Auth DTOs
// ---------------------------------------------------------------------------

function validateLoginDto(body) {
  const errs = { email: [], password: [] };
  if (!isEmail(body.email)) errs.email.push('email must be a valid email address');
  if (typeof body.email === 'string' && body.email.length > 254) errs.email.push('email must be 254 characters or less');
  if (!body.password || typeof body.password !== 'string') errs.password.push('password is required');
  else if (body.password.length > 128) errs.password.push('password must be 128 characters or less');
  return result(errs);
}

function validateRegisterDto(body) {
  const errs = { email: [], password: [], firstName: [], lastName: [] };
  if (!isEmail(body.email)) errs.email.push('email must be a valid email address');
  if (typeof body.email === 'string' && body.email.length > 254) errs.email.push('email must be 254 characters or less');
  if (!body.password || typeof body.password !== 'string') errs.password.push('password is required');
  else if (body.password.length < 8) errs.password.push('password must be at least 8 characters');
  else if (body.password.length > 128) errs.password.push('password must be 128 characters or less');
  if (!body.firstName || typeof body.firstName !== 'string' || !body.firstName.trim()) errs.firstName.push('firstName is required');
  else if (body.firstName.length > 100) errs.firstName.push('firstName must be 100 characters or less');
  else if (!isSafeString(body.firstName)) errs.firstName.push('firstName contains invalid characters');
  if (!body.lastName || typeof body.lastName !== 'string' || !body.lastName.trim()) errs.lastName.push('lastName is required');
  else if (body.lastName.length > 100) errs.lastName.push('lastName must be 100 characters or less');
  else if (!isSafeString(body.lastName)) errs.lastName.push('lastName contains invalid characters');
  return result(errs);
}

function validateForgotPasswordDto(body) {
  const errs = { email: [] };
  if (!isEmail(body.email)) errs.email.push('email must be a valid email address');
  return result(errs);
}

function validateResetPasswordDto(body) {
  const errs = { token: [], password: [] };
  if (!body.token || typeof body.token !== 'string' || body.token.length > 512) errs.token.push('token is required and must be a string');
  if (!body.password || typeof body.password !== 'string') errs.password.push('password is required');
  else if (body.password.length < 8) errs.password.push('password must be at least 8 characters');
  else if (body.password.length > 128) errs.password.push('password must be 128 characters or less');
  return result(errs);
}

// ---------------------------------------------------------------------------
// Campaign DTOs
// ---------------------------------------------------------------------------

function validateCreateCampaignDto(body) {
  const errs = { name: [], rewardRate: [], startDate: [], endDate: [] };
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) errs.name.push('name is required');
  else if (body.name.length > 200) errs.name.push('name must be 200 characters or less');
  else if (!isSafeString(body.name)) errs.name.push('name contains invalid characters');
  if (body.rewardRate === undefined || body.rewardRate === null) errs.rewardRate.push('rewardRate is required');
  else if (!isPositiveNum(body.rewardRate)) errs.rewardRate.push('rewardRate must be a positive number');
  else if (Number(body.rewardRate) > 1000000) errs.rewardRate.push('rewardRate exceeds maximum allowed value');
  if (!body.startDate) errs.startDate.push('startDate is required');
  else if (isNaN(Date.parse(body.startDate))) errs.startDate.push('startDate must be a valid ISO 8601 date');
  if (!body.endDate) errs.endDate.push('endDate is required');
  else if (isNaN(Date.parse(body.endDate))) errs.endDate.push('endDate must be a valid ISO 8601 date');
  else if (body.startDate && Date.parse(body.endDate) <= Date.parse(body.startDate)) errs.endDate.push('endDate must be after startDate');
  return result(errs);
}

function validateUpdateCampaignDto(body) {
  const errs = { name: [], rewardRate: [] };
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) errs.name.push('name must be a non-empty string');
    else if (body.name.length > 200) errs.name.push('name must be 200 characters or less');
    else if (!isSafeString(body.name)) errs.name.push('name contains invalid characters');
  }
  if (body.rewardRate !== undefined) {
    if (!isPositiveNum(body.rewardRate)) errs.rewardRate.push('rewardRate must be a positive number');
    else if (Number(body.rewardRate) > 1000000) errs.rewardRate.push('rewardRate exceeds maximum allowed value');
  }
  if (body.name === undefined && body.rewardRate === undefined) {
    errs.name.push('Provide at least one of: name, rewardRate');
  }
  return result(errs);
}

// ---------------------------------------------------------------------------
// Reward DTOs
// ---------------------------------------------------------------------------

function validateIssueRewardDto(body) {
  const errs = { idempotencyKey: [], walletAddress: [], amount: [], campaignId: [] };
  if (!body.idempotencyKey || typeof body.idempotencyKey !== 'string') errs.idempotencyKey.push('idempotencyKey is required');
  else if (body.idempotencyKey.length > 128) errs.idempotencyKey.push('idempotencyKey must be 128 characters or less');
  if (!isStellarAddress(body.walletAddress)) errs.walletAddress.push('walletAddress must be a valid Stellar public key');
  if (!isPositiveNum(body.amount)) errs.amount.push('amount must be a positive number');
  else if (Number(body.amount) > 1e15) errs.amount.push('amount exceeds maximum allowed value');
  if (!isPositiveInt(body.campaignId)) errs.campaignId.push('campaignId must be a positive integer');
  return result(errs);
}

function validateDistributeRewardDto(body) {
  const errs = { walletAddress: [], amount: [], campaignId: [] };
  const wallet = body.walletAddress || body.customerWallet;
  if (!isStellarAddress(wallet)) errs.walletAddress.push('walletAddress must be a valid Stellar public key');
  if (!isPositiveNum(body.amount)) errs.amount.push('amount must be a positive number');
  else if (Number(body.amount) > 1e15) errs.amount.push('amount exceeds maximum allowed value');
  if (body.campaignId !== undefined && !isPositiveInt(body.campaignId)) errs.campaignId.push('campaignId must be a positive integer');
  return result(errs);
}

// ---------------------------------------------------------------------------
// Redemption DTOs
// ---------------------------------------------------------------------------

function validateCreateRedemptionDto(body) {
  const errs = { userId: [], rewardId: [], campaignId: [] };
  if (!isPositiveInt(body.userId)) errs.userId.push('userId must be a positive integer');
  if (!isPositiveInt(body.rewardId)) errs.rewardId.push('rewardId must be a positive integer');
  if (body.campaignId !== undefined && body.campaignId !== null && !isPositiveInt(body.campaignId)) {
    errs.campaignId.push('campaignId must be a positive integer');
  }
  return result(errs);
}

// ---------------------------------------------------------------------------
// User DTOs
// ---------------------------------------------------------------------------

function validateCreateUserDto(body) {
  const errs = { walletAddress: [], referralCode: [] };
  if (!isStellarAddress(body.walletAddress)) errs.walletAddress.push('walletAddress must be a valid Stellar public key');
  if (body.referralCode !== undefined && body.referralCode !== null) {
    if (!isStellarAddress(body.referralCode)) errs.referralCode.push('referralCode must be a valid Stellar public key');
  }
  return result(errs);
}

function validateUpdateUserDto(body) {
  const errs = { firstName: [], lastName: [], bio: [], stellarPublicKey: [] };
  if (body.firstName !== undefined) {
    if (typeof body.firstName !== 'string' || !body.firstName.trim()) errs.firstName.push('firstName must be a non-empty string');
    else if (body.firstName.length > 100) errs.firstName.push('firstName must be 100 characters or less');
    else if (!isSafeString(body.firstName)) errs.firstName.push('firstName contains invalid characters');
  }
  if (body.lastName !== undefined) {
    if (typeof body.lastName !== 'string' || !body.lastName.trim()) errs.lastName.push('lastName must be a non-empty string');
    else if (body.lastName.length > 100) errs.lastName.push('lastName must be 100 characters or less');
    else if (!isSafeString(body.lastName)) errs.lastName.push('lastName contains invalid characters');
  }
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string') errs.bio.push('bio must be a string');
    else if (body.bio.length > 1000) errs.bio.push('bio must be 1000 characters or less');
  }
  if (body.stellarPublicKey !== undefined) {
    if (!isStellarAddress(body.stellarPublicKey)) errs.stellarPublicKey.push('stellarPublicKey must be a valid Stellar public key');
  }
  return result(errs);
}

// ---------------------------------------------------------------------------
// Wallet DTOs
// ---------------------------------------------------------------------------

function validateVerifyWalletDto(body) {
  const errs = { publicKey: [], walletType: [] };
  if (!isStellarAddress(body.publicKey)) errs.publicKey.push('publicKey must be a valid Stellar public key');
  const ALLOWED_WALLET_TYPES = ['freighter', 'xbull', 'albedo', 'walletconnect'];
  if (body.walletType !== undefined && !ALLOWED_WALLET_TYPES.includes(body.walletType)) {
    errs.walletType.push(`walletType must be one of: ${ALLOWED_WALLET_TYPES.join(', ')}`);
  }
  return result(errs);
}

function validatePublicKeyParam(params) {
  const errs = { publicKey: [] };
  if (!isStellarAddress(params.publicKey)) errs.publicKey.push('publicKey must be a valid Stellar public key');
  return result(errs);
}

// ---------------------------------------------------------------------------
// Transaction DTOs
// ---------------------------------------------------------------------------

const VALID_TX_TYPES = ['distribution', 'redemption', 'transfer'];

function validateRecordTransactionDto(body) {
  const errs = { txHash: [], txType: [], amount: [], fromWallet: [], toWallet: [], merchantId: [], campaignId: [] };
  if (!body.txHash || typeof body.txHash !== 'string') errs.txHash.push('txHash is required');
  else if (!/^[a-fA-F0-9]{64}$/.test(body.txHash)) errs.txHash.push('txHash must be a 64-character hex string');
  if (!body.txType || !VALID_TX_TYPES.includes(body.txType)) errs.txType.push(`txType must be one of: ${VALID_TX_TYPES.join(', ')}`);
  if (body.amount !== undefined && !isPositiveNum(body.amount)) errs.amount.push('amount must be a positive number');
  if (body.fromWallet !== undefined && !isStellarAddress(body.fromWallet)) errs.fromWallet.push('fromWallet must be a valid Stellar public key');
  if (body.toWallet !== undefined && !isStellarAddress(body.toWallet)) errs.toWallet.push('toWallet must be a valid Stellar public key');
  if (body.merchantId !== undefined && body.merchantId !== null && !isPositiveInt(body.merchantId)) errs.merchantId.push('merchantId must be a positive integer');
  if (body.campaignId !== undefined && body.campaignId !== null && !isPositiveInt(body.campaignId)) errs.campaignId.push('campaignId must be a positive integer');
  return result(errs);
}

function validateTransactionHistoryQuery(query) {
  const errs = { page: [], limit: [], type: [], status: [], startDate: [], endDate: [] };
  if (query.page !== undefined && !isPositiveInt(query.page)) errs.page.push('page must be a positive integer');
  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) errs.limit.push('limit must be an integer between 1 and 100');
  }
  if (query.type !== undefined && !VALID_TX_TYPES.includes(query.type)) errs.type.push(`type must be one of: ${VALID_TX_TYPES.join(', ')}`);
  const VALID_STATUSES = ['pending', 'confirmed', 'failed', 'refunded'];
  if (query.status !== undefined && !VALID_STATUSES.includes(query.status)) errs.status.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  if (query.startDate !== undefined && isNaN(Date.parse(query.startDate))) errs.startDate.push('startDate must be a valid ISO 8601 date');
  if (query.endDate !== undefined && isNaN(Date.parse(query.endDate))) errs.endDate.push('endDate must be a valid ISO 8601 date');
  return result(errs);
}

// ---------------------------------------------------------------------------
// Webhook DTOs
// ---------------------------------------------------------------------------

const VALID_WEBHOOK_EVENTS = [
  'reward.issued', 'reward.failed', 'redemption.created',
  'campaign.created', 'campaign.updated', 'campaign.paused',
  'transaction.confirmed', 'transaction.failed',
];

function validateCreateWebhookDto(body) {
  const errs = { url: [], events: [], secret: [] };
  if (!isSafeUrl(body.url)) errs.url.push('url must be a valid HTTPS URL (max 2048 chars)');
  if (!Array.isArray(body.events) || body.events.length === 0) errs.events.push('events must be a non-empty array');  else {
    const invalid = body.events.filter(e => !VALID_WEBHOOK_EVENTS.includes(e));
    if (invalid.length) errs.events.push(`Unknown event types: ${invalid.join(', ')}`);
    if (body.events.length > 20) errs.events.push('events array must have 20 items or fewer');
  }
  if (body.secret !== undefined) {
    if (typeof body.secret !== 'string' || body.secret.length < 16 || body.secret.length > 256) {
      errs.secret.push('secret must be a string between 16 and 256 characters');
    }
  }
  return result(errs);
}

function validateUpdateWebhookDto(body) {
  const errs = { url: [], events: [], isActive: [] };
  if (body.url !== undefined && !isSafeUrl(body.url)) errs.url.push('url must be a valid HTTPS URL (max 2048 chars)');
  if (body.events !== undefined) {
    if (!Array.isArray(body.events) || body.events.length === 0) errs.events.push('events must be a non-empty array');
    else {
      const invalid = body.events.filter(e => !VALID_WEBHOOK_EVENTS.includes(e));
      if (invalid.length) errs.events.push(`Unknown event types: ${invalid.join(', ')}`);
    }
  }
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') errs.isActive.push('isActive must be a boolean');
  return result(errs);
}

// ---------------------------------------------------------------------------
// Admin DTOs
// ---------------------------------------------------------------------------

function validateCreateAdminRewardDto(body) {
  const errs = { name: [], description: [], pointsCost: [], stock: [] };
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) errs.name.push('name is required');
  else if (body.name.length > 200) errs.name.push('name must be 200 characters or less');
  else if (!isSafeString(body.name)) errs.name.push('name contains invalid characters');
  if (body.description !== undefined) {
    if (typeof body.description !== 'string') errs.description.push('description must be a string');
    else if (body.description.length > 2000) errs.description.push('description must be 2000 characters or less');
  }
  if (!isPositiveInt(body.pointsCost)) errs.pointsCost.push('pointsCost must be a positive integer');
  else if (Number(body.pointsCost) > 1e9) errs.pointsCost.push('pointsCost exceeds maximum allowed value');
  if (body.stock !== undefined && body.stock !== null) {
    if (!isPositiveInt(body.stock)) errs.stock.push('stock must be a positive integer');
  }
  return result(errs);
}

function validateUpdateAdminRewardDto(body) {
  const errs = { name: [], description: [], pointsCost: [], stock: [], isActive: [] };
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) errs.name.push('name must be a non-empty string');
    else if (body.name.length > 200) errs.name.push('name must be 200 characters or less');
    else if (!isSafeString(body.name)) errs.name.push('name contains invalid characters');
  }
  if (body.description !== undefined && typeof body.description !== 'string') errs.description.push('description must be a string');
  if (body.pointsCost !== undefined && !isPositiveInt(body.pointsCost)) errs.pointsCost.push('pointsCost must be a positive integer');
  if (body.stock !== undefined && body.stock !== null && !isPositiveInt(body.stock)) errs.stock.push('stock must be a positive integer');
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') errs.isActive.push('isActive must be a boolean');
  return result(errs);
}

function validateUpdateUserRoleDto(body) {
  const errs = { role: [] };
  const VALID_ROLES = ['user', 'admin', 'merchant'];
  if (!body.role || !VALID_ROLES.includes(body.role)) errs.role.push(`role must be one of: ${VALID_ROLES.join(', ')}`);
  return result(errs);
}

function validateAdminListUsersQuery(query) {
  const errs = { page: [], limit: [], role: [], search: [] };
  if (query.page !== undefined && !isPositiveInt(query.page)) errs.page.push('page must be a positive integer');
  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) errs.limit.push('limit must be an integer between 1 and 100');
  }
  const VALID_ROLES = ['user', 'admin', 'merchant'];
  if (query.role !== undefined && !VALID_ROLES.includes(query.role)) errs.role.push(`role must be one of: ${VALID_ROLES.join(', ')}`);
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 100) errs.search.push('search must be a string of 100 characters or less');
    else if (!isSafeString(query.search)) errs.search.push('search contains invalid characters');
  }
  return result(errs);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Middleware factories
  bodyValidator,
  paramsValidator,
  queryValidator,

  // Shared
  validateIdParam,
  validateStellarAddressParam,
  validatePaginationQuery,
  validatePublicKeyParam,

  // Auth
  validateLoginDto,
  validateRegisterDto,
  validateForgotPasswordDto,
  validateResetPasswordDto,

  // Campaigns
  validateCreateCampaignDto,
  validateUpdateCampaignDto,

  // Rewards
  validateIssueRewardDto,
  validateDistributeRewardDto,

  // Redemptions
  validateCreateRedemptionDto,

  // Users
  validateCreateUserDto,
  validateUpdateUserDto,

  // Wallets
  validateVerifyWalletDto,

  // Transactions
  validateRecordTransactionDto,
  validateTransactionHistoryQuery,

  // Webhooks
  validateCreateWebhookDto,
  validateUpdateWebhookDto,

  // Admin
  validateCreateAdminRewardDto,
  validateUpdateAdminRewardDto,
  validateUpdateUserRoleDto,
  validateAdminListUsersQuery,

  // Helpers (exported for tests)
  isStellarAddress,
  isUUID,
  isSafeUrl,
  isEmail,
  isSafeString,
  isPositiveInt,
  isPositiveNum,
};
