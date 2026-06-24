const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  {
    ignores: ['node_modules/', '.next/', 'coverage/', 'dist/', 'build/', '.storybook/', 'storybook-static/', 'eslint.config.js', '.eslintrc.js', '.eslintrc.json'],
  },
  ...compat.extends('next/core-web-vitals'),
];
