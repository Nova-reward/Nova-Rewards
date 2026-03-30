// Feature: nova-rewards, Property 6: Stellar public key validation
// Validates: Requirements 5.1

const fc = require('fast-check');
const { Keypair } = require('stellar-sdk');

// Set required env vars before requiring the module
// ISSUER_PUBLIC must be a valid Stellar public key (Ed25519, G-prefixed, 56 chars)
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.ISSUER_PUBLIC = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

// Validate the key is correct length/format before module load
const { StrKey } = require('stellar-sdk');
if (!StrKey.isValidEd25519PublicKey(process.env.ISSUER_PUBLIC)) {
  // Generate a fresh valid key to use as issuer
  const { Keypair: _KP } = require('stellar-sdk');
  process.env.ISSUER_PUBLIC = _KP.random().publicKey();
}

const { isValidStellarAddress } = require('../../blockchain/stellarService');

describe('isValidStellarAddress', () => {
  // Property 6: arbitrary strings should be rejected
  test('rejects arbitrary strings that are not valid Stellar public keys', () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        // Valid Stellar keys are exactly 56 chars starting with G — very unlikely to be generated
        // Filter out any accidental valid keys
        try {
          const { StrKey } = require('stellar-sdk');
          if (StrKey.isValidEd25519PublicKey(str)) return true; // skip accidental valid key
        } catch { /* ignore */ }

        // Most arbitrary strings should be rejected
        if (str.length !== 56 || !str.startsWith('G')) {
          expect(isValidStellarAddress(str)).toBe(false);
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  // Property 6: valid keypairs should always be accepted
  test('accepts valid Stellar public keys generated from keypairs', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        (seed) => {
          const keypair = Keypair.fromRawEd25519Seed(Buffer.from(seed));
          expect(isValidStellarAddress(keypair.publicKey())).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Edge cases
  test('rejects empty string', () => {
    expect(isValidStellarAddress('')).toBe(false);
  });

  test('rejects null and undefined', () => {
    expect(isValidStellarAddress(null)).toBe(false);
    expect(isValidStellarAddress(undefined)).toBe(false);
  });

  test('rejects a valid-length string with wrong prefix', () => {
    expect(isValidStellarAddress('S' + 'A'.repeat(55))).toBe(false);
  });
});
