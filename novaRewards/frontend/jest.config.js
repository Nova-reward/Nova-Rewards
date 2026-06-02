const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/__tests__/**/*.test.js', '<rootDir>/components/**/*.test.jsx'],
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'store/**/*.{js,jsx,ts,tsx}',
    '!**/*.stories.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageReporters: ['text', 'lcov', 'json', 'html'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { lines: 80, branches: 75, functions: 80 },
  },
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage',
      outputName: 'junit.xml',
    }],
  ],
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'jest-environment-jsdom',
      testMatch: ['<rootDir>/__tests__/**/*.test.js', '<rootDir>/components/**/*.test.jsx'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleFileExtensions: ['jsx', 'js', 'ts', 'tsx', 'json'],
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['@swc/jest', {
          jsc: {
            parser: { syntax: 'ecmascript', jsx: true },
            transform: { react: { runtime: 'automatic' } },
          },
        }],
      },
    },
    {
      displayName: 'pact',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/pact/**/*.pact.test.js'],
      transform: {
        '^.+\\.(js|jsx)$': ['@swc/jest', {
          jsc: {
            parser: { syntax: 'ecmascript', jsx: true },
            transform: { react: { runtime: 'automatic' } },
          },
        }],
      },
    },
  ],
};

module.exports = createJestConfig(customJestConfig);
