'use strict';
require('reflect-metadata');
const { validate, IsString, IsNotEmpty, MaxLength, IsOptional, Length } = require('class-validator');

/**
 * Validates POST /merchants body.
 * Fields: name (required), walletAddress (required, 56-char Stellar key), businessCategory (optional)
 */
class CreateMerchantDto {
  constructor({ name, walletAddress, businessCategory } = {}) {
    this.name = name;
    this.walletAddress = walletAddress;
    this.businessCategory = businessCategory;
  }
}

/**
 * Validates PATCH /merchants/:id body.
 * All fields optional; at least one must be present (enforced in route).
 */
class UpdateMerchantDto {
  constructor({ name, businessCategory } = {}) {
    this.name = name;
    this.businessCategory = businessCategory;
  }
}

/**
 * Validates a CreateMerchantDto manually (no decorators needed in plain JS).
 * @param {object} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateCreateMerchant(data) {
  const errors = [];
  const allowed = ['name', 'walletAddress', 'businessCategory'];
  const unknown = Object.keys(data).filter(k => !allowed.includes(k));
  if (unknown.length) errors.push(`Unknown fields: ${unknown.join(', ')}`);

  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    errors.push('name is required');
  } else if (data.name.trim().length > 255) {
    errors.push('name must be 255 characters or less');
  }

  if (!data.walletAddress || typeof data.walletAddress !== 'string') {
    errors.push('walletAddress is required');
  } else if (!/^[GMA][A-Z2-7]{55}$/.test(data.walletAddress)) {
    errors.push('walletAddress must be a valid Stellar public key');
  }

  if (data.businessCategory !== undefined && data.businessCategory !== null) {
    if (typeof data.businessCategory !== 'string') {
      errors.push('businessCategory must be a string');
    } else if (data.businessCategory.length > 100) {
      errors.push('businessCategory must be 100 characters or less');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates an UpdateMerchantDto manually.
 * @param {object} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateUpdateMerchant(data) {
  const errors = [];
  const allowed = ['name', 'businessCategory'];
  const unknown = Object.keys(data).filter(k => !allowed.includes(k));
  if (unknown.length) errors.push(`Unknown fields: ${unknown.join(', ')}`);

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || !data.name.trim()) {
      errors.push('name must be a non-empty string');
    } else if (data.name.trim().length > 255) {
      errors.push('name must be 255 characters or less');
    }
  }

  if (data.businessCategory !== undefined && data.businessCategory !== null) {
    if (typeof data.businessCategory !== 'string') {
      errors.push('businessCategory must be a string');
    } else if (data.businessCategory.length > 100) {
      errors.push('businessCategory must be 100 characters or less');
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  CreateMerchantDto,
  UpdateMerchantDto,
  validateCreateMerchant,
  validateUpdateMerchant,
};
