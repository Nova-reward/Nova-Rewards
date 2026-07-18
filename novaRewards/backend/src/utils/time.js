/**
 * Time utilities for Nova Rewards
 */

/** Check if a date is expired (in the past) */
const isExpired = (date) => new Date(date) < new Date();

/** Add days to a date, returns new Date */
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/** Format a date as YYYY-MM-DD */
const toDateString = (date) => new Date(date).toISOString().slice(0, 10);

/** Return the difference in days between two dates (absolute) */
const diffDays = (a, b) =>
  Math.abs(Math.floor((new Date(a) - new Date(b)) / 86_400_000));

/** Return Unix timestamp (seconds) for a given date */
const toUnixTimestamp = (date = new Date()) => Math.floor(new Date(date).getTime() / 1000);

module.exports = { isExpired, addDays, toDateString, diffDays, toUnixTimestamp };
