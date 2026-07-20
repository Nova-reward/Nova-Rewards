/**
 * Math utilities for Nova Rewards
 */

/** Clamp a value between min and max */
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** Round to a given number of decimal places */
const roundTo = (value, decimals = 2) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

/** Calculate percentage: (part / total) * 100 */
const percentage = (part, total) => (total === 0 ? 0 : roundTo((part / total) * 100));

/** Sum an array of numbers */
const sum = (arr) => arr.reduce((acc, n) => acc + n, 0);

/** Average of an array of numbers */
const average = (arr) => (arr.length === 0 ? 0 : sum(arr) / arr.length);

module.exports = { clamp, roundTo, percentage, sum, average };
