'use strict';

module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  // Per-directory overrides — test files get Jest globals injected
  overrides: [
    {
      files: ['tests/**/*.test.js', '**/*.test.js'],
      env: {
        jest: true, // injects describe, test, it, expect, beforeAll, etc.
      },
      rules: {
        // Test files commonly use require() inside describe blocks for
        // jest.resetModules() patterns — allow it.
        'global-require': 'off',
      },
    },
  ],
};
