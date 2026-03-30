// Expose shared backend test utilities for Jest-based tests.
global.testUtils = require('./tests/utils');

// Suppress console.error during tests to reduce noise from expected validation errors
jest.spyOn(console, 'error').mockImplementation(() => {});
