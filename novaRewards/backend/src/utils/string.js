/**
 * String utilities for Nova Rewards
 */

/** Capitalize the first letter of a string */
const capitalize = (str) =>
  typeof str === 'string' && str.length > 0
    ? str.charAt(0).toUpperCase() + str.slice(1)
    : str;

/** Convert camelCase to snake_case */
const toSnakeCase = (str) =>
  str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Truncate a string to maxLen, appending ellipsis if needed */
const truncate = (str, maxLen = 50) =>
  str.length <= maxLen ? str : `${str.slice(0, maxLen)}...`;

/** Slugify a string (lowercase, hyphens) */
const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Mask all but the last n characters of a string */
const mask = (str, visibleChars = 4, maskChar = '*') =>
  str.length <= visibleChars
    ? str
    : maskChar.repeat(str.length - visibleChars) + str.slice(-visibleChars);

module.exports = { capitalize, toSnakeCase, truncate, slugify, mask };
