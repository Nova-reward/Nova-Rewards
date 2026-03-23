module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  verbose: true,
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};
