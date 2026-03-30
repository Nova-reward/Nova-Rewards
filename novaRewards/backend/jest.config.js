module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  verbose: true,
  forceExit: true,
  testEnvironmentOptions: {
    env: { NODE_ENV: 'test' },
  },
  setupFilesAfterEnv: ['./jest.setup.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'db/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'src/**/*.js',
    '!**/*.test.js',
  ],
  coverageThreshold: {
    global: {
      lines: 40,
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
