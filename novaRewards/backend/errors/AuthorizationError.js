'use strict';

class AuthorizationError extends Error {
  constructor(message = 'Caller does not have admin privileges') {
    super(message);
    this.name = 'AuthorizationError';
    this.status = 403;
    this.code = 'forbidden';
  }
}

module.exports = AuthorizationError;
