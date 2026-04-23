/**
 * Validation utilities for Nova Rewards
 */

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isUUID = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Stellar public key: starts with G, 56 chars total, base32 alphabet */
const isStellarAddress = (value) => /^G[A-Z2-7]{54}$/.test(value);

const isPositiveNumber = (value) => typeof value === 'number' && isFinite(value) && value > 0;

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

module.exports = { isEmail, isUUID, isStellarAddress, isPositiveNumber, isNonEmptyString };
