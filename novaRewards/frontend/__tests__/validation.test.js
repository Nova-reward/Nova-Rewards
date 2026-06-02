/**
 * Tests for lib/validation.js — Issue #323
 */
import {
  validateEmail,
  validatePassword,
  passwordStrengthScore,
  validatePhone,
  validateUrl,
  validateStellarAddress,
  validatePositiveAmount,
  validateRequired,
  validateForm,
} from '../../lib/validation';

describe('validateEmail', () => {
  it('returns null for valid email', () => {
    expect(validateEmail('alice@example.com')).toBeNull();
  });
  it('errors on missing @', () => {
    expect(validateEmail('notanemail')).toBeTruthy();
  });
  it('errors on empty string', () => {
    expect(validateEmail('')).toBeTruthy();
  });
});

describe('validatePassword', () => {
  it('returns null for strong password', () => {
    expect(validatePassword('Str0ng!Pass')).toBeNull();
  });
  it('errors when too short', () => {
    expect(validatePassword('Ab1!')).toBeTruthy();
  });
  it('errors when no uppercase', () => {
    expect(validatePassword('str0ng!pass')).toBeTruthy();
  });
  it('errors when no digit', () => {
    expect(validatePassword('StrongPass!')).toBeTruthy();
  });
  it('errors when no special char', () => {
    expect(validatePassword('Str0ngPass1')).toBeTruthy();
  });
});

describe('passwordStrengthScore', () => {
  it('returns 0 for empty', () => expect(passwordStrengthScore('')).toBe(0));
  it('returns 4 for strong password', () => {
    expect(passwordStrengthScore('Str0ng!Pass')).toBe(4);
  });
});

describe('validatePhone', () => {
  it('accepts E.164 format', () => expect(validatePhone('+14155552671')).toBeNull());
  it('accepts 10-digit local', () => expect(validatePhone('4155552671')).toBeNull());
  it('rejects short number', () => expect(validatePhone('123')).toBeTruthy());
});

describe('validateUrl', () => {
  it('accepts https URL', () => expect(validateUrl('https://example.com')).toBeNull());
  it('rejects ftp URL', () => expect(validateUrl('ftp://example.com')).toBeTruthy());
  it('rejects plain text', () => expect(validateUrl('not a url')).toBeTruthy());
});

describe('validateStellarAddress', () => {
  const valid = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
  it('accepts valid Stellar key', () => expect(validateStellarAddress(valid)).toBeNull());
  it('rejects non-G key', () => expect(validateStellarAddress('BAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN')).toBeTruthy());
  it('rejects short key', () => expect(validateStellarAddress('GABC')).toBeTruthy());
});

describe('validatePositiveAmount', () => {
  it('accepts positive number', () => expect(validatePositiveAmount(10)).toBeNull());
  it('rejects zero', () => expect(validatePositiveAmount(0)).toBeTruthy());
  it('rejects negative', () => expect(validatePositiveAmount(-5)).toBeTruthy());
  it('rejects empty string', () => expect(validatePositiveAmount('')).toBeTruthy());
});

describe('validateRequired', () => {
  it('returns null for non-empty value', () => expect(validateRequired('hello')).toBeNull());
  it('errors on empty string', () => expect(validateRequired('')).toBeTruthy());
  it('errors on null', () => expect(validateRequired(null)).toBeTruthy());
});

describe('validateForm', () => {
  const rules = {
    email: validateEmail,
    amount: validatePositiveAmount,
  };

  it('returns valid=true when all fields pass', () => {
    const { valid, errors } = validateForm({ email: 'a@b.com', amount: 5 }, rules);
    expect(valid).toBe(true);
    expect(errors.email).toBeNull();
    expect(errors.amount).toBeNull();
  });

  it('returns valid=false when a field fails', () => {
    const { valid, errors } = validateForm({ email: 'bad', amount: 5 }, rules);
    expect(valid).toBe(false);
    expect(errors.email).toBeTruthy();
  });
});
