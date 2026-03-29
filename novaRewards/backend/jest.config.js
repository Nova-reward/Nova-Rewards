module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  verbose: true,
  forceExit: true,
  setupFilesAfterEnv: ['./jest.setup.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'db/**/*.js',
    'middleware/**/*.js',
    'src/**/*.js',
    '!**/*.test.js',
  ],
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
};
