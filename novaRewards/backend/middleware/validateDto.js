/**
 * Middleware factory: validates request body against allowed fields.
 * Rejects unknown fields to prevent mass-assignment attacks.
 * Requirements: 183.4
 * 
 * @param {string[]} allowedFields - Array of allowed field names
 * @returns {Function} Express middleware
 */
function validateDto(allowedFields) {
  return (req, res, next) => {
    const requestedFields = Object.keys(req.body);
    const unknownFields = requestedFields.filter(
      field => !allowedFields.includes(field)
    );

    if (unknownFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: `Unknown fields: ${unknownFields.join(', ')}`,
        allowedFields,
      });
    }

    next();
  };
}

/**
 * Validation rules for UpdateUserDto
 * Requirements: 183.2
 */
const updateUserDtoRules = {
  allowedFields: ['firstName', 'lastName', 'bio', 'stellarPublicKey'],
  
  /**
   * Validate individual field values
   * @param {Object} data - Request body
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  validate(data) {
    const errors = [];

    if (data.firstName !== undefined) {
      if (typeof data.firstName !== 'string') {
        errors.push('firstName must be a string');
      } else if (data.firstName.length > 100) {
        errors.push('firstName must be 100 characters or less');
      }
    }

    if (data.lastName !== undefined) {
      if (typeof data.lastName !== 'string') {
        errors.push('lastName must be a string');
      } else if (data.lastName.length > 100) {
        errors.push('lastName must be 100 characters or less');
      }
    }

    if (data.bio !== undefined) {
      if (typeof data.bio !== 'string') {
        errors.push('bio must be a string');
      } else if (data.bio.length > 1000) {
        errors.push('bio must be 1000 characters or less');
      }
    }

    if (data.stellarPublicKey !== undefined) {
      if (typeof data.stellarPublicKey !== 'string') {
        errors.push('stellarPublicKey must be a string');
      } else if (!isValidStellarAddress(data.stellarPublicKey)) {
        errors.push('stellarPublicKey must be a valid Stellar address');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

/**
 * Validate Stellar address format
 * @param {string} address - Stellar address to validate
 * @returns {boolean}
 */
function isValidStellarAddress(address) {
  // Stellar addresses are 56 characters, starting with G or M
  return /^[GMA][A-Z2-7]{55}$/.test(address);
}

/**
 * Middleware: validate UpdateUserDto
 * Requirements: 183.2, 183.4
 */
function validateUpdateUserDto(req, res, next) {
  // First check for unknown fields
  const unknownFieldsMiddleware = validateDto(updateUserDtoRules.allowedFields);
  unknownFieldsMiddleware(req, res, (err) => {
    if (err) return next(err);

    // Then validate field values
    const validation = updateUserDtoRules.validate(req.body);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Validation failed',
        details: validation.errors,
      });
    }

    next();
  });
}

module.exports = { validateDto, validateUpdateUserDto, updateUserDtoRules };
