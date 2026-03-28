/**
 * RegisterDto — validates POST /api/auth/register body.
 *
 * Fields:
 *   email       string, required, valid email format
 *   password    string, required, min 8 chars
 *   firstName   string, required, max 100 chars
 *   lastName    string, required, max 100 chars
 */

const ALLOWED_FIELDS = ['email', 'password', 'firstName', 'lastName'];

/**
 * @param {Object} data - req.body
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateRegisterDto(data) {
  const errors = [];

  // Unknown field guard (mass-assignment protection)
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
  } else if (data.password.length < 8) {
    errors.push('password must be at least 8 characters');
  }

  // firstName
  if (!data.firstName || typeof data.firstName !== 'string' || !data.firstName.trim()) {
    errors.push('firstName is required');
  } else if (data.firstName.length > 100) {
    errors.push('firstName must be 100 characters or less');
  }

  // lastName
  if (!data.lastName || typeof data.lastName !== 'string' || !data.lastName.trim()) {
    errors.push('lastName is required');
  } else if (data.lastName.length > 100) {
    errors.push('lastName must be 100 characters or less');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateRegisterDto, REGISTER_ALLOWED_FIELDS: ALLOWED_FIELDS };
