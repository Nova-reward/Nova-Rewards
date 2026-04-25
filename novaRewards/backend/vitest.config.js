import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: './vitest.global-setup.js',
    setupFiles: ['./vitest.setup.js'],
    testTimeout: 15000,
    clearMocks: true,
    restoreMocks: true,
    include: ['tests/**/*.test.js'],
    exclude: [
      'tests/load/**',
      'tests/integration/**',
      '**/node_modules/**',
      '**/coverage/**',
    ],
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      include: [
        'routes/**/*.js',
        'db/**/*.js',
        'lib/**/*.js',
        'middleware/**/*.js',
        'services/**/*.js',
        'src/**/*.js',
      ],
      exclude: [
        'server.js',
        'swagger.js',
        '**/*.test.js',
        '**/tests/**',
        '**/node_modules/**',
        '**/coverage/**',
      ],
      reporter: ['text', 'lcov', 'json', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 80,
        branches: 75,
      },
    },
  },
});
