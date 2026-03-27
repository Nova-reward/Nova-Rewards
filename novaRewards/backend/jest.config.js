module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  verbose: true,
  setupFilesAfterEnv: ['./jest.setup.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'db/**/*.js',
    'middleware/**/*.js',
    '!**/*.test.js',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};
