/**
 * Truncates a Stellar public key to first 6 and last 4 characters.
 * @param {string} address - Full Stellar public key (56 characters)
 * @returns {string} Truncated address (e.g., "GXXXXX…XXXX")
 */
export function truncateAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
