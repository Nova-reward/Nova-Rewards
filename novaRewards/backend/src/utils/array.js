/**
 * Array utilities for Nova Rewards
 */

/** Remove duplicate values from an array */
const unique = (arr) => [...new Set(arr)];

/** Group array items by a key function */
const groupBy = (arr, keyFn) =>
  arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

/** Split array into chunks of given size */
const chunk = (arr, size) => {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
};

/** Sort array of objects by a key (asc/desc) */
const sortBy = (arr, key, dir = 'asc') =>
  [...arr].sort((a, b) => {
    if (a[key] < b[key]) return dir === 'asc' ? -1 : 1;
    if (a[key] > b[key]) return dir === 'asc' ? 1 : -1;
    return 0;
  });

/** Flatten one level of nested arrays */
const flatten = (arr) => arr.reduce((acc, val) => acc.concat(val), []);

module.exports = { unique, groupBy, chunk, sortBy, flatten };
