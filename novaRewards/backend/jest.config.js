module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  verbose: true,
  setupFilesAfterEnv: ['./jest.setup.js'],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};
