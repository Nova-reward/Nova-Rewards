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
  rules: {
    'no-unused-vars': 'warn',
  },
  overrides: [
    {
      files: ['tests/**/*.js', 'jest.setup.js'],
      env: { jest: true },
    },
  ],
};
