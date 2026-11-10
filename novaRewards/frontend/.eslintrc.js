module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    'no-dupe-keys': 'error',
    'react/no-unescaped-entities': 'off',
    '@next/next/no-html-link-for-pages': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'coverage/',
    'dist/',
    'build/',
    '.storybook/',
    'storybook-static/',
    '**/*.stories.*',
  ],
};
