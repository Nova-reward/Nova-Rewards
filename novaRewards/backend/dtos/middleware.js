/**
 * Validation middleware wired to route files.
 * Import this module in each route to apply DTO validation.
 *
 * Closes #646
 */

'use strict';

const {
  bodyValidator,
  paramsValidator,
  queryValidator,
  validateIdParam,
  validateStellarAddressParam,
  validatePaginationQuery,
  validatePublicKeyParam,
  validateLoginDto,
  validateRegisterDto,
  validateForgotPasswordDto,
  validateResetPasswordDto,
  validateCreateCampaignDto,
  validateUpdateCampaignDto,
  validateIssueRewardDto,
  validateDistributeRewardDto,
  validateCreateRedemptionDto,
  validateCreateUserDto,
  validateUpdateUserDto,
  validateVerifyWalletDto,
  validateRecordTransactionDto,
  validateTransactionHistoryQuery,
  validateCreateWebhookDto,
  validateUpdateWebhookDto,
  validateCreateAdminRewardDto,
  validateUpdateAdminRewardDto,
  validateUpdateUserRoleDto,
  validateAdminListUsersQuery,
} = require('./index');

// Auth
const validateLogin            = bodyValidator(validateLoginDto);
const validateRegister         = bodyValidator(validateRegisterDto);
const validateForgotPassword   = bodyValidator(validateForgotPasswordDto);
const validateResetPassword    = bodyValidator(validateResetPasswordDto);

// Campaigns
const validateCreateCampaign   = bodyValidator(validateCreateCampaignDto);
const validateUpdateCampaign   = bodyValidator(validateUpdateCampaignDto);
const validateCampaignId       = paramsValidator(validateIdParam);

// Rewards
const validateIssueReward      = bodyValidator(validateIssueRewardDto);
const validateDistributeReward = bodyValidator(validateDistributeRewardDto);

// Redemptions
const validateCreateRedemption = bodyValidator(validateCreateRedemptionDto);
const validateRedemptionId     = paramsValidator(validateIdParam);
const validateRedemptionQuery  = queryValidator(validatePaginationQuery);

// Users
const validateCreateUser       = bodyValidator(validateCreateUserDto);
const validateUpdateUser       = bodyValidator(validateUpdateUserDto);
const validateUserId           = paramsValidator(validateIdParam);

// Wallets
const validateVerifyWallet     = bodyValidator(validateVerifyWalletDto);
const validateWalletPublicKey  = paramsValidator(validatePublicKeyParam);

// Transactions
const validateRecordTransaction    = bodyValidator(validateRecordTransactionDto);
const validateTransactionHistory   = queryValidator(validateTransactionHistoryQuery);
const validateTransactionId        = paramsValidator(validateIdParam);

// Webhooks
const validateCreateWebhook    = bodyValidator(validateCreateWebhookDto);
const validateUpdateWebhook    = bodyValidator(validateUpdateWebhookDto);
const validateWebhookId        = paramsValidator(validateIdParam);
const validateWebhookQuery     = queryValidator(validatePaginationQuery);

// Admin
const validateCreateAdminReward  = bodyValidator(validateCreateAdminRewardDto);
const validateUpdateAdminReward  = bodyValidator(validateUpdateAdminRewardDto);
const validateUpdateUserRole     = bodyValidator(validateUpdateUserRoleDto);
const validateAdminListUsers     = queryValidator(validateAdminListUsersQuery);
const validateAdminRewardId      = paramsValidator(validateIdParam);
const validateAdminUserId        = paramsValidator(validateIdParam);

module.exports = {
  // Auth
  validateLogin,
  validateRegister,
  validateForgotPassword,
  validateResetPassword,

  // Campaigns
  validateCreateCampaign,
  validateUpdateCampaign,
  validateCampaignId,

  // Rewards
  validateIssueReward,
  validateDistributeReward,

  // Redemptions
  validateCreateRedemption,
  validateRedemptionId,
  validateRedemptionQuery,

  // Users
  validateCreateUser,
  validateUpdateUser,
  validateUserId,

  // Wallets
  validateVerifyWallet,
  validateWalletPublicKey,

  // Transactions
  validateRecordTransaction,
  validateTransactionHistory,
  validateTransactionId,

  // Webhooks
  validateCreateWebhook,
  validateUpdateWebhook,
  validateWebhookId,
  validateWebhookQuery,

  // Admin
  validateCreateAdminReward,
  validateUpdateAdminReward,
  validateUpdateUserRole,
  validateAdminListUsers,
  validateAdminRewardId,
  validateAdminUserId,
};
