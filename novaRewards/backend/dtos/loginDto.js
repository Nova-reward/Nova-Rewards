/**
 * LoginDto — validates POST /api/auth/login body.
 *
 * Fields:
 *   email     string, required, valid email format
 *   password  string, required
 */

const ALLOWED_FIELDS = ['email', 'password'];

/**
 * @param {Object} data - req.body
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLoginDto(data) {
  const errors = [];

  // Unknown field guard
  const unknown = Object.keys(data).filter(k => !ALLOWED_FIELDS.includes(k));
  if (unknown.length) errors.push(`Unknown fields: ${unknown.join(', ')}`);

  // email
  if (!data.email || typeof data.email !== 'string' || !data.email.trim()) {
    errors.push('email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.push('email must be a valid email address');
  }

  // password
  if (!data.password || typeof data.password !== 'string') {
    errors.push('password is required');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateLoginDto, LOGIN_ALLOWED_FIELDS: ALLOWED_FIELDS };
