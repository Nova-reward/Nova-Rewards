const { isEmail, isUUID, isStellarAddress, isPositiveNumber, isNonEmptyString } = require('../src/utils/validation');

describe('validation utils', () => {
  it('isEmail', () => {
    expect(isEmail('user@example.com')).toBe(true);
    expect(isEmail('not-an-email')).toBe(false);
  });

  it('isUUID', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUUID('not-a-uuid')).toBe(false);
  });

  it('isStellarAddress', () => {
    // Valid 55-char Stellar public key (G + 54 base32 chars)
    expect(isStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN')).toBe(true);
    expect(isStellarAddress('BAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN')).toBe(false);
    expect(isStellarAddress('short')).toBe(false);
  });

  it('isPositiveNumber', () => {
    expect(isPositiveNumber(5)).toBe(true);
    expect(isPositiveNumber(0)).toBe(false);
    expect(isPositiveNumber(-1)).toBe(false);
    expect(isPositiveNumber(NaN)).toBe(false);
  });

  it('isNonEmptyString', () => {
    expect(isNonEmptyString('hello')).toBe(true);
    expect(isNonEmptyString('  ')).toBe(false);
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString(123)).toBe(false);
  });
});
