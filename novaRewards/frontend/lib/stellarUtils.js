import { StrKey } from 'stellar-sdk';

/**
 * Validates if a given string is a valid Stellar Ed25519 public key.
 * @param {string} address - The address to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function isValidStellarAddress(address) {
  if (typeof address !== 'string') return false;
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}
