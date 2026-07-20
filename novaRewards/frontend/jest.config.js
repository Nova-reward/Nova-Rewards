const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFiles: ['<rootDir>/jest.env-setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testMatch: [
    '<rootDir>/__tests__/**/*.test.{js,ts,tsx}',
    '<rootDir>/components/**/*.test.{jsx,tsx}',
    '<rootDir>/lib/**/*.test.{js,ts,tsx}',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'jsx', 'js', 'json'],
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
};

module.exports = createJestConfig(customJestConfig);
