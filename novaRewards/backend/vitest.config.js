import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vite plugin that transforms `jest.mock(...)` / `jest.fn(...)` calls to
 * their vitest equivalents (`vi.mock` / `vi.fn`) in test files so that
 * vitest's AST-level hoisting recognises and hoists them correctly.
 *
 * Required for backwards-compatibility with test files originally written for
 * Jest that use `jest.*` globals.
 */
function jestMockCompatPlugin() {
  return {
    name: 'jest-mock-compat',
    transform(code, id) {
      // Only process test files
      if (!id.includes('/tests/') && !id.endsWith('.test.js') && !id.endsWith('.spec.js')) {
        return null;
      }
      if (
        !code.includes('jest.mock') &&
        !code.includes('jest.fn') &&
        !code.includes('jest.useFakeTimers') &&
        !code.includes('jest.spyOn')
      ) {
        return null;
      }
      const transformed = code
        .replace(/\bjest\.mock\s*\(/g, 'vi.mock(')
        .replace(/\bjest\.fn\s*\(/g, 'vi.fn(')
        .replace(/\bjest\.useFakeTimers\s*\(/g, 'vi.useFakeTimers(')
        .replace(/\bjest\.useRealTimers\s*\(/g, 'vi.useRealTimers(')
        .replace(/\bjest\.advanceTimersByTime\s*\(/g, 'vi.advanceTimersByTime(')
        .replace(/\bjest\.clearAllMocks\s*\(/g, 'vi.clearAllMocks(')
        .replace(/\bjest\.resetAllMocks\s*\(/g, 'vi.resetAllMocks(')
        .replace(/\bjest\.restoreAllMocks\s*\(/g, 'vi.restoreAllMocks(')
        .replace(/\bjest\.spyOn\s*\(/g, 'vi.spyOn(')
        .replace(/\bjest\.resetModules\s*\(/g, 'vi.resetModules(');
      return { code: transformed, map: null };
    },
  };
}

export default defineConfig({
  plugins: [jestMockCompatPlugin()],
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
    // Disable auto-loading of .env files since we set vars in globalSetup
    env: {},
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
        functions: 80,
      },
    },
  },
});
