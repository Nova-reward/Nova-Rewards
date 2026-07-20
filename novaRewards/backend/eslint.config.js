const js = require('@eslint/js');

module.exports = [
  {
    ignores: ['node_modules/', 'coverage/', 'dist/', 'build/', 'eslint.config.js', '.eslintrc.js'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'warn',
      'no-undef': 'off',
    },
  },
  {
    files: ['tests/**/*.js', 'vitest.setup.js', 'vitest.config.js', 'vitest.global-setup.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
  },
];
