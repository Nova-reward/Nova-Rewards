/**
 * Conversion utilities for Nova Rewards
 */

const STROOPS_PER_XLM = 10_000_000;

/** Convert XLM to stroops (Stellar's smallest unit) */
const xlmToStroops = (xlm) => Math.round(xlm * STROOPS_PER_XLM);

/** Convert stroops to XLM */
const stroopsToXlm = (stroops) => stroops / STROOPS_PER_XLM;

/** Convert points to token amount using a given rate */
const pointsToTokens = (points, rate) => roundTo(points * rate);

/** Convert bytes to a human-readable string */
const bytesToHuman = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
};

/** Parse a string to a safe integer, returns null if invalid */
const toSafeInt = (value) => {
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
};

function roundTo(value, decimals = 6) {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

module.exports = { xlmToStroops, stroopsToXlm, pointsToTokens, bytesToHuman, toSafeInt };
