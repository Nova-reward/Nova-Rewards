/**
 * Regression test for Nova-Rewards#1305:
 * Asserts that the ESLint configuration conflict between flat config and legacy
 * config is eliminated, `.eslintrc.js` is the sole authoritative configuration,
 * `no-dupe-keys` is enforced, and `next.config.js` enables lint during builds.
 */
const { existsSync, readFileSync } = require('fs');
const path = require('path');
const nextConfig = require('../next.config.js');

describe('ESLint configuration resolution (#1305)', () => {
  const frontendDir = path.resolve(__dirname, '..');

  it('does not have conflicting flat-config eslint.config.js or legacy .eslintrc.json', () => {
    expect(existsSync(path.join(frontendDir, 'eslint.config.js'))).toBe(false);
    expect(existsSync(path.join(frontendDir, '.eslintrc.json'))).toBe(false);
  });

  it('has authoritative .eslintrc.js extending next/core-web-vitals with no-dupe-keys', () => {
    const eslintrcPath = path.join(frontendDir, '.eslintrc.js');
    expect(existsSync(eslintrcPath)).toBe(true);

    const config = require(eslintrcPath);
    expect(config.extends).toContain('next/core-web-vitals');
    expect(config.rules['no-dupe-keys']).toBe('error');
  });

  it('enforces linting during next build (ignoreDuringBuilds is false)', () => {
    expect(nextConfig.eslint).toBeDefined();
    expect(nextConfig.eslint.ignoreDuringBuilds).toBe(false);
  });
});
