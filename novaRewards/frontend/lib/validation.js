/**
 * Form validation utilities — Issue #323
 *
 * Provides regex-based validators for email, password strength,
 * phone, URL, and custom business-logic rules.
 */

// ---------------------------------------------------------------------------
// Primitive validators
// ---------------------------------------------------------------------------

/** RFC 5322-compatible email regex */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value) {
  if (!value || !value.trim()) return 'Email is required';
  if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address';
  return null;
}

/**
 * Password strength rules:
 *  - min 8 chars
 *  - at least one uppercase letter
 *  - at least one lowercase letter
 *  - at least one digit
 *  - at least one special character
 */
export function validatePassword(value) {
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(value)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(value)) return 'Password must contain a lowercase letter';
  if (!/\d/.test(value)) return 'Password must contain a number';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value))
    return 'Password must contain a special character';
  return null;
}

/**
 * Returns a 0–4 strength score for UI indicators.
 * 0 = very weak, 4 = strong
 */
export function passwordStrengthScore(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)) score++;
  return score;
}

/** E.164-compatible phone number (international or local 10-digit) */
const PHONE_RE = /^\+?[1-9]\d{6,14}$/;

export function validatePhone(value) {
  if (!value || !value.trim()) return 'Phone number is required';
  const digits = value.replace(/[\s\-().]/g, '');
  if (!PHONE_RE.test(digits)) return 'Enter a valid phone number';
  return null;
}

export function validateUrl(value) {
  if (!value || !value.trim()) return 'URL is required';
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol))
      return 'URL must start with http:// or https://';
    return null;
  } catch {
    return 'Enter a valid URL (e.g. https://example.com)';
  }
}

// ---------------------------------------------------------------------------
// Business-logic validators
// ---------------------------------------------------------------------------

/** Stellar public key (G..., 56 chars) */
const STELLAR_KEY_RE = /^G[A-Z2-7]{55}$/;

export function validateStellarAddress(value) {
  if (!value || !value.trim()) return 'Wallet address is required';
  if (!STELLAR_KEY_RE.test(value.trim()))
    return 'Enter a valid Stellar public key (starts with G)';
  return null;
}

export function validatePositiveAmount(value) {
  if (value === '' || value === null || value === undefined)
    return 'Amount is required';
  const n = Number(value);
  if (isNaN(n) || n <= 0) return 'Amount must be a positive number';
  return null;
}

export function validateRequired(value, label = 'This field') {
  if (value === null || value === undefined || String(value).trim() === '')
    return `${label} is required`;
  return null;
}

// ---------------------------------------------------------------------------
// Composite validator
// ---------------------------------------------------------------------------

/**
 * Runs a map of { fieldName: validatorFn } against a values object.
 * Returns { valid: boolean, errors: { fieldName: string | null } }
 *
 * @param {Record<string, unknown>} values
 * @param {Record<string, (v: unknown) => string | null>} rules
 */
export function validateForm(values, rules) {
  const errors = {};
  for (const [field, validator] of Object.entries(rules)) {
    errors[field] = validator(values[field]);
  }
  const valid = Object.values(errors).every((e) => e === null);
  return { valid, errors };
}
