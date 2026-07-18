import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Stub out missing optional packages so vi.mock() hoisting works with CJS require chains
      '@bull-board/api': path.resolve('./__mocks__/@bull-board/api.js'),
      '@bull-board/api/bullMQAdapter': path.resolve('./__mocks__/@bull-board/api/bullMQAdapter.js'),
      '@bull-board/express': path.resolve('./__mocks__/@bull-board/express.js'),
    },
  },
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
    // Inline project source files through Vite's transform pipeline so that
    // vi.mock() hoisting intercepts require() calls inside CJS service modules.
    deps: {
      inline: [
        /\/backend\//,
        /\/blockchain\//,
      ],
    },
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
