const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/__tests__/**/*.test.js', '<rootDir>/components/**/*.test.jsx'],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
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
      testMatch: ['<rootDir>/__tests__/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
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
